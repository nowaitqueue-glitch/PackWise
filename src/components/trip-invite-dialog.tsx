"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Loader2, UserPlus } from "lucide-react";
import {
  addTripMemberByEmail,
  createTripInvite,
} from "@/app/dashboard/trip-invite-actions";
import { usePillBanner } from "@/components/pill-banner-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TripInviteDialogProps = {
  tripId: string;
};

function absoluteShareUrl(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}

export function TripInviteDialog({ tripId }: TripInviteDialogProps) {
  const { showBanner } = usePillBanner();
  const [open, setOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function resetFeedback() {
    setCopied(false);
  }

  function handleGenerateLink() {
    resetFeedback();
    startTransition(async () => {
      const result = await createTripInvite(tripId);
      if (!result.ok) {
        showBanner({ message: result.error, variant: "error" });
        return;
      }
      setShareUrl(absoluteShareUrl(result.path));
      showBanner({
        message: "Invite link ready — copy and share it.",
        variant: "success",
      });
    });
  }

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showBanner({ message: "Invite link copied.", variant: "success" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showBanner({ message: "Could not copy to clipboard.", variant: "error" });
    }
  }

  function handleAddByEmail(e: React.FormEvent) {
    e.preventDefault();
    resetFeedback();
    startTransition(async () => {
      const result = await addTripMemberByEmail({ tripId, email });
      if (!result.ok) {
        showBanner({ message: result.error, variant: "error" });
        return;
      }
      setEmail("");
      showBanner({ message: result.message, variant: "success" });
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          resetFeedback();
          setShareUrl(null);
          setEmail("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full">
          <UserPlus aria-hidden />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to trip</DialogTitle>
          <DialogDescription>
            Share your packing list so friends can see what you’re bringing.
            Shared lists are view-only for now — your travel buddies can view
            the list and pack alongside you.
          </DialogDescription>
          <p className="flex flex-wrap items-center gap-2 pt-1 text-sm text-muted-foreground">
            <span>Live collaborative check-offs</span>
            <Badge variant="secondary">Coming soon</Badge>
          </p>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              onClick={handleGenerateLink}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : null}
              Generate share link
            </Button>

            {shareUrl ? (
              <div className="flex gap-2">
                <Input readOnly value={shareUrl} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={handleCopy}
                  aria-label="Copy invite link"
                >
                  {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                </Button>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or add by email
              </span>
            </div>
          </div>

          <form onSubmit={handleAddByEmail} className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="friend@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
                required
              />
            </div>
            <Button type="submit" variant="secondary" disabled={isPending}>
              Add member
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
