"use client";

import { useTransition } from "react";
import { Copy } from "lucide-react";
import { duplicateTrip } from "@/app/dashboard/duplicate-trip-actions";
import { usePillBanner } from "@/components/pill-banner-provider";
import { Button } from "@/components/ui/button";

type DuplicateTripButtonProps = {
  tripId: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  label?: string;
};

export function DuplicateTripButton({
  tripId,
  variant = "outline",
  size = "sm",
  className,
  label = "Duplicate",
}: DuplicateTripButtonProps) {
  const [isPending, startTransition] = useTransition();
  const { showBanner } = usePillBanner();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={isPending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        startTransition(async () => {
          const result = await duplicateTrip(tripId);
          if (!result.ok) {
            showBanner({ message: result.error, variant: "error" });
          }
        });
      }}
    >
      <Copy className="size-4" />
      {size === "icon" ? (
        <span className="sr-only">{isPending ? "Duplicating…" : label}</span>
      ) : (
        <span>{isPending ? "Duplicating…" : label}</span>
      )}
    </Button>
  );
}
