"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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

type LoginFormProps = {
  nextPath?: string;
  initialBanner?: { message: string; variant: "success" | "error" | "info" } | null;
};

export function LoginForm({
  nextPath = "/dashboard",
  initialBanner = null,
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

  const busy = magicLoading || passwordLoading || resetLoading;

  async function handleMagicLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMagicLoading(true);
    setMagicError(null);
    setPasswordError(null);

    const supabase = createClient();
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", nextPath);

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
    console.log("Attempting login with", email);
    const { data, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });
    console.log("signInWithPassword result", data, signInError);

    if (signInError) {
      setPasswordLoading(false);
      setPasswordError(signInError.message);
      return;
    }

    router.push(nextPath);
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
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent a magic link to{" "}
            <span className="font-medium text-foreground">{email}</span>.
            Click it to sign in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full"
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
        </CardContent>
      </Card>
    );
  }

  if (resetSent) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            {resetSuccess ??
              "We sent a password reset link if that email has an account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setResetSent(false);
              setResetSuccess(null);
              setResetError(null);
            }}
          >
            Back to sign in
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in to PackWise</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a magic link, or sign in with
          your password.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {banner ? (
          <p
            className={
              banner.variant === "error"
                ? "text-sm text-destructive"
                : "text-sm text-muted-foreground"
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
            />
          </div>
          {magicError ? (
            <p className="text-sm text-destructive" role="alert">
              {magicError}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {magicLoading ? "Sending…" : "Send magic link"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Or continue with password
            </span>
          </div>
        </div>

        <form onSubmit={handlePasswordSignIn} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="password">Password</Label>
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
                disabled={busy}
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </div>
          {passwordError ? (
            <p className="text-sm text-destructive" role="alert">
              {passwordError}
            </p>
          ) : null}
          {resetError ? (
            <p className="text-sm text-destructive" role="alert">
              {resetError}
            </p>
          ) : null}
          <Button
            type="submit"
            variant="secondary"
            className="w-full"
            disabled={busy}
          >
            {passwordLoading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
