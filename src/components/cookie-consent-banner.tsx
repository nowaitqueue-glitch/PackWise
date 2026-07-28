"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getCookieConsent,
  setCookieConsent,
  type CookieConsentValue,
} from "@/lib/cookie-consent";
import { cn } from "@/lib/utils";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getCookieConsent() == null) {
      setVisible(true);
    }
  }, []);

  function choose(value: CookieConsentValue) {
    setCookieConsent(value);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
      className={cn(
        "fixed inset-x-0 bottom-0 z-[60]",
        "border-t border-border bg-background/95 text-foreground shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/90",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      )}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-1">
          <p id="cookie-consent-title" className="text-sm font-medium">
            Cookies & analytics
          </p>
          <p
            id="cookie-consent-desc"
            className="text-sm text-muted-foreground"
          >
            We use cookies for analytics to improve PackWise. We do not sell
            your personal data.
          </p>
        </div>
        <div className="flex shrink-0 gap-2 self-end sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => choose("declined")}
          >
            Decline
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => choose("accepted")}
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
