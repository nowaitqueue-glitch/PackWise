"use client";

import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dismissGuestLocked } from "@/lib/guest-storage";
import { cn, travelGradient } from "@/lib/utils";

type GuestLockedDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Short label for the feature the guest tried to use. */
  feature?: string | null;
  /** Called after the user dismisses so the parent can stop reopening. */
  onDismiss?: () => void;
};

const BENEFITS = [
  "Save trips",
  "Unlimited scans",
  "Share lists",
] as const;

export function GuestLockedDialog({
  open,
  onOpenChange,
  feature = null,
  onDismiss,
}: GuestLockedDialogProps) {
  const description = feature
    ? `${feature} is available with a free PackWise account.`
    : "Create a free PackWise account to unlock more trip tools.";

  function handleDismiss() {
    dismissGuestLocked();
    onDismiss?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md",
                travelGradient
              )}
            >
              <Lock className="size-5" />
            </span>
            <div className="space-y-1.5">
              <DialogTitle>Create a free account to unlock</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ul className="space-y-2 rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-sm text-foreground">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2">
              <Sparkles
                className="mt-0.5 size-3.5 shrink-0 text-primary"
                aria-hidden
              />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={handleDismiss}>
            Dismiss
          </Button>
          <Button asChild>
            <Link href="/signup?from=guest">Sign up free</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
