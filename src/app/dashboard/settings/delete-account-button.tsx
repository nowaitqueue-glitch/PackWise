"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { deleteAccount } from "@/app/dashboard/settings/delete-account-actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CONFIRM_WORD = "DELETE";

export function DeleteAccountButton() {
  const router = useRouter();
  const { showBanner } = usePillBanner();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();

  const canDelete = confirmText.trim() === CONFIRM_WORD;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (isPending) return;
        setOpen(next);
        if (!next) setConfirmText("");
      }}
    >
      <AlertDialogTrigger asChild>
        <Button type="button" variant="destructive">
          Delete Account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account permanently?</AlertDialogTitle>
          <AlertDialogDescription>
            This cannot be undone. Your trips, packing lists, invites,
            weather cache, suitcase scans, and profile will be permanently
            removed, and you will no longer be able to sign in.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2 py-2">
          <Label htmlFor="delete-confirm">
            Type <span className="font-semibold text-foreground">{CONFIRM_WORD}</span>{" "}
            to confirm
          </Label>
          <Input
            id="delete-confirm"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_WORD}
            autoComplete="off"
            disabled={isPending}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending || !canDelete}
            onClick={() => {
              startTransition(async () => {
                const result = await deleteAccount(confirmText);
                if (!result.ok) {
                  showBanner({ message: result.error, variant: "error" });
                  return;
                }
                setOpen(false);
                router.push("/?deleted=1");
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
              "Delete account forever"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
