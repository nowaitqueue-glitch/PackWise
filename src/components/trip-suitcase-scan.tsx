"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Loader2, Sparkles } from "lucide-react";
import { scanSuitcase } from "@/app/dashboard/scan-suitcase-actions";
import { createProCheckoutSession } from "@/app/dashboard/billing-actions";
import { usePillBanner } from "@/components/pill-banner-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type TripSuitcaseScanProps = {
  tripId: string;
  isPro: boolean;
  /** Remaining free scans this month; ignored when isPro. */
  scansRemaining: number;
};

export function TripSuitcaseScan({
  tripId,
  isPro,
  scansRemaining: initialScansRemaining,
}: TripSuitcaseScanProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { showBanner } = usePillBanner();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [scansRemaining, setScansRemaining] = useState(initialScansRemaining);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isCheckoutPending, startCheckout] = useTransition();

  const outOfScans = !isPro && scansRemaining <= 0;

  function openCamera() {
    if (outOfScans) {
      setUpgradeOpen(true);
      return;
    }
    inputRef.current?.click();
  }

  function handleUpgradeClick() {
    setUpgradeOpen(true);
  }

  function handleStartCheckout() {
    startCheckout(async () => {
      const result = await createProCheckoutSession();
      if (!result.ok) {
        showBanner({ message: result.error, variant: "error" });
        return;
      }
      window.location.href = result.url;
    });
  }

  function handleFileChange(event: { target: HTMLInputElement }) {
    const file = event.target.files?.[0];
    // Allow re-selecting the same file later
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      showBanner({
        message: "Please choose a photo of your suitcase.",
        variant: "error",
      });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return objectUrl;
    });
    setSuggestions(null);

    const formData = new FormData();
    formData.set("tripId", tripId);
    formData.set("image", file);

    startTransition(async () => {
      const result = await scanSuitcase(formData);
      if (!result.ok) {
        showBanner({ message: result.error, variant: "error" });
        setSuggestions(null);
        if (result.code === "SCAN_LIMIT") {
          setScansRemaining(0);
          setUpgradeOpen(true);
        }
        return;
      }
      setSuggestions(result.suggestions);
      if (typeof result.scansRemaining === "number") {
        setScansRemaining(result.scansRemaining);
      }
      showBanner({
        message:
          result.suggestions.length > 0
            ? "Scan complete — see suggestions below."
            : "Scan complete — nothing obvious missing.",
        variant: "success",
      });
    });
  }

  const quotaLabel = isPro
    ? "Unlimited scans"
    : `${scansRemaining} scan${scansRemaining === 1 ? "" : "s"} left`;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg">Scan My Suitcase</CardTitle>
          {isPro ? (
            <Badge variant="pro">Pro · Unlimited</Badge>
          ) : (
            <Badge variant="secondary" data-testid="suitcase-scans-remaining">
              {quotaLabel}
            </Badge>
          )}
        </div>
        <CardDescription>
          Snap a photo of your open luggage. AI checks for obviously missing
          essentials based on this trip&apos;s destination and weather.
          {!isPro
            ? " Free accounts get 3 scans per month."
            : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={handleFileChange}
          disabled={isPending || outOfScans}
        />

        {outOfScans ? (
          <Button
            type="button"
            className="w-full"
            onClick={handleUpgradeClick}
            disabled={isCheckoutPending}
            data-testid="suitcase-upgrade-cta"
          >
            <Sparkles aria-hidden />
            Upgrade for unlimited scans
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={openCamera}
            disabled={isPending}
            data-testid="suitcase-scan-button"
          >
            {isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Analyzing suitcase…
              </>
            ) : (
              <>
                <Camera />
                Scan My Suitcase
                {!isPro ? (
                  <span className="text-muted-foreground">
                    ({quotaLabel})
                  </span>
                ) : null}
              </>
            )}
          </Button>
        )}

        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Suitcase preview"
            className="max-h-56 w-full rounded-lg border border-border object-cover"
          />
        ) : null}

        {suggestions && suggestions.length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Sparkles className="size-4 text-amber-600" />
              Suggestions
            </div>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
              {suggestions.map((item, index) => (
                <li key={`${index}-${item.slice(0, 24)}`}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>

      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade to PackWise Pro</DialogTitle>
            <DialogDescription>
              You&apos;ve used your 3 free suitcase scans this month. Pro unlocks
              unlimited Suitcase Snap scans so you can check every bag before
              you leave.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setUpgradeOpen(false)}
              disabled={isCheckoutPending}
            >
              Not now
            </Button>
            <Button
              type="button"
              onClick={handleStartCheckout}
              disabled={isCheckoutPending}
              data-testid="suitcase-checkout-button"
            >
              {isCheckoutPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Redirecting…
                </>
              ) : (
                <>
                  <Sparkles aria-hidden />
                  Upgrade with Stripe
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
