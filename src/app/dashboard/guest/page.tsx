"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Compass,
  Loader2,
  Lock,
  MapPin,
  Users,
} from "lucide-react";
import { GuestLockedDialog } from "@/components/guest-locked-dialog";
import type { GuestPackedStats } from "@/components/guest-packing-list";
import { GuestSaveCta } from "@/components/guest-save-cta";
import { GuestWeatherSection } from "@/components/guest-weather-section";
import { usePillBanner } from "@/components/pill-banner-provider";
import { TripCardSkeleton } from "@/components/trip-card-skeleton";
import { TripPackingListSkeleton } from "@/components/trip-packing-list-skeleton";
import { TripWeatherForecastSkeleton } from "@/components/trip-weather-forecast-skeleton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildGuestPackingList } from "@/lib/guest-packing";
import {
  applyPackedState,
  createSampleGuestTrip,
  dismissGuestCta,
  isGuestCtaDismissed,
  isGuestLockedDismissed,
  readGuestCustomItems,
  readGuestPackingItems,
  readGuestTrip,
  syncGuestCheckoffCount,
  writeGuestPackingItems,
  writeGuestTrip,
  type GuestTrip,
} from "@/lib/guest-storage";
import type { PackingItem } from "@/lib/packing";
import { formatTripType } from "@/lib/trips";
import {
  cn,
  glassCard,
  glassCardHover,
  glassChip,
  glassContentOverlay,
  pageTitleClass,
  travelGradient,
  tripTitleClass,
} from "@/lib/utils";

const GuestPackingList = dynamic(
  () =>
    import("@/components/guest-packing-list").then((m) => ({
      default: m.GuestPackingList,
    })),
  {
    loading: () => <TripPackingListSkeleton />,
  }
);

function formatDateRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  const startLabel = new Date(`${start}T00:00:00`).toLocaleDateString(
    undefined,
    opts
  );
  const endLabel = new Date(`${end}T00:00:00`).toLocaleDateString(
    undefined,
    opts
  );
  return `${startLabel} – ${endLabel}`;
}

export default function GuestDashboardPage() {
  const router = useRouter();
  const { showBanner } = usePillBanner();
  const [trip, setTrip] = useState<GuestTrip | null | undefined>(undefined);
  const [packingItems, setPackingItems] = useState<PackingItem[]>([]);
  const packingItemsRef = useRef<PackingItem[]>([]);
  const [packingBusy, setPackingBusy] = useState(false);
  const [packingError, setPackingError] = useState<string | null>(null);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [checkoffCount, setCheckoffCount] = useState(0);
  const [packedCount, setPackedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [ctaDismissed, setCtaDismissed] = useState(true);
  const [lockedOpen, setLockedOpen] = useState(false);
  const [lockedFeature, setLockedFeature] = useState<string | null>(null);
  const [lockedDismissed, setLockedDismissed] = useState(false);

  useEffect(() => {
    setTrip(readGuestTrip());
    setCtaDismissed(isGuestCtaDismissed());
    setLockedDismissed(isGuestLockedDismissed());
    const cached = applyPackedState(readGuestPackingItems());
    const custom = applyPackedState(readGuestCustomItems());
    const merged = [
      ...cached.map((item) => ({ ...item, isCustom: false as const })),
      ...custom.map((item) => ({ ...item, isCustom: true as const })),
    ];
    if (merged.length > 0) {
      setPackingItems(cached);
      const count = syncGuestCheckoffCount(merged);
      setCheckoffCount(count);
      setPackedCount(count);
      setTotalCount(merged.length);
    }
  }, []);

  useEffect(() => {
    packingItemsRef.current = packingItems;
  }, [packingItems]);

  const loadPacking = useCallback(
    async (guestTrip: GuestTrip) => {
      // F5: keep a backup so a failed refresh does not wipe a good list.
      const backup = packingItemsRef.current;
      setPackingBusy(true);
      setPackingError(null);
      try {
        const { items } = await buildGuestPackingList({
          destination: guestTrip.destination,
          startDate: guestTrip.startDate,
          endDate: guestTrip.endDate,
          tripType: guestTrip.tripType,
          travelers: guestTrip.travelers,
        });
        const withPacked = applyPackedState(items);
        writeGuestPackingItems(withPacked);
        const custom = applyPackedState(readGuestCustomItems());
        const merged = [...withPacked, ...custom];
        const count = syncGuestCheckoffCount(merged);
        setPackingItems(withPacked);
        setCheckoffCount(count);
        setPackedCount(count);
        setTotalCount(merged.length);
      } catch (error) {
        if (backup.length > 0) {
          const custom = applyPackedState(readGuestCustomItems());
          const merged = [...backup, ...custom];
          const count = syncGuestCheckoffCount(merged);
          setPackingItems(backup);
          setCheckoffCount(count);
          setPackedCount(count);
          setTotalCount(merged.length);
          setPackingError(null);
          showBanner({
            message:
              "Couldn't refresh packing list. Showing your last saved list.",
            variant: "error",
          });
        } else {
          const custom = applyPackedState(readGuestCustomItems());
          setPackingItems([]);
          const count = syncGuestCheckoffCount(custom);
          setCheckoffCount(count);
          setPackedCount(count);
          setTotalCount(custom.length);
          setPackingError(
            error instanceof Error
              ? error.message
              : "Could not build packing list."
          );
        }
      } finally {
        setPackingBusy(false);
      }
    },
    [showBanner]
  );

  useEffect(() => {
    if (!trip) return;
    void loadPacking(trip);
  }, [trip, loadPacking]);

  async function handleSampleTrip() {
    setSampleBusy(true);
    try {
      const sample = createSampleGuestTrip();
      writeGuestTrip(sample);
      setTrip(sample);
    } finally {
      setSampleBusy(false);
    }
  }

  function handlePackedChange(stats: GuestPackedStats) {
    setCheckoffCount(stats.checkoffCount);
    setPackedCount(stats.packedCount);
    setTotalCount(stats.totalCount);
  }

  function handleDismissCta() {
    dismissGuestCta();
    setCtaDismissed(true);
  }

  function handleLockedFeature(feature: string) {
    // After dismiss, send guests straight to signup instead of reopening the dialog.
    if (lockedDismissed) {
      router.push("/signup?from=guest");
      return;
    }
    setLockedFeature(feature);
    setLockedOpen(true);
  }

  if (trip === undefined) {
    return (
      <main
        className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10"
        aria-busy="true"
        aria-label="Loading guest trip"
      >
        <TripCardSkeleton />
        <TripWeatherForecastSkeleton />
        <TripPackingListSkeleton />
      </main>
    );
  }

  if (!trip) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <div>
          <h1 className={pageTitleClass}>Guest mode</h1>
          <p className="mt-2 text-base text-muted-foreground">
            Plan a trip with weather and a packing list — stored only in this
            browser, no account required.
          </p>
        </div>

        <section
          className={cn("relative overflow-hidden", glassCard, glassCardHover)}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[url('/images/pattern.png')] bg-repeat opacity-5"
          />
          <div aria-hidden className={glassContentOverlay} />
          <Card className="relative z-10 border-0 bg-transparent shadow-none">
            <CardHeader className="items-center pb-4 text-center">
              <span
                aria-hidden
                className={cn(
                  "mb-2 flex size-14 items-center justify-center rounded-2xl text-white shadow-lg",
                  travelGradient
                )}
              >
                <Compass className="size-7" />
              </span>
              <CardTitle className="text-xl">Plan your own trip</CardTitle>
              <CardDescription className="max-w-sm">
                Enter a destination and dates to generate a personal packing
                list.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/guest/new-trip">Plan your own trip</Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={sampleBusy}
                onClick={() => void handleSampleTrip()}
              >
                {sampleBusy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Preparing…
                  </>
                ) : (
                  "Or try a demo trip"
                )}
              </Button>
            </CardContent>
          </Card>
        </section>

        <p className="text-center text-sm text-muted-foreground">
          Suitcase Snap, sharing, and multiple trips require an account.{" "}
          <Link
            href="/signup?from=guest"
            className="font-semibold text-primary underline underline-offset-4"
          >
            Create a free account
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="relative mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 pb-28 sm:px-6 sm:py-10 sm:pb-28">
      <section
        className={cn("relative overflow-hidden", glassCard, glassCardHover)}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[url('/images/pattern.png')] bg-repeat opacity-5"
        />
        <div aria-hidden className={glassContentOverlay} />
        <Card className="relative z-10 w-full border-0 bg-transparent shadow-none">
          <CardHeader>
            <CardTitle className={tripTitleClass}>{trip.destination}</CardTitle>
            <CardDescription>Guest trip</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <dl className="grid gap-2 sm:grid-cols-3">
              <div className={cn(glassChip, "flex flex-col gap-1 px-3 py-2.5")}>
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                  Dates
                </dt>
                <dd className="text-sm font-semibold">
                  {formatDateRange(trip.startDate, trip.endDate)}
                </dd>
              </div>
              <div className={cn(glassChip, "flex flex-col gap-1 px-3 py-2.5")}>
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Users className="size-3.5 shrink-0" aria-hidden />
                  Travelers
                </dt>
                <dd className="text-sm font-semibold">{trip.travelers}</dd>
              </div>
              <div className={cn(glassChip, "flex flex-col gap-1 px-3 py-2.5")}>
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <MapPin className="size-3.5 shrink-0" aria-hidden />
                  Trip type
                </dt>
                <dd className="text-sm font-semibold">
                  {formatTripType(trip.tripType)}
                </dd>
              </div>
            </dl>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleLockedFeature("Share trip")}
                >
                  <Lock aria-hidden />
                  Share trip
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => handleLockedFeature("Suitcase Snap")}
                >
                  <Lock aria-hidden />
                  Suitcase Snap
                </Button>
              </div>
              <Link
                href="/signup?from=guest"
                className="text-sm text-muted-foreground hover:text-primary"
              >
                Create an account to save trips →
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      <GuestWeatherSection
        destination={trip.destination}
        startDate={trip.startDate}
        endDate={trip.endDate}
      />

      {packingBusy ? (
        <TripPackingListSkeleton />
      ) : packingError ? (
        <div
          className={cn(
            glassCard,
            "border-red-500/40 p-6 dark:border-red-500/30"
          )}
          role="alert"
        >
          <p className="text-sm font-medium text-destructive">{packingError}</p>
        </div>
      ) : (
        <GuestPackingList
          initialItems={packingItems}
          onPackedChange={handlePackedChange}
        />
      )}

      <GuestSaveCta
        visible={!ctaDismissed}
        onDismiss={handleDismissCta}
        minCheckoffs={3}
        checkoffCount={checkoffCount}
        packedCount={packedCount}
        totalCount={totalCount}
      />
      <GuestLockedDialog
        open={lockedOpen}
        onOpenChange={setLockedOpen}
        feature={lockedFeature}
        onDismiss={() => setLockedDismissed(true)}
      />
    </main>
  );
}
