"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ListPlus,
  Loader2,
  ScanLine,
  Sparkles,
} from "lucide-react";
import {
  addSuitcaseSuggestionsToList,
  scanSuitcase,
} from "@/app/dashboard/scan-suitcase-actions";
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
import {
  cn,
  glassCardHover,
  solidContentCard,
  sectionTitleClass,
} from "@/lib/utils";

const ANALYZE_MIN_MS = 1500;

type TripSuitcaseScanProps = {
  tripId: string;
  isPro: boolean;
  /** Remaining free scans this month; ignored when isPro. */
  scansRemaining: number;
  /** Owner can append suggestions to the packing list. */
  canEdit?: boolean;
  /** Packed items so far — Snap stays collapsed until at least one checkoff. */
  packedCount?: number;
};

const CAMERA_DENIED_MESSAGE =
  "Camera access is blocked. Allow the camera in your browser settings to use Suitcase Snap.";

function triggerFilePicker(input: HTMLInputElement) {
  try {
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
  } catch {
    // showPicker requires a transient user activation; fall back to click.
  }
  input.click();
}

export function TripSuitcaseScan({
  tripId,
  isPro,
  scansRemaining: initialScansRemaining,
  canEdit = false,
  packedCount = 0,
}: TripSuitcaseScanProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { showBanner } = usePillBanner();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [scansRemaining, setScansRemaining] = useState(initialScansRemaining);
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const [isAnalyzingOverlay, setIsAnalyzingOverlay] = useState(false);
  const [addedAll, setAddedAll] = useState(false);
  const [expanded, setExpanded] = useState(packedCount >= 1);
  /** Cached so openCamera can stay synchronous and keep the user gesture. */
  const [cameraDenied, setCameraDenied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isAddAllPending, startAddAll] = useTransition();

  useEffect(() => {
    if (packedCount >= 1) {
      setExpanded(true);
    }
  }, [packedCount]);

  useEffect(() => {
    let cancelled = false;
    let permissionStatus: PermissionStatus | null = null;

    function syncDenied(state: PermissionState) {
      if (!cancelled) {
        setCameraDenied(state === "denied");
      }
    }

    void (async () => {
      if (typeof navigator === "undefined" || !navigator.permissions?.query) {
        return;
      }
      try {
        permissionStatus = await navigator.permissions.query({
          name: "camera" as PermissionName,
        });
        if (cancelled) return;
        syncDenied(permissionStatus.state);
        permissionStatus.onchange = () => {
          syncDenied(permissionStatus!.state);
        };
      } catch {
        // Unsupported — leave cameraDenied false and let capture proceed.
      }
    })();

    return () => {
      cancelled = true;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const outOfScans = !isPro && scansRemaining <= 0;
  const showAnalyzing = isAnalyzingOverlay || isPending;

  function openCamera() {
    if (outOfScans) {
      setLimitDialogOpen(true);
      return;
    }

    const input = inputRef.current;
    if (!input) {
      showBanner({
        message: "Couldn't open the camera. Please try again.",
        variant: "error",
      });
      return;
    }

    if (cameraDenied) {
      showBanner({ message: CAMERA_DENIED_MESSAGE, variant: "error" });
      // Still allow a library photo when live capture is blocked.
      input.removeAttribute("capture");
      triggerFilePicker(input);
      window.setTimeout(() => {
        input.setAttribute("capture", "environment");
      }, 0);
      return;
    }

    // Synchronous trigger preserves the user gesture for capture / file picker.
    if (!input.getAttribute("capture")) {
      input.setAttribute("capture", "environment");
    }
    triggerFilePicker(input);
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
    setAddedAll(false);
    setIsAnalyzingOverlay(true);

    const formData = new FormData();
    formData.set("tripId", tripId);
    formData.set("image", file);

    startTransition(async () => {
      const minDelay = new Promise<void>((resolve) => {
        window.setTimeout(resolve, ANALYZE_MIN_MS);
      });

      try {
        const [result] = await Promise.all([scanSuitcase(formData), minDelay]);
        if (!result.ok) {
          showBanner({ message: result.error, variant: "error" });
          setSuggestions(null);
          if (typeof result.scansRemaining === "number") {
            setScansRemaining(result.scansRemaining);
          }
          if (result.code === "SCAN_LIMIT") {
            setScansRemaining(0);
            setLimitDialogOpen(true);
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
      } finally {
        setIsAnalyzingOverlay(false);
      }
    });
  }

  function handleAddAll() {
    if (!canEdit || !suggestions || suggestions.length === 0 || addedAll) {
      return;
    }

    startAddAll(async () => {
      const result = await addSuitcaseSuggestionsToList({
        tripId,
        suggestions,
      });
      if (!result.ok) {
        showBanner({ message: result.error, variant: "error" });
        return;
      }

      setAddedAll(true);
      if (result.added === 0) {
        showBanner({
          message:
            result.skipped > 0
              ? "All suggestions are already on your list."
              : "Nothing new to add.",
          variant: "success",
        });
      } else {
        showBanner({
          message: `Added ${result.added} item${result.added === 1 ? "" : "s"} to your list`,
          variant: "success",
        });
      }
      router.refresh();
    });
  }

  const quotaLabel = isPro
    ? "Unlimited scans"
    : `${scansRemaining} scan${scansRemaining === 1 ? "" : "s"} left`;

  return (
    <Card
      className={cn(
        "relative w-full overflow-hidden",
        solidContentCard,
        glassCardHover
      )}
      data-testid="suitcase-snap"
    >
      <CardHeader className="relative z-10">
        <button
          type="button"
          className="flex w-full items-start justify-between gap-3 text-left"
          aria-expanded={expanded}
          data-testid="suitcase-snap-toggle"
          onClick={() => setExpanded((open) => !open)}
        >
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className={sectionTitleClass}>Scan My Suitcase</CardTitle>
              {isPro ? (
                <Badge variant="pro">Pro</Badge>
              ) : (
                <Badge variant="secondary" data-testid="suitcase-scans-remaining">
                  {quotaLabel}
                </Badge>
              )}
            </div>
            <CardDescription>
              {expanded ? (
                <>
                  Snap a photo of your open luggage. AI checks for obviously
                  missing essentials based on this trip&apos;s destination and
                  weather.
                  {!isPro ? " Free accounts get 3 scans per month." : null}
                </>
              ) : packedCount < 1 ? (
                "Check off at least one packing item first, then open Suitcase Snap."
              ) : (
                "Snap a photo of your open luggage when you are ready."
              )}
            </CardDescription>
          </div>
          <ChevronDown
            className={cn(
              "mt-1 size-5 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-180"
            )}
            aria-hidden
          />
        </button>
      </CardHeader>
      {expanded ? (
      <CardContent className="relative z-10 flex flex-col gap-4">
        <input
          ref={inputRef}
          id="suitcase-snap-capture"
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={handleFileChange}
          disabled={isPending || outOfScans}
        />

        {outOfScans ? (
          <Button
            type="button"
            className="w-full"
            variant="secondary"
            onClick={() => setLimitDialogOpen(true)}
            data-testid="suitcase-limit-cta"
          >
            <Sparkles aria-hidden />
            Scan limit reached — Pro Coming Soon
          </Button>
        ) : (
          <Button
            type="button"
            className="w-full"
            onClick={openCamera}
            disabled={isPending}
            data-testid="suitcase-scan-button"
          >
            {isPending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Analyzing suitcase…
              </>
            ) : (
              <>
                <ScanLine aria-hidden />
                Scan My Suitcase
                {!isPro ? (
                  <span className="font-normal text-white/80">
                    ({quotaLabel})
                  </span>
                ) : null}
              </>
            )}
          </Button>
        )}

        {previewUrl ? (
          <div className="relative overflow-hidden rounded-xl border border-white/40 shadow-md dark:border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob/object URL from file input */}
            <img
              src={previewUrl}
              alt="Suitcase preview"
              width={1120}
              height={448}
              decoding="async"
              className="max-h-56 w-full object-cover"
            />
            {showAnalyzing ? (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/55 backdrop-blur-[2px]"
                role="status"
                aria-live="polite"
                data-testid="suitcase-analyzing-overlay"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-r from-white/10 via-white/25 to-white/10"
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-6 top-1/3 space-y-2"
                >
                  <div className="h-2.5 animate-pulse rounded-full bg-white/35" />
                  <div className="mx-auto h-2.5 w-4/5 animate-pulse rounded-full bg-white/25" />
                  <div className="mx-auto h-2.5 w-3/5 animate-pulse rounded-full bg-white/20" />
                </div>
                <Loader2
                  className="relative size-6 animate-spin text-white"
                  aria-hidden
                />
                <p className="relative px-4 text-center text-sm font-semibold text-white">
                  Analyzing your suitcase…
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {suggestions && suggestions.length > 0 ? (
          <div
            className={cn(
              "flex flex-col gap-3 rounded-xl border border-white/40 bg-white/50 p-4 backdrop-blur-sm",
              "dark:border-white/10 dark:bg-slate-900/50"
            )}
          >
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Sparkles
                className="size-4 shrink-0 text-amber-500 dark:text-amber-300"
                aria-hidden
              />
              Suggestions
            </div>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground">
              {suggestions.map((item, index) => (
                <li key={`${index}-${item.slice(0, 24)}`}>{item}</li>
              ))}
            </ul>
            {canEdit ? (
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto sm:self-start"
                onClick={handleAddAll}
                disabled={isAddAllPending || addedAll}
                data-testid="suitcase-add-all"
              >
                {isAddAllPending ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden />
                    Adding…
                  </>
                ) : addedAll ? (
                  <>
                    <ListPlus aria-hidden />
                    Added to list
                  </>
                ) : (
                  <>
                    <ListPlus aria-hidden />
                    Add all to packing list
                  </>
                )}
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
      ) : null}

      <Dialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan limit reached</DialogTitle>
            <DialogDescription>
              You&apos;ve used your 3 free suitcase scans this month. Unlimited
              Suitcase Snap scans with PackWise Pro — Coming Soon.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setLimitDialogOpen(false)}
              data-testid="suitcase-limit-dismiss"
            >
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
