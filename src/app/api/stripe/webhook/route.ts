import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";
import {
  claimWebhookEvent,
  handleCheckoutCompleted,
  handleInvoicePaid,
  handleSubscriptionChange,
  isMutatingWebhookEvent,
} from "@/lib/stripe-webhook";

/**
 * Stripe webhook — updates privileged profile fields via the service role.
 *
 * Configure in Stripe Dashboard → Webhooks:
 *   URL: https://your-domain/api/stripe/webhook
 *   Events: checkout.session.completed, invoice.paid,
 *           customer.subscription.updated, customer.subscription.deleted
 *
 * Env: STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY,
 *      STRIPE_PRICE_ID (Pro), optional STRIPE_PRICE_ID_YEARLY,
 *      optional STRIPE_PRICE_ID_SCAN_PACK
 *
 * Unlimited scans for Pro use profiles.is_pro (not a literal scans_month sentinel).
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = getStripeWebhookSecret();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured." },
      { status: 500 }
    );
  }

  if (!serviceRole || !supabaseUrl) {
    return NextResponse.json(
      { error: "Supabase service role is not configured." },
      { status: 500 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid webhook signature.";
    console.error("[stripe webhook] signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // Idempotency for profile-mutating events: claim before any credits / Pro updates.
    if (isMutatingWebhookEvent(event.type)) {
      const fromRequest = event.request?.idempotency_key?.trim();
      const idempotencyKey = fromRequest || event.id;
      const claim = await claimWebhookEvent(admin, idempotencyKey);
      if (claim === "duplicate") {
        return NextResponse.json({ received: true });
      }
    }

    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(stripe, admin, event.data.object);
        break;
      }
      case "invoice.paid": {
        await handleInvoicePaid(admin, event.data.object);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await handleSubscriptionChange(
          admin,
          event.data.object,
          event.type === "customer.subscription.updated"
        );
        break;
      }
      default:
        break;
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook handler failed.";
    console.error("[stripe webhook] handler error:", event.type, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
