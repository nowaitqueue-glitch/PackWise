"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, X } from "lucide-react";
import { deleteTrip } from "@/app/dashboard/delete-trip-actions";
import { usePillBanner } from "@/components/pill-banner-provider";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn, deleteButtonIconClass } from "@/lib/utils";

type DeleteTripButtonProps = {
  tripId: string;
  /** Only owners may delete; callers should pass trip.isOwner. */
  isOwner: boolean;
  /**
   * `icon` — absolute corner control on trip cards (default).
   * `button` — inline outline control for trip detail actions.
   */
  appearance?: "icon" | "button";
  /**
   * Spec alias: `outline` renders the inline danger outline control
   * (same as `appearance="button"`).
   */
  variant?: "outline";
  /** Where to navigate after a successful delete (trip detail → dashboard). */
  redirectTo?: string;
  /**
   * Dashboard optimistic UI: close dialog, fade the card out, and hide it
   * from the local list. Skips `router.refresh()` on success.
   */
  onOptimisticRemove?: () => void;
  /** Restore the card if the server delete fails after optimistic remove. */
  onOptimisticRestore?: () => void;
  className?: string;
};

export function DeleteTripButton({
  tripId,
  isOwner,
  appearance = "icon",
  variant,
  redirectTo,
  onOptimisticRemove,
  onOptimisticRestore,
  className,
}: DeleteTripButtonProps) {
  const resolvedAppearance =
    variant === "outline" ? "button" : appearance;
  const router = useRouter();
  const { showBanner } = usePillBanner();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!isOwner) {
    return null;
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        setOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>
        {resolvedAppearance === "button" ? (
          <Button
            type="button"
            variant="outline"
            className={cn(
              "flex-1 border-red-500/40 text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 sm:flex-none",
              className
            )}
            aria-label="Delete trip"
          >
            <Trash2 aria-hidden />
            Delete trip
          </Button>
        ) : (
          <Button
            type="button"
            variant="destructiveGhost"
            size="icon"
            className={cn(
              // Above the trip-card full-bleed Link (z-[1]); keep hit target ≥44px.
              "pointer-events-auto group absolute top-3 right-3 z-10 h-11 w-11 min-h-11 min-w-11 rounded-full p-1.5 [&_svg]:size-7",
              className
            )}
            aria-label="Delete trip"
            onPointerDown={(event) => {
              // Stop the overlay Link from seeing the gesture.
              event.stopPropagation();
            }}
            onClick={(event) => {
              // Do not preventDefault — Radix AlertDialogTrigger skips open
              // when the composed click sees event.defaultPrevented.
              event.stopPropagation();
            }}
          >
            <X className={cn(deleteButtonIconClass)} />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete trip?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the trip, its packing list, and
            weather data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                const useOptimistic = Boolean(onOptimisticRemove);
                if (useOptimistic) {
                  // Close first so the card fade-out is visible behind the dialog.
                  setOpen(false);
                  onOptimisticRemove?.();
                }
                const result = await deleteTrip(tripId);
                if (!result.ok) {
                  onOptimisticRestore?.();
                  showBanner({ message: result.error, variant: "error" });
                  return;
                }
                if (!useOptimistic) {
                  setOpen(false);
                }
                showBanner({ message: "Trip deleted.", variant: "success" });
                if (redirectTo) {
                  router.push(redirectTo);
                } else if (!useOptimistic) {
                  router.refresh();
                }
                // Optimistic dashboard path: revalidatePath soft-syncs; no full refresh flash.
              });
            }}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Deleting…
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
