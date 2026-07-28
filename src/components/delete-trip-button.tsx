"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
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

type DeleteTripButtonProps = {
  tripId: string;
  /** Only owners may delete; callers should pass trip.isOwner. */
  isOwner: boolean;
};

export function DeleteTripButton({ tripId, isOwner }: DeleteTripButtonProps) {
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
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="group absolute top-2 right-2 z-10 size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Delete trip"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          <X className="size-3.5 transition-transform duration-200 group-hover:rotate-90" />
        </Button>
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
                const result = await deleteTrip(tripId);
                if (!result.ok) {
                  showBanner({ message: result.error, variant: "error" });
                  return;
                }
                setOpen(false);
                showBanner({ message: "Trip deleted.", variant: "success" });
                router.refresh();
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
