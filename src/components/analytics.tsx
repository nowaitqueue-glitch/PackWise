"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import {
  COOKIE_CONSENT_EVENT,
  hasAnalyticsConsent,
} from "@/lib/cookie-consent";

/**
 * Loads Plausible only after cookie consent=accepted and when
 * NEXT_PUBLIC_PLAUSIBLE_DOMAIN is set. Without the env var, Accept is a no-op
 * for analytics (dev logs once).
 */
export function Analytics({ nonce }: { nonce?: string }) {
  const [consented, setConsented] = useState(false);
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim() || "";

  useEffect(() => {
    const sync = () => setConsented(hasAnalyticsConsent());
    sync();
    window.addEventListener(COOKIE_CONSENT_EVENT, sync);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!consented || domain) return;
    if (process.env.NODE_ENV !== "development") return;

    console.info(
      "[PackWise] Cookie consent accepted, but NEXT_PUBLIC_PLAUSIBLE_DOMAIN is unset — analytics skipped."
    );
  }, [consented, domain]);

  if (!consented || !domain) return null;

  return (
    <Script
      defer
      data-domain={domain}
      src="https://plausible.io/js/script.js"
      strategy="afterInteractive"
      nonce={nonce}
    />
  );
}
