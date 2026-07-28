import Stripe from "stripe";
import { hasRealSecret } from "@/lib/env";

let stripeClient: Stripe | null = null;

export const SCAN_PACK_CREDIT_AMOUNT = 10;

export type CheckoutProductType = "pro" | "scan_pack";

export function getStripeSecretKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  return hasRealSecret(key) ? key : null;
}

/** Primary PackWise Pro recurring price (monthly or single Pro price). */
export function getStripePriceId(): string | null {
  const id = process.env.STRIPE_PRICE_ID?.trim();
  return hasRealSecret(id) ? id : null;
}

/** Optional yearly Pro price. */
export function getStripeYearlyPriceId(): string | null {
  const id = process.env.STRIPE_PRICE_ID_YEARLY?.trim();
  return hasRealSecret(id) ? id : null;
}

/** Optional one-time scan pack price (+10 scans). */
export function getStripeScanPackPriceId(): string | null {
  const id = process.env.STRIPE_PRICE_ID_SCAN_PACK?.trim();
  return hasRealSecret(id) ? id : null;
}

export function getStripeProPriceIds(): string[] {
  return [getStripePriceId(), getStripeYearlyPriceId()].filter(
    (id): id is string => Boolean(id)
  );
}

export function isProPriceId(priceId: string | null | undefined): boolean {
  if (!priceId) return false;
  return getStripeProPriceIds().includes(priceId);
}

export function isScanPackPriceId(priceId: string | null | undefined): boolean {
  const pack = getStripeScanPackPriceId();
  return Boolean(pack && priceId && pack === priceId);
}

export function getStripeWebhookSecret(): string | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  return hasRealSecret(secret) ? secret : null;
}

export function getStripe(): Stripe | null {
  const key = getStripeSecretKey();
  if (!key) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function appOrigin(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.TEST_BASE_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (fromEnv) {
    if (fromEnv.startsWith("http://") || fromEnv.startsWith("https://")) {
      return fromEnv.replace(/\/$/, "");
    }
    return `https://${fromEnv.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}
