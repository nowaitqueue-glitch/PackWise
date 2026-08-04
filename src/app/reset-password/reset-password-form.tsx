"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, glassCard, iconTileClass as brandIconTile } from "@/lib/utils";
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

const MIN_PASSWORD_LENGTH = 8;

type SessionStatus = "loading" | "ready" | "invalid";

const iconTileClass = cn("mb-2 size-14 rounded-2xl", brandIconTile);

const alertPanelClass =
  "rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-300";

export function ResetPasswordForm() {
  const router = useRouter();
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    let hashWaitTimer: number | undefined;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
        setStatus("ready");
      }
    });

    async function establishSession() {
      const params = new URLSearchParams(window.location.search);
      if (params.get("error") === "invalid") {
        setStatus("invalid");
        return;
      }

      const code = params.get("code");
      if (code) {
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;

        if (exchangeError) {
          setStatus("invalid");
          return;
        }

        window.history.replaceState({}, "", "/reset-password");
        setStatus("ready");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      if (session) {
        setStatus("ready");
        return;
      }

      // Legacy implicit recovery links use hash tokens; give the client time
      // to parse them (PASSWORD_RECOVERY / SIGNED_IN via onAuthStateChange).
      hashWaitTimer = window.setTimeout(() => {
        if (cancelled) return;
        void supabase.auth.getSession().then(({ data }) => {
          if (cancelled) return;
          setStatus(data.session ? "ready" : "invalid");
        });
      }, 1500);
    }

    void establishSession();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      if (hashWaitTimer) window.clearTimeout(hashWaitTimer);
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { has_password: true },
    });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.push("/dashboard?password_reset=1");
    router.refresh();
  }

  if (status === "loading") {
    return (
      <Card className={cn("w-full max-w-sm", glassCard)}>
        <CardHeader className="items-center text-center">
          <div className={iconTileClass} aria-hidden>
            <Loader2 className="size-7 animate-spin" />
          </div>
          <CardTitle className="text-2xl">Reset password</CardTitle>
          <CardDescription role="status" className="leading-relaxed">
            Verifying your reset link…
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (status === "invalid") {
    return (
      <Card className={cn("w-full max-w-sm", glassCard)}>
        <CardHeader className="items-center text-center">
          <div className={iconTileClass} aria-hidden>
            <ShieldAlert className="size-7" />
          </div>
          <CardTitle className="text-2xl">Link invalid or expired</CardTitle>
          <CardDescription
            role="status"
            className={cn(alertPanelClass, "mt-2 w-full leading-relaxed")}
          >
            This password reset link is no longer valid. Request a new one from
            the sign-in page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="lg" className="w-full">
            <Link href="/login" aria-label="Back to sign in">
              Back to sign in
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full max-w-sm", glassCard)}>
      <CardHeader className="items-center text-center">
        <div className={iconTileClass} aria-hidden>
          <KeyRound className="size-7" />
        </div>
        <CardTitle className="text-2xl">Choose a new password</CardTitle>
        <CardDescription className="leading-relaxed">
          Enter a new password for your PackWise account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              aria-label="New password"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              aria-label="Confirm password"
            />
          </div>
          {error ? (
            <p className={alertPanelClass} role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={loading}
            aria-label="Update password"
          >
            {loading ? "Saving…" : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
