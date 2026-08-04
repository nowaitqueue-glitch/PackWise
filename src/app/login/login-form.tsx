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

  async function handleMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMagicLoading(true);
    setMagicError(null);
    setPasswordError(null);

    const supabase = createClient();
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", resolvedNextPath);

    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo.toString(),
      },
    });

    setMagicLoading(false);

    if (signInError) {
      setMagicError(signInError.message);
      return;
    }

    setSent(true);
  }

  async function handlePasswordSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordLoading(true);
    setPasswordError(null);
    setMagicError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setPasswordLoading(false);
      setPasswordError(signInError.message);
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
    const supabase = createClient();
    // Prefer /reset-password as redirectTo (user request). With PKCE the link
    // lands as /reset-password?code=… and the reset page exchanges the code.
    // Also add this URL (and Site URL) in Supabase Auth → Redirect URLs.
    const redirectTo = `${window.location.origin}/reset-password`;

    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
      trimmed,
      { redirectTo }
    );
    setResetLoading(false);

    if (resetErr) {
      setResetError(resetErr.message);
      return;
    }

    setResetSent(true);
    setResetSuccess(
      `If an account exists for ${trimmed}, we sent a password reset link.`
    );
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
          <CardTitle className="text-2xl">
            {fromSignup ? "Welcome to PackWise" : "Sign in to PackWise"}
          </CardTitle>
          <CardDescription className="leading-relaxed">
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
              <p className={alertPanelClass} role="alert">
                {magicError}
              </p>
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
              <span className="w-full border-t border-white/50 dark:border-white/10" />
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
              className="mx-auto rounded-md text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
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
                        className="rounded-md text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:opacity-50"
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
                    <p className={alertPanelClass} role="alert">
                      {passwordError}
                    </p>
                  ) : null}
                  {resetError ? (
                    <p className={alertPanelClass} role="alert">
                      {resetError}
                    </p>
                  ) : null}
                  <Button
                    type="submit"
                    variant="outline"
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
    <p className="text-center text-sm text-muted-foreground">
      <Link
        href="/"
        className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
        aria-label="Go back to home"
      >
        Go back to home
      </Link>
    </p>
  );
}
