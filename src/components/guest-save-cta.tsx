"use client";

import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, glassCard, travelGradient } from "@/lib/utils";

type GuestSaveCtaProps = {
  visible: boolean;
  onDismiss: () => void;
};

export function GuestSaveCta({ visible, onDismiss }: GuestSaveCtaProps) {
  if (!visible) return null;

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
