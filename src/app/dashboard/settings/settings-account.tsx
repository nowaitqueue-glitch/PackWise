"use client";

import { useEffect, useState, useTransition } from "react";
import { KeyRound, Loader2, Mail } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { usePillBanner } from "@/components/pill-banner-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type SettingsAccountProps = {
  email: string;
};

/**
 * Detect password availability without dummy sign-in attempts.
 * Email identities cover both magic-link and password auth, so we rely on
 * `user_metadata.has_password` (set after set/change/reset password, or
 * password sign-in). Identities/providers confirm the user can authenticate.
 */
function userHasPassword(user: User | null): boolean {
  if (!user || user.user_metadata?.has_password !== true) return false;

  const providers = Array.isArray(user.app_metadata?.providers)
    ? (user.app_metadata.providers as unknown[]).filter(
        (p): p is string => typeof p === "string"
      )
    : [];
  const identities = user.identities ?? [];
  return providers.length > 0 || identities.length > 0;
}

export function SettingsAccount({ email }: SettingsAccountProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="account-email">Email</Label>
        <Input
          id="account-email"
          value={email}
          readOnly
          className="cursor-default"
        />
        <p className="text-xs text-muted-foreground">
          Your sign-in email. Use Change email to update it.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <ChangeEmailDialog />
      </div>
    </div>
  );
}

export function SettingsPassword({ email }: SettingsAccountProps) {
  // Default to "set" UX (magic-link primary); upgrade after user lookup.
  const [hasPassword, setHasPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setHasPassword(userHasPassword(data.user));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {hasPassword
          ? "Passwords must be at least 8 characters."
          : "Magic-link accounts can set a password for faster sign-in next time. Passwords must be at least 8 characters."}
      </p>
      <div className="flex flex-wrap gap-2">
        <ChangePasswordDialog
          email={email}
          hasPassword={hasPassword}
          onPasswordSet={() => setHasPassword(true)}
        />
      </div>
    </div>
  );
}

function ChangePasswordDialog({
  email,
  hasPassword,
  onPasswordSet,
}: {
  email: string;
  hasPassword: boolean;
  onPasswordSet: () => void;
}) {
  const { showBanner } = usePillBanner();
  const [open, setOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  const canSubmit = hasPassword
    ? Boolean(oldPassword && newPassword && newPassword === confirmPassword)
    : Boolean(newPassword && newPassword === confirmPassword);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="secondary">
          <KeyRound aria-hidden />
          {hasPassword ? "Change password" : "Set a password"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {hasPassword ? "Change password" : "Set a password"}
          </DialogTitle>
          <DialogDescription>
            {hasPassword
              ? "Confirm your current password, then choose a new one."
              : "Choose a password so you can sign in without a magic link."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          {hasPassword ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="old-password">Current password</Label>
              <Input
                id="old-password"
                type="password"
                autoComplete="current-password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                disabled={isPending}
              />
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-password">
              {hasPassword ? "New password" : "Password"}
            </Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-password">
              {hasPassword ? "Confirm new password" : "Confirm password"}
            </Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isPending}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending || !canSubmit}
            onClick={() => {
              startTransition(async () => {
                if (newPassword.length < 8) {
                  showBanner({
                    message: "New password must be at least 8 characters.",
                    variant: "error",
                  });
                  return;
                }
                if (newPassword !== confirmPassword) {
                  showBanner({
                    message: "New passwords do not match.",
                    variant: "error",
                  });
                  return;
                }

                const supabase = createClient();

                if (hasPassword) {
                  const { error: verifyError } =
                    await supabase.auth.signInWithPassword({
                      email,
                      password: oldPassword,
                    });

                  if (verifyError) {
                    showBanner({
                      message: "Current password is incorrect.",
                      variant: "error",
                    });
                    return;
                  }
                }

                const { error: updateError } = await supabase.auth.updateUser({
                  password: newPassword,
                  data: { has_password: true },
                });

                if (updateError) {
                  showBanner({
                    message: updateError.message || "Could not update password.",
                    variant: "error",
                  });
                  return;
                }

                showBanner({
                  message: hasPassword
                    ? "Password updated."
                    : "Password set. You can sign in with email and password next time.",
                  variant: "success",
                });
                onPasswordSet();
                setOpen(false);
                reset();
              });
            }}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : hasPassword ? (
              "Update password"
            ) : (
              "Set password"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChangeEmailDialog() {
  const { showBanner } = usePillBanner();
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        setOpen(next);
        if (!next) setNewEmail("");
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="secondary">
          <Mail aria-hidden />
          Change email
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change email</DialogTitle>
          <DialogDescription>
            We will send a confirmation link to the new address. Your current
            email stays active until you verify the new one.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-2">
          <Label htmlFor="new-email">New email</Label>
          <Input
            id="new-email"
            type="email"
            autoComplete="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            disabled={isPending}
            placeholder="you@example.com"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending || !newEmail.trim()}
            onClick={() => {
              startTransition(async () => {
                const email = newEmail.trim();
                if (!email.includes("@")) {
                  showBanner({
                    message: "Enter a valid email address.",
                    variant: "error",
                  });
                  return;
                }

                const supabase = createClient();
                const { error } = await supabase.auth.updateUser({ email });

                if (error) {
                  showBanner({
                    message: error.message || "Could not update email.",
                    variant: "error",
                  });
                  return;
                }

                showBanner({
                  message:
                    "Check your new inbox to confirm the email change.",
                  variant: "success",
                });
                setOpen(false);
                setNewEmail("");
              });
            }}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Send confirmation"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
