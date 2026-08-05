"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Briefcase, Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  cn,
  glassCard,
  glassChip,
  iconTileClass as brandIconTile,
} from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const GUEST_CLAIM_INTENT_KEY = "packwise-claim-guest";
const GUEST_CLAIM_PATH = "/guest/claim";

type LoginFormProps = {
  nextPath?: string;
  /** Persist guest-trip claim intent across magic-link round-trips. */
  claimGuest?: boolean;
  initialBanner?: { message: string; variant: "success" | "error" | "info" } | null;
  /** When true (e.g. `?from=signup`), title signals account creation. */
  fromSignup?: boolean;
};

const cardMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
};

const iconTileClass = cn("mb-2 size-14 rounded-2xl", brandIconTile);

const alertPanelClass =
  "rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-300";

const infoPanelClass =
  "rounded-xl border border-brand-from/25 bg-brand-from/10 px-3 py-2 text-sm text-brand-from dark:border-brand-from/25 dark:bg-brand-from/15 dark:text-brand-from";

const dividerLabelClass = cn(
  glassChip,
  "px-3 py-0.5 text-xs uppercase tracking-wide text-muted-foreground"
);

const mutedLinkClass =
  "rounded-md text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline dark:text-slate-300 dark:hover:text-white";

const NETWORK_ERROR_MESSAGE =
  "Couldn't connect. Please check your internet and try again.";

function isNetworkAuthError(error: unknown): boolean {
  if (!error) return false;
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === "object" &&
            "message" in error &&
            typeof (error as { message: unknown }).message === "string"
          ? (error as { message: string }).message
          : "";
  const name =
    error instanceof Error
      ? error.name
      : typeof error === "object" &&
          "name" in error &&
          typeof (error as { name: unknown }).name === "string"
        ? (error as { name: string }).name
        : "";

  if (name === "TypeError" && /fetch|network/i.test(message)) return true;
  if (/failed to fetch|networkerror|load failed|network request failed|fetch failed|econnrefused|enotfound|etimedout|aborterror/i.test(message)) {
    return true;
  }
  return false;
}

function mapAuthError(error: unknown): string {
  console.error("[login] auth error", error);
  if (isNetworkAuthError(error)) return NETWORK_ERROR_MESSAGE;
  if (
    typeof error === "object" &&
    error &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

/** Prefer NEXT_PUBLIC_APP_URL (trim trailing slash); else window origin. */
function clientAppOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return window.location.origin;
}

export function LoginForm({
  nextPath = "/dashboard",
  claimGuest = false,
  initialBanner = null,
  fromSignup = false,
}: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicLoading, setMagicLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [magicError, setMagicError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [banner] = useState(initialBanner);
  const [passwordExpanded, setPasswordExpanded] = useState(false);
  const [resolvedNextPath, setResolvedNextPath] = useState(nextPath);

  const busy = magicLoading || passwordLoading || resetLoading;

  useEffect(() => {
    try {
      if (claimGuest || nextPath === GUEST_CLAIM_PATH) {
        sessionStorage.setItem(GUEST_CLAIM_INTENT_KEY, "1");
        setResolvedNextPath(GUEST_CLAIM_PATH);
        return;
      }
      if (sessionStorage.getItem(GUEST_CLAIM_INTENT_KEY) === "1") {
        setResolvedNextPath(GUEST_CLAIM_PATH);
      }
    } catch {
      // sessionStorage may be unavailable; fall back to prop nextPath.
    }
  }, [claimGuest, nextPath]);

  async function handleMagicLink(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setMagicLoading(true);
    setMagicError(null);
    setPasswordError(null);

    try {
      const supabase = createClient();
      const origin = clientAppOrigin();
      const redirectTo = new URL("/auth/callback", origin);
      redirectTo.searchParams.set("next", resolvedNextPath);

      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo.toString(),
        },
      });

      if (signInError) {
        setMagicError(mapAuthError(signInError));
        return;
      }

      setSent(true);
    } catch (error) {
      setMagicError(mapAuthError(error));
    } finally {
      setMagicLoading(false);
    }
  }

  async function handlePasswordSignIn(
    event?: React.FormEvent<HTMLFormElement>
  ) {
    event?.preventDefault();
    setPasswordLoading(true);
    setPasswordError(null);
    setMagicError(null);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setPasswordLoading(false);
        setPasswordError(mapAuthError(signInError));
        return;
      }

      // Record that this account has a password so Settings shows Change vs Set.
      void supabase.auth.updateUser({ data: { has_password: true } });

      try {
        if (resolvedNextPath === GUEST_CLAIM_PATH) {
          sessionStorage.removeItem(GUEST_CLAIM_INTENT_KEY);
        }
      } catch {
        // ignore
      }

      router.push(resolvedNextPath);
      router.refresh();
    } catch (error) {
      setPasswordLoading(false);
      setPasswordError(mapAuthError(error));
    }
  }

  async function handleForgotPassword() {
    setResetError(null);
    setResetSuccess(null);
    setMagicError(null);
    setPasswordError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setResetError("Enter your email above, then click Forgot password.");
      return;
    }

    setResetLoading(true);
    try {
      const supabase = createClient();
      // Prefer /reset-password as redirectTo (user request). With PKCE the link
      // lands as /reset-password?code=… and the reset page exchanges the code.
      // Also add this URL (and Site URL) in Supabase Auth → Redirect URLs
      // (include http://localhost:3000 and :3001 if you use either port).
      const redirectTo = `${clientAppOrigin()}/reset-password`;

      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
        trimmed,
        { redirectTo }
      );

      if (resetErr) {
        setResetError(mapAuthError(resetErr));
        return;
      }

      setResetSent(true);
      setResetSuccess(
        `If an account exists for ${trimmed}, we sent a password reset link.`
      );
    } catch (error) {
      setResetError(mapAuthError(error));
    } finally {
      setResetLoading(false);
    }
  }

  if (sent) {
    return (
      <motion.div
        className="mx-4 w-full max-w-sm"
        {...cardMotion}
      >
        <Card className={cn("w-full", glassCard)}>
          <CardHeader className="items-center text-center">
            <div className={iconTileClass} aria-hidden>
              <Mail className="size-7" />
            </div>
            <CardTitle className="text-xl">
              Check your email for the magic link!
            </CardTitle>
            <CardDescription
              role="status"
              className={cn(infoPanelClass, "mt-2 w-full leading-relaxed")}
            >
              We sent a magic link to{" "}
              <span className="font-semibold">{email}</span>. Click it to sign
              in.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button
              variant="outline"
              className="w-full"
              aria-label="Use a different email"
              onClick={() => {
                setSent(false);
                setEmail("");
                setPassword("");
                setMagicError(null);
                setPasswordError(null);
              }}
            >
              Use a different email
            </Button>
            <HomeLink />
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (resetSent) {
    return (
      <motion.div
        className="mx-4 w-full max-w-sm"
        {...cardMotion}
      >
        <Card className={cn("w-full", glassCard)}>
          <CardHeader className="items-center text-center">
            <div className={iconTileClass} aria-hidden>
              <Mail className="size-7" />
            </div>
            <CardTitle className="text-xl">Check your email</CardTitle>
            <CardDescription
              role="status"
              className={cn(infoPanelClass, "mt-2 w-full leading-relaxed")}
            >
              {resetSuccess ??
                "We sent a password reset link if that email has an account."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button
              variant="outline"
              className="w-full"
              aria-label="Back to sign in"
              onClick={() => {
                setResetSent(false);
                setResetSuccess(null);
                setResetError(null);
              }}
            >
              Back to sign in
            </Button>
            <HomeLink />
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="mx-4 w-full max-w-sm"
      {...cardMotion}
    >
      <Card className={cn("w-full", glassCard)}>
        <CardHeader className="items-center text-center">
          <div className={iconTileClass} aria-hidden>
            <Briefcase className="size-7" />
          </div>
          <CardTitle className="text-2xl text-card-foreground">
            {fromSignup ? "Welcome to PackWise" : "Sign in to PackWise"}
          </CardTitle>
          <CardDescription className="leading-relaxed text-muted-foreground dark:text-slate-300">
            New here? Enter your email — we&apos;ll create your account when you
            open the magic link.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {banner ? (
            <p
              className={
                banner.variant === "error" ? alertPanelClass : infoPanelClass
              }
              role="status"
            >
              {banner.message}
            </p>
          ) : null}

          <form onSubmit={handleMagicLink} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                name="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                aria-label="Email address"
              />
            </div>
            {magicError ? (
              <div className="flex flex-col gap-2" role="alert">
                <p className={alertPanelClass}>{magicError}</p>
                {magicError === NETWORK_ERROR_MESSAGE ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={busy}
                    aria-label="Retry sending magic link"
                    onClick={() => void handleMagicLink()}
                  >
                    Try again
                  </Button>
                ) : null}
              </div>
            ) : null}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={busy}
              aria-label="Send magic link"
            >
              {magicLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                "Send magic link"
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-900/10 dark:border-white/15" />
            </div>
            <div className="relative flex justify-center">
              <span className={dividerLabelClass}>or</span>
            </div>
          </div>

          <Button asChild variant="secondary" size="lg" className="w-full">
            <Link href="/dashboard/guest" aria-label="Try PackWise as guest">
              Try as Guest
            </Link>
          </Button>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              className={cn(mutedLinkClass, "mx-auto")}
              aria-expanded={passwordExpanded}
              aria-controls="password-sign-in"
              onClick={() => setPasswordExpanded((open) => !open)}
            >
              Sign in with password
            </button>

            <div
              id="password-sign-in"
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                passwordExpanded
                  ? "grid-rows-[1fr] opacity-100"
                  : "pointer-events-none grid-rows-[0fr] opacity-0"
              )}
              aria-hidden={!passwordExpanded}
            >
              <div className="min-h-0 overflow-hidden">
                <form
                  onSubmit={handlePasswordSignIn}
                  className="flex flex-col gap-4 pt-1"
                  ref={(node) => {
                    if (!node) return;
                    if (passwordExpanded) node.removeAttribute("inert");
                    else node.setAttribute("inert", "");
                  }}
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="password">Password</Label>
                      <button
                        type="button"
                        className={cn(
                          mutedLinkClass,
                          "text-xs disabled:opacity-50"
                        )}
                        disabled={busy || !passwordExpanded}
                        aria-label="Forgot password"
                        onClick={() => void handleForgotPassword()}
                      >
                        {resetLoading ? "Sending…" : "Forgot password?"}
                      </button>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      name="password"
                      placeholder="Your password"
                      autoComplete="current-password"
                      required
                      tabIndex={passwordExpanded ? undefined : -1}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={busy || !passwordExpanded}
                      aria-label="Password"
                    />
                  </div>
                  {passwordError ? (
                    <div className="flex flex-col gap-2" role="alert">
                      <p className={alertPanelClass}>{passwordError}</p>
                      {passwordError === NETWORK_ERROR_MESSAGE ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          disabled={busy || !passwordExpanded}
                          aria-label="Retry password sign in"
                          onClick={() => void handlePasswordSignIn()}
                        >
                          Try again
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                  {resetError ? (
                    <div className="flex flex-col gap-2" role="alert">
                      <p className={alertPanelClass}>{resetError}</p>
                      {resetError === NETWORK_ERROR_MESSAGE ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          disabled={busy || !passwordExpanded}
                          aria-label="Retry password reset"
                          onClick={() => void handleForgotPassword()}
                        >
                          Try again
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={busy || !passwordExpanded}
                    aria-label="Sign in"
                  >
                    {passwordLoading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        Signing in…
                      </>
                    ) : (
                      "Sign in"
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </div>

          <HomeLink />
        </CardContent>
      </Card>
    </motion.div>
  );
}

function HomeLink() {
  return (
    <p className="text-center text-sm text-muted-foreground dark:text-slate-300">
      <Link
        href="/"
        className="underline-offset-4 transition-colors hover:text-foreground hover:underline dark:hover:text-white"
        aria-label="Go back to home"
      >
        Go back to home
      </Link>
    </p>
  );
}
