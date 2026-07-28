"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
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

export function SettingsAccount({ email }: SettingsAccountProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="account-email">Email</Label>
        <Input
          id="account-email"
          value={email}
          readOnly
          className="bg-muted/40"
        />
        <p className="text-xs text-muted-foreground">
          Your sign-in email. Use Change email to update it.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <ChangePasswordDialog email={email} />
        <ChangeEmailDialog />
      </div>
    </div>
  );
}

function ChangePasswordDialog({ email }: { email: string }) {
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
        <Button type="button" variant="outline">
          Change password
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            Confirm your current password, then choose a new one.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-password">Confirm new password</Label>
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
        <DialogFooter>
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
            disabled={
              isPending ||
              !oldPassword ||
              !newPassword ||
              newPassword !== confirmPassword
            }
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

                const { error: updateError } = await supabase.auth.updateUser({
                  password: newPassword,
                });

                if (updateError) {
                  showBanner({
                    message: updateError.message || "Could not update password.",
                    variant: "error",
                  });
                  return;
                }

                showBanner({
                  message: "Password updated.",
                  variant: "success",
                });
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
            ) : (
              "Update password"
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
        <Button type="button" variant="outline">
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
        <div className="flex flex-col gap-1.5 py-2">
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
        <DialogFooter>
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
