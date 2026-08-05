"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AUTH_NEXT_STORAGE_KEY } from "@/lib/auth-next";

const GUEST_CLAIM_INTENT_KEY = "packwise-claim-guest";
const GUEST_CLAIM_PATH = "/guest/claim";

/** Codes already forwarded this page load (survives Strict Mode remount). */
const forwardedCodes = new Set<string>();

function safeNextPath(raw: string | null | undefined): string | null {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return null;
}

function resolveNextPath(searchParams: URLSearchParams): string {
  const fromQuery = safeNextPath(searchParams.get("next"));
  if (fromQuery) return fromQuery;

  try {
    const stored = safeNextPath(sessionStorage.getItem(AUTH_NEXT_STORAGE_KEY));
    if (stored) {
      sessionStorage.removeItem(AUTH_NEXT_STORAGE_KEY);
      return stored;
    }
    if (sessionStorage.getItem(GUEST_CLAIM_INTENT_KEY) === "1") {
      return GUEST_CLAIM_PATH;
    }
  } catch {
    // sessionStorage unavailable
  }

  return "/dashboard";
}

/**
 * When Supabase magic links land on `/` with `?code=…`, forward to the
 * existing `/auth/callback` route handler so session cookies are set on
 * NextResponse (more reliable than a client-side exchange).
 */
export function MagicLinkLandingHandler() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const [forwarding, setForwarding] = useState(Boolean(code));

  useEffect(() => {
    if (!code || forwardedCodes.has(code)) return;
    forwardedCodes.add(code);
    setForwarding(true);

    const next = resolveNextPath(searchParams);
    const callbackUrl = `/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`;
    window.location.assign(callbackUrl);
  }, [code, searchParams]);

  if (!forwarding || !code) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium text-foreground">Signing you in…</p>
      </div>
    </div>
  );
}
