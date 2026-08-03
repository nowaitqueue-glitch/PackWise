"use client";

import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, glassCard, travelGradient } from "@/lib/utils";

type GuestSaveCtaProps = {
  /** Parent gate (e.g. not dismissed). Engagement threshold is applied here. */
  visible: boolean;
  onDismiss: () => void;
  /** Minimum checked items before showing (default 3). */
  minCheckoffs?: number;
  checkoffCount: number;
  packedCount: number;
  totalCount: number;
};

function shouldShowGuestSaveCta(input: {
  minCheckoffs: number;
  checkoffCount: number;
  packedCount: number;
  totalCount: number;
}): boolean {
  const { minCheckoffs, checkoffCount, packedCount, totalCount } = input;
  if (checkoffCount >= minCheckoffs) return true;
  if (totalCount > 0 && packedCount / totalCount >= 0.5) return true;
  return false;
}

export function GuestSaveCta({
  visible,
  onDismiss,
  minCheckoffs = 3,
  checkoffCount,
  packedCount,
  totalCount,
}: GuestSaveCtaProps) {
  if (
    !visible ||
    !shouldShowGuestSaveCta({
      minCheckoffs,
      checkoffCount,
      packedCount,
      totalCount,
    })
  ) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4 bottom-[calc(var(--consent-h,0px)_+_env(safe-area-inset-bottom,0px))] pb-4"
      role="region"
      aria-label="Save your trip"
    >
      <div
        className={cn(
          "pointer-events-auto relative flex w-full max-w-lg items-center gap-3 px-4 py-3 shadow-2xl",
          glassCard
        )}
      >
        <span
          aria-hidden
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl text-white shadow-md",
            travelGradient
          )}
        >
          <Sparkles className="size-4" />
        </span>
        <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground">
          Ready to save your trip?{" "}
          <Link
            href="/signup?from=guest"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Sign up free →
          </Link>
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 min-h-11 min-w-11 shrink-0 rounded-full p-2 text-muted-foreground"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
