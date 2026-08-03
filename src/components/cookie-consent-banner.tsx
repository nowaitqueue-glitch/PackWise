"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  getCookieConsent,
  setCookieConsent,
  type CookieConsentValue,
} from "@/lib/cookie-consent";
import { cn } from "@/lib/utils";

const CONSENT_H_VAR = "--consent-h";

function clearConsentHeight() {
  document.documentElement.style.removeProperty(CONSENT_H_VAR);
}

function setConsentHeight(px: number) {
  document.documentElement.style.setProperty(CONSENT_H_VAR, `${px}px`);
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (getCookieConsent() == null) {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      clearConsentHeight();
      return;
    }

    const el = bannerRef.current;
    if (!el) return;

    const measure = () => {
      setConsentHeight(el.getBoundingClientRect().height);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);

    return () => {
      observer.disconnect();
      clearConsentHeight();
    };
  }, [visible]);

  function choose(value: CookieConsentValue) {
    setCookieConsent(value);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      ref={bannerRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-desc"
      className={cn(
        "fixed inset-x-0 bottom-0 z-[60]",
        "border-t border-white/40 bg-white/80 text-foreground shadow-lg backdrop-blur-xl supports-[backdrop-filter]:bg-white/70",
        "dark:border-white/10 dark:bg-slate-950/85 supports-[backdrop-filter]:dark:bg-slate-950/70",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      )}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
        <div className="min-w-0 space-y-1">
          <p id="cookie-consent-title" className="text-sm font-bold tracking-tight">
            Cookies &amp; analytics
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
            variant="ghost"
            size="sm"
            aria-label="Decline analytics cookies"
            onClick={() => choose("declined")}
          >
            Decline
          </Button>
          <Button
            type="button"
            size="sm"
            aria-label="Accept analytics cookies"
            onClick={() => choose("accepted")}
          >
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
