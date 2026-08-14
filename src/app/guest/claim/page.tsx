"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Luggage } from "lucide-react";
import { claimGuestTrip } from "@/app/guest/claim/actions";
import { createClient } from "@/lib/supabase/client";
import { buildGuestPackingList } from "@/lib/guest-packing";
import {
  applyPackedState,
  clearClaimPackingSnapshot,
  clearGuestTrip,
  ensureGuestClaimId,
  readGuestCustomItems,
  readGuestPackingItems,
  readGuestTrip,
  restoreClaimPackingSnapshot,
  snapshotClaimPackingItems,
  writeGuestPackingItems,
} from "@/lib/guest-storage";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn, glassCard, glassContentOverlay, travelGradient } from "@/lib/utils";

const REBUILD_FAIL_MESSAGE =
  "We couldn't rebuild your packing list just now. Your guest trip is still saved in this browser — try again in a moment.";

export default function GuestClaimPage() {
  const router = useRouter();
  const claimedRef = useRef(false);
  const [status, setStatus] = useState<
    "checking" | "claiming" | "empty" | "error" | "done"
  >("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (claimedRef.current) return;
    claimedRef.current = true;

    let cancelled = false;

    void (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?next=/guest/claim&from=guest&claim=guest");
        return;
      }

      try {
        sessionStorage.removeItem("packwise-claim-guest");
      } catch {
        // ignore
      }

      const trip = readGuestTrip();
      if (!trip) {
        if (!cancelled) setStatus("empty");
        return;
      }

      if (!cancelled) setStatus("claiming");

      // Prefer the list the guest already saw; snapshot before any rebuild.
      let packingItems = applyPackedState(readGuestPackingItems());
      const customItems = applyPackedState(readGuestCustomItems());
      snapshotClaimPackingItems(packingItems);

      if (packingItems.length === 0 && customItems.length === 0) {
        try {
          const built = await buildGuestPackingList({
            destination: trip.destination,
            startDate: trip.startDate,
            endDate: trip.endDate,
            tripType: trip.tripType,
            travelers: trip.travelers,
          });
          packingItems = applyPackedState(built.items);
          if (packingItems.length > 0) {
            writeGuestPackingItems(packingItems);
            snapshotClaimPackingItems(packingItems);
          }
        } catch {
          restoreClaimPackingSnapshot();
          if (!cancelled) {
            setError(REBUILD_FAIL_MESSAGE);
            setStatus("error");
          }
          return;
        }
      }

      if (packingItems.length === 0 && customItems.length === 0) {
        restoreClaimPackingSnapshot();
        if (!cancelled) {
          setError(REBUILD_FAIL_MESSAGE);
          setStatus("error");
        }
        return;
      }

      const result = await claimGuestTrip({
        trip: {
          destination: trip.destination,
          start_date: trip.startDate,
          end_date: trip.endDate,
          trip_type: trip.tripType,
          travelers: trip.travelers,
        },
        packingItems,
        customItems,
        packingSource: "template",
        claimId: ensureGuestClaimId() ?? undefined,
      });

      if (cancelled) return;

      if (!result.ok) {
        // Keep guest localStorage intact so the user can retry.
        restoreClaimPackingSnapshot();
        setError(result.error);
        setStatus("error");
        return;
      }

      // Clear guest data only after the full transfer succeeded (warnings OK).
      clearClaimPackingSnapshot();
      clearGuestTrip();
      setStatus("done");
      const warningQuery = result.warning
        ? `&claim_warning=1`
        : "";
      router.replace(
        `/dashboard/trips/${result.tripId}?created=1${warningQuery}`
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-12 sm:py-16">
      <section className={cn("relative overflow-hidden", glassCard)}>
        <div aria-hidden className={glassContentOverlay} />
        <Card className="relative z-10 border-0 bg-transparent shadow-none">
          <CardHeader>
            <span
              aria-hidden
              className={cn(
                "mb-2 flex size-12 items-center justify-center rounded-2xl text-white shadow-lg",
                travelGradient
              )}
            >
              <Luggage className="size-6" />
            </span>
            <CardTitle className="text-xl">Saving your guest trip</CardTitle>
            <CardDescription>
              Transferring your temporary trip into your PackWise account…
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {status === "checking" ||
            status === "claiming" ||
            status === "done" ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2
                  className="size-4 animate-spin text-primary"
                  aria-hidden
                />
                {status === "done" ? "Redirecting…" : "Please wait…"}
              </p>
            ) : null}

            {status === "empty" ? (
              <>
                <p className="text-sm text-muted-foreground">
                  No guest trip was found in this browser. Create one first, or
                  go to your dashboard.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button asChild>
                    <Link href="/dashboard/guest">Try guest demo</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/dashboard">Dashboard</Link>
                  </Button>
                </div>
              </>
            ) : null}

            {status === "error" ? (
              <>
                <p className="text-sm font-medium text-destructive">
                  {error ?? "Could not save your guest trip."}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button asChild>
                    <Link href="/guest/claim">Try again</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/dashboard/guest">Back to guest demo</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/dashboard">Dashboard</Link>
                  </Button>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
