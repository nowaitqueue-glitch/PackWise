"use server";

import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateProfile } from "@/lib/pro";
import {
  appOrigin,
  getStripe,
  getStripePriceId,
  getStripeScanPackPriceId,
  getStripeYearlyPriceId,
} from "@/lib/stripe";

export type CreateCheckoutResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

type ProInterval = "month" | "year";

/**
 * Creates a Stripe Checkout Session for PackWise Pro and returns the URL.
 * On success, redirect the browser to `url`.
 */
export async function createProCheckoutSession(
  interval: ProInterval = "month"
): Promise<CreateCheckoutResult> {
  const stripe = getStripe();
  const monthlyPriceId = getStripePriceId();
  const yearlyPriceId = getStripeYearlyPriceId();
  const priceId =
    interval === "year" ? yearlyPriceId ?? monthlyPriceId : monthlyPriceId;

  if (!stripe || !priceId) {
    return {
      ok: false,
      error:
        "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in to upgrade." };
  }

  const profile = await getOrCreateProfile(user.id, supabase);
  const origin = appOrigin();

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/dashboard?upgrade=success`,
    cancel_url: `${origin}/dashboard?upgrade=canceled`,
    client_reference_id: user.id,
    metadata: { user_id: user.id, product_type: "pro" },
    subscription_data: {
      metadata: { user_id: user.id, product_type: "pro" },
    },
  };

  if (profile?.stripe_customer_id) {
    sessionParams.customer = profile.stripe_customer_id;
  } else if (user.email) {
    sessionParams.customer_email = user.email;
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionParams);
    if (!session.url) {
      return { ok: false, error: "Stripe did not return a checkout URL." };
    }
    return { ok: true, url: session.url };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not start checkout.";
    return { ok: false, error: message };
  }
}

/**
 * One-time Checkout for +10 suitcase scan credits (STRIPE_PRICE_ID_SCAN_PACK).
 */
export async function createScanPackCheckoutSession(): Promise<CreateCheckoutResult> {
  const stripe = getStripe();
  const priceId = getStripeScanPackPriceId();

  if (!stripe || !priceId) {
    return {
      ok: false,
      error:
        "Scan pack is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID_SCAN_PACK.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in to buy scan credits." };
  }

  const profile = await getOrCreateProfile(user.id, supabase);
  const origin = appOrigin();

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/dashboard?scan_pack=success`,
    cancel_url: `${origin}/dashboard?scan_pack=canceled`,
    client_reference_id: user.id,
    metadata: { user_id: user.id, product_type: "scan_pack" },
  };

  if (profile?.stripe_customer_id) {
    sessionParams.customer = profile.stripe_customer_id;
  } else if (user.email) {
    sessionParams.customer_email = user.email;
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionParams);
    if (!session.url) {
      return { ok: false, error: "Stripe did not return a checkout URL." };
    }
    return { ok: true, url: session.url };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not start checkout.";
    return { ok: false, error: message };
  }
}

/** Server action used by forms: create session then redirect. */
export async function startProCheckout() {
  const result = await createProCheckoutSession();
  if (!result.ok) {
    redirect(
      `/dashboard?upgrade=error&message=${encodeURIComponent(result.error)}`
    );
  }
  redirect(result.url);
}
