import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import {
  SCAN_PACK_CREDIT_AMOUNT,
  isProPriceId,
  isScanPackPriceId,
  type CheckoutProductType,
} from "@/lib/stripe";

const MUTATING_WEBHOOK_EVENTS = new Set([
  "checkout.session.completed",
  "invoice.paid",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export function isMutatingWebhookEvent(type: string): boolean {
  return MUTATING_WEBHOOK_EVENTS.has(type);
}

/**
 * Insert-before-process claim. Unique stripe_event_id makes concurrent retries
 * race-safe: the loser sees 23505 and must no-op (no double scan_pack credit).
 */
export async function claimWebhookEvent(
  admin: SupabaseClient,
  stripeEventId: string
): Promise<"claimed" | "duplicate"> {
  const { error } = await admin.from("webhook_events").insert({
    stripe_event_id: stripeEventId,
  });

  if (!error) return "claimed";

  if (error.code === "23505") return "duplicate";

  throw new Error(`webhook_events insert failed: ${error.message}`);
}

function resolveUserId(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function productTypeFromMetadata(
  metadata: Stripe.Metadata | null | undefined
): CheckoutProductType | null {
  const raw = metadata?.product_type?.trim();
  if (raw === "pro" || raw === "scan_pack") {
    return raw;
  }
  return null;
}

async function firstLineItemPriceId(
  stripe: Stripe,
  session: Stripe.Checkout.Session
): Promise<string | null> {
  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 5,
    });
    for (const item of lineItems.data) {
      const price = item.price;
      if (price && typeof price.id === "string") {
        return price.id;
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "listLineItems failed";
    console.error("[stripe webhook] listLineItems:", session.id, message);
  }
  return null;
}

async function resolveCheckoutProduct(
  stripe: Stripe,
  session: Stripe.Checkout.Session
): Promise<CheckoutProductType> {
  const fromMeta = productTypeFromMetadata(session.metadata);
  if (fromMeta) return fromMeta;

  if (session.mode === "subscription" || session.subscription) {
    return "pro";
  }

  const priceId = await firstLineItemPriceId(stripe, session);
  if (isScanPackPriceId(priceId)) return "scan_pack";
  if (isProPriceId(priceId)) return "pro";

  // Default legacy Checkout sessions (Pro only) to Pro entitlement.
  return "pro";
}

async function grantPro(
  admin: SupabaseClient,
  userId: string,
  fields: {
    stripe_customer_id?: string | null;
    stripe_subscription_id?: string | null;
  }
) {
  const { error } = await admin.from("profiles").upsert(
    {
      id: userId,
      is_pro: true,
      ...(fields.stripe_customer_id !== undefined
        ? { stripe_customer_id: fields.stripe_customer_id }
        : {}),
      ...(fields.stripe_subscription_id !== undefined
        ? { stripe_subscription_id: fields.stripe_subscription_id }
        : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    throw new Error(`grantPro failed: ${error.message}`);
  }
}

async function addScanPackCredits(admin: SupabaseClient, userId: string) {
  const { data: row, error: selectError } = await admin
    .from("profiles")
    .select("scans_remaining")
    .eq("id", userId)
    .maybeSingle();

  if (selectError) {
    throw new Error(`scan pack select failed: ${selectError.message}`);
  }

  const current =
    typeof row?.scans_remaining === "number" ? row.scans_remaining : 0;
  const next = current + SCAN_PACK_CREDIT_AMOUNT;

  const { error } = await admin.from("profiles").upsert(
    {
      id: userId,
      scans_remaining: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    throw new Error(`scan pack credit failed: ${error.message}`);
  }
}

export async function handleCheckoutCompleted(
  stripe: Stripe,
  admin: SupabaseClient,
  session: Stripe.Checkout.Session
) {
  const userId = resolveUserId(
    session.metadata?.user_id,
    session.client_reference_id
  );
  if (!userId) {
    console.warn(
      "[stripe webhook] checkout.session.completed missing user_id",
      session.id
    );
    return;
  }

  const product = await resolveCheckoutProduct(stripe, session);
  const customerId =
    typeof session.customer === "string" ? session.customer : null;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : null;

  if (product === "scan_pack") {
    await addScanPackCredits(admin, userId);
    if (customerId) {
      const { error } = await admin
        .from("profiles")
        .update({
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (error) {
        console.error(
          "[stripe webhook] scan pack customer id update:",
          error.message
        );
      }
    }
    return;
  }

  await grantPro(admin, userId, {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
  });
}

export async function handleInvoicePaid(
  admin: SupabaseClient,
  invoice: Stripe.Invoice
) {
  const userId = resolveUserId(
    invoice.subscription_details?.metadata?.user_id,
    invoice.metadata?.user_id
  );

  const subscriptionRef = invoice.subscription;
  const subscriptionId =
    typeof subscriptionRef === "string"
      ? subscriptionRef
      : subscriptionRef && typeof subscriptionRef === "object"
        ? subscriptionRef.id
        : null;

  // Subscription renewals: keep Pro entitlement active.
  if (!subscriptionId && !userId) {
    return;
  }

  if (userId) {
    await grantPro(admin, userId, {
      stripe_subscription_id: subscriptionId,
    });
    return;
  }

  if (typeof invoice.customer === "string") {
    const { error } = await admin
      .from("profiles")
      .update({
        is_pro: true,
        stripe_subscription_id: subscriptionId,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_customer_id", invoice.customer);
    if (error) {
      throw new Error(`invoice.paid customer update failed: ${error.message}`);
    }
  }
}

export async function handleSubscriptionChange(
  admin: SupabaseClient,
  subscription: Stripe.Subscription,
  isUpdate: boolean
) {
  const userId = resolveUserId(subscription.metadata?.user_id);
  const active =
    isUpdate &&
    (subscription.status === "active" || subscription.status === "trialing");

  const patch = {
    is_pro: active,
    stripe_subscription_id: active ? subscription.id : null,
    updated_at: new Date().toISOString(),
  };

  if (userId) {
    const { error } = await admin
      .from("profiles")
      .update(patch)
      .eq("id", userId);
    if (error) {
      throw new Error(`subscription update by user_id failed: ${error.message}`);
    }
    return;
  }

  if (typeof subscription.customer === "string") {
    const { error } = await admin
      .from("profiles")
      .update(patch)
      .eq("stripe_customer_id", subscription.customer);
    if (error) {
      throw new Error(
        `subscription update by customer failed: ${error.message}`
      );
    }
  }
}
