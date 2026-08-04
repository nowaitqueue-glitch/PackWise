import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { reportError } from "@/lib/error-reporting";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";
import {
  claimWebhookEvent,
  handleCheckoutCompleted,
  handleInvoicePaid,
  handleSubscriptionChange,
  releaseWebhookEvent,
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
 *
 * Flow: verify signature → idempotency via event.id only → process;
 * on handler failure, delete the claim so Stripe can retry.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  const stripe = getStripe();
  const webhookSecret = getStripeWebhookSecret();
  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured." },
      { status: 500 }
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    reportError(error, {
      stripeWebhook: true,
      stage: "signature_verification",
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency key = event.id only (no event.request.idempotency_key fallback).
  const eventId = event.id?.trim();
  if (!eventId) {
    return NextResponse.json(
      { error: "Missing webhook event id." },
      { status: 400 }
    );
  }

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!serviceRole || !supabaseUrl) {
    return NextResponse.json(
      { error: "Supabase service role is not configured." },
      { status: 500 }
    );
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Check webhook_events — if exists, return 200; else insert claim.
  const claim = await claimWebhookEvent(admin, eventId);
  if (claim === "duplicate") {
    return NextResponse.json({ received: true });
  }

  try {
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

    return NextResponse.json({ received: true });
  } catch (error) {
    // DELETE FROM webhook_events WHERE stripe_event_id = event.id
    await releaseWebhookEvent(admin, eventId);
    reportError(error, {
      stripeWebhook: true,
      stage: "processing",
      eventId,
      eventType: event.type,
    });
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
