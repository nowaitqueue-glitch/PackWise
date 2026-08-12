"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deleteTrips } from "@/app/dashboard/delete-trip-actions";
import { usePillBanner } from "@/components/pill-banner-provider";
import { useTripsList } from "@/components/trips-grid";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn, glassCard } from "@/lib/utils";

export function TripsSelectToggle({ className }: { className?: string }) {
  const list = useTripsList();
  if (!list) return null;

  return (
    <Button
      type="button"
      variant="outline"
      className={cn("shrink-0", className)}
      onClick={() => {
        if (list.isSelectionMode) {
          list.exitSelectionMode();
        } else {
          list.enterSelectionMode();
        }
      }}
      aria-pressed={list.isSelectionMode}
    >
      {list.isSelectionMode ? "Done" : "Select"}
    </Button>
  );
}

/**
 * Floating glass bar for batch delete. Renders when at least one trip is selected.
 */
export function TripsBatchActionBar() {
  const list = useTripsList();
  const { showBanner } = usePillBanner();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!list || list.selectedTrips.length === 0) {
    return null;
  }

  const tripCount = list.selectedTrips.length;
  const title =
    tripCount === 1 ? "Delete this trip?" : `Delete ${tripCount} trips?`;
  const buttonText =
    tripCount === 1 ? "Delete trip" : `Delete ${tripCount} trips`;

  return (
    <>
      <div
        role="toolbar"
        aria-label="Batch trip actions"
        className={cn(
          "fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-lg items-center gap-2 p-3 sm:bottom-6 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full",
          glassCard,
          "shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200"
        )}
      >
        <Button
          type="button"
          variant="destructive"
          className="min-w-0 flex-1"
          disabled={isPending}
          onClick={() => {
            if (tripCount === 0) return;
            setConfirmOpen(true);
          }}
        >
          <Trash2 aria-hidden />
          <span className="truncate">{buttonText}</span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={() => list.clearSelection()}
        >
          Cancel
        </Button>
      </div>

      <AlertDialog
        open={confirmOpen && tripCount > 0}
        onOpenChange={(next) => {
          if (isPending) return;
          if (next && tripCount === 0) return;
          setConfirmOpen(next);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={() => {
                const ids = [...list.selectedTrips];
                if (ids.length === 0) return;
                startTransition(async () => {
                  setConfirmOpen(false);
                  list.clearSelection();
                  list.beginRemoveMany(ids);
                  const result = await deleteTrips(ids);
                  if (result.failedIds.length > 0) {
                    list.restoreMany(result.failedIds);
                    showBanner({
                      message:
                        result.error ??
                        `Could not delete ${result.failedIds.length} trip${
                          result.failedIds.length === 1 ? "" : "s"
                        }.`,
                      variant: "error",
                    });
                  }
                  if (result.deletedIds.length > 0) {
                    showBanner({
                      message:
                        result.deletedIds.length === 1
                          ? "Trip deleted."
                          : `${result.deletedIds.length} trips deleted.`,
                      variant: "success",
                    });
                  }
                  list.exitSelectionMode();
                });
              }}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                buttonText
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}