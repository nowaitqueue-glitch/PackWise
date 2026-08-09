"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AUTH_NEXT_STORAGE_KEY } from "@/lib/auth-next";
import { reportError } from "@/lib/error-reporting";
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
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const GUEST_CLAIM_INTENT_KEY = "packwise-claim-guest";
const GUEST_CLAIM_PATH = "/guest/claim";
const MIN_PASSWORD_LENGTH = 8;

type AuthMode = "signin" | "signup";

type LoginFormProps = {
  nextPath?: string;
  /** Persist guest-trip claim intent across OAuth / email confirm round-trips. */
  claimGuest?: boolean;
  initialBanner?: { message: string; variant: "success" | "error" | "info" } | null;
  /** When true (e.g. `?from=signup`), start in create-account mode. */
  fromSignup?: boolean;
};

/** Fade/slide-in via CSS — avoids pulling framer-motion into the login bundle. */
const cardEnterClass =
  "mx-4 w-full max-w-sm animate-in fade-in-0 slide-in-from-bottom-3 duration-500 fill-mode-both";

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

const googleButtonClass =
  "w-full border border-slate-900/10 bg-white text-slate-900 shadow-sm hover:bg-slate-50 dark:border-white/20 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100";

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

function authErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  if (error instanceof Error) return error.message;
  return "";
}

function isExpectedAuthFailure(error: unknown): boolean {
  const message = authErrorMessage(error).toLowerCase();
  return (
    /invalid login credentials|invalid credentials|email not confirmed|user already registered|already been registered|password should be at least|signup requires a valid password|unable to validate email/i.test(
      message
    )
  );
}

function mapAuthError(error: unknown): string {
  if (isNetworkAuthError(error)) return NETWORK_ERROR_MESSAGE;

  const message = authErrorMessage(error);
  const lower = message.toLowerCase();

  if (/invalid login credentials|invalid credentials/.test(lower)) {
    return "Incorrect email or password.";
  }
  if (/email not confirmed/.test(lower)) {
    return "Confirm your email before signing in. Check your inbox for a link.";
  }
  if (/user already registered|already been registered/.test(lower)) {
    return "An account with this email already exists. Sign in instead.";
  }
  if (/password should be at least|signup requires a valid password/.test(lower)) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (!isExpectedAuthFailure(error)) {
    reportError(error, { context: "login" });
  }

  return message || "Something went wrong. Please try again.";
}

/**
 * Origin for auth redirects. Prefer the live browser origin so OAuth and
 * recovery return to the host the user is on.
 */
function clientAppOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "";
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function LoginForm({
  nextPath = "/dashboard",
  claimGuest = false,
  initialBanner = null,
  fromSignup = false,
}: LoginFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(fromSignup ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [confirmEmailSent, setConfirmEmailSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [banner] = useState(initialBanner);
  const [resolvedNextPath, setResolvedNextPath] = useState(nextPath);

  const busy = authLoading || oauthLoading || resetLoading;

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

  function persistAuthNext(path: string) {
    try {
      sessionStorage.setItem(AUTH_NEXT_STORAGE_KEY, path);
    } catch {
      // sessionStorage may be unavailable
    }
  }

  function clearGuestClaimIntent() {
    try {
      if (resolvedNextPath === GUEST_CLAIM_PATH) {
        sessionStorage.removeItem(GUEST_CLAIM_INTENT_KEY);
      }
    } catch {
      // ignore
    }
  }

  function switchMode(next: AuthMode) {
    setMode(next);
    setFormError(null);
    setResetError(null);
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  async function navigateAfterAuth() {
    clearGuestClaimIntent();
    router.push(resolvedNextPath);
    router.refresh();
  }

  async function handleSignIn(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setAuthLoading(true);
    setFormError(null);
    setResetError(null);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setAuthLoading(false);
        setFormError(mapAuthError(signInError));
        return;
      }

      void supabase.auth.updateUser({ data: { has_password: true } });
      await navigateAfterAuth();
    } catch (error) {
      setAuthLoading(false);
      setFormError(mapAuthError(error));
    }
  }

  async function handleSignUp(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setFormError(null);
    setResetError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      );
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setAuthLoading(true);

    try {
      const supabase = createClient();
      const origin = clientAppOrigin() || window.location.origin;
      persistAuthNext(resolvedNextPath);

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(resolvedNextPath)}`,
          data: { has_password: true },
        },
      });

      if (signUpError) {
        setAuthLoading(false);
        setFormError(mapAuthError(signUpError));
        return;
      }

      // Confirm email OFF → Supabase returns a session; sign the user in now.
      // Confirm email ON → user exists but no session; show check-email (do not navigate).
      if (data.session) {
        await navigateAfterAuth();
        return;
      }

      setAuthLoading(false);
      setConfirmEmailSent(true);
    } catch (error) {
      setAuthLoading(false);
      setFormError(mapAuthError(error));
    }
  }

  async function handleGoogleSignIn() {
    setOauthLoading(true);
    setFormError(null);
    setResetError(null);

    try {
      const supabase = createClient();
      const origin = clientAppOrigin() || window.location.origin;
      persistAuthNext(resolvedNextPath);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(resolvedNextPath)}`,
        },
      });

      if (error) {
        setOauthLoading(false);
        setFormError(mapAuthError(error));
      }
      // On success Supabase navigates away; keep loading state.
    } catch (error) {
      setOauthLoading(false);
      setFormError(mapAuthError(error));
    }
  }

  async function handleForgotPassword() {
    setResetError(null);
    setResetSuccess(null);
    setFormError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setResetError("Enter your email above, then click Forgot password.");
      return;
    }

    setResetLoading(true);
    try {
      const supabase = createClient();
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

  if (confirmEmailSent) {
    return (
      <div className={cardEnterClass}>
        <Card className={cn("w-full", glassCard)}>
          <CardHeader className="items-center text-center">
            <div className={iconTileClass} aria-hidden>
              <Mail className="size-7" />
            </div>
            <h1 className="text-xl font-bold leading-tight tracking-tight text-card-foreground">
              Account created! Check your email to confirm.
            </h1>
            <CardDescription
              role="status"
              className={cn(infoPanelClass, "mt-2 w-full leading-relaxed")}
            >
              We sent a confirmation link to{" "}
              <span className="font-semibold">{email}</span>. Open it to verify
              your account, then sign in. You are not logged in yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Button
              variant="outline"
              className="w-full"
              aria-label="Back to sign in"
              onClick={() => {
                setConfirmEmailSent(false);
                switchMode("signin");
              }}
            >
              Back to sign in
            </Button>
            <HomeLink />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (resetSent) {
    return (
      <div className={cardEnterClass}>
        <Card className={cn("w-full", glassCard)}>
          <CardHeader className="items-center text-center">
            <div className={iconTileClass} aria-hidden>
              <Mail className="size-7" />
            </div>
            <h1 className="text-xl font-bold leading-tight tracking-tight text-card-foreground">
              Check your email
            </h1>
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
      </div>
    );
  }

  const isSignup = mode === "signup";

  return (
    <div className={cardEnterClass}>
      <Card className={cn("w-full", glassCard)}>
        <CardHeader className="items-center text-center">
          <div className={iconTileClass} aria-hidden>
            <Briefcase className="size-7" />
          </div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-card-foreground">
            {isSignup ? "Create your PackWise account" : "Sign in to PackWise"}
          </h1>
          <CardDescription className="leading-relaxed text-muted-foreground dark:text-slate-300">
            {isSignup
              ? "Save trips and packing lists with email and password."
              : "Use your email and password, or continue with Google."}
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

          <form
            onSubmit={isSignup ? handleSignUp : handleSignIn}
            className="flex flex-col gap-4"
          >
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

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="password">Password</Label>
                {!isSignup ? (
                  <button
                    type="button"
                    className={cn(mutedLinkClass, "text-xs disabled:opacity-50")}
                    disabled={busy}
                    aria-label="Forgot password"
                    onClick={() => void handleForgotPassword()}
                  >
                    {resetLoading ? "Sending…" : "Forgot password?"}
                  </button>
                ) : null}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder={
                    isSignup
                      ? `At least ${MIN_PASSWORD_LENGTH} characters`
                      : "Your password"
                  }
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  required
                  minLength={isSignup ? MIN_PASSWORD_LENGTH : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  aria-label="Password"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((open) => !open)}
                  disabled={busy}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </button>
              </div>
            </div>

            {isSignup ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirm-password"
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={busy}
                    aria-label="Confirm password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirm password"
                        : "Show confirm password"
                    }
                    onClick={() => setShowConfirmPassword((open) => !open)}
                    disabled={busy}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="size-4" aria-hidden />
                    ) : (
                      <Eye className="size-4" aria-hidden />
                    )}
                  </button>
                </div>
              </div>
            ) : null}

            {formError ? (
              <div className="flex flex-col gap-2" role="alert">
                <p className={alertPanelClass}>{formError}</p>
                {formError === NETWORK_ERROR_MESSAGE ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={busy}
                    aria-label="Retry authentication"
                    onClick={() =>
                      void (isSignup ? handleSignUp() : handleSignIn())
                    }
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
                    disabled={busy}
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
              disabled={busy}
              aria-label={isSignup ? "Create account" : "Sign in"}
            >
              {authLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {isSignup ? "Creating account…" : "Signing in…"}
                </>
              ) : isSignup ? (
                "Create account"
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground dark:text-slate-300">
            {isSignup ? (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  className={mutedLinkClass}
                  disabled={busy}
                  onClick={() => switchMode("signin")}
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  className={mutedLinkClass}
                  disabled={busy}
                  onClick={() => switchMode("signup")}
                >
                  Create one
                </button>
              </>
            )}
          </p>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-900/10 dark:border-white/15" />
            </div>
            <div className="relative flex justify-center">
              <span className={dividerLabelClass}>or continue with</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className={googleButtonClass}
            disabled={busy}
            aria-label="Continue with Google"
            onClick={() => void handleGoogleSignIn()}
          >
            {oauthLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Connecting…
              </>
            ) : (
              <>
                <GoogleMark className="size-5" />
                Continue with Google
              </>
            )}
          </Button>

          <Button asChild variant="secondary" size="lg" className="w-full">
            <Link href="/dashboard/guest" aria-label="Try PackWise as guest">
              Try as Guest
            </Link>
          </Button>

          <HomeLink />
        </CardContent>
      </Card>
    </div>
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
