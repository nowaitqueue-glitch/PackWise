import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  customItemToPackingItem,
  parsePackingItems,
} from "@/lib/packing";
// import { getScanQuota } from "@/lib/pro";
import { formatTripType } from "@/lib/trips";
import { peekCachedTripWeatherCondition } from "@/lib/trip-weather-cache";
import { TripSceneBackgroundRoot } from "@/components/trip-scene-background";
import { DeleteTripButton } from "@/components/delete-trip-button";
import { DuplicateTripButton } from "@/components/duplicate-trip-button";
import { TripExportShare } from "@/components/trip-export-share";
import { TripInviteDialog } from "@/components/trip-invite-dialog";
import { TripPackingListSection } from "@/components/trip-packing-list-section";
// import { TripSuitcaseScan } from "@/components/trip-suitcase-scan-lazy";
import { TripWeatherSection } from "@/components/trip-weather-section";
import { TripWeatherForecastSkeleton } from "@/components/trip-weather-forecast-skeleton";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  CalendarRange,
  Compass,
  Pencil,
  Plus,
  Users,
} from "lucide-react";
import {
  cn,
  glassCard,
  glassChip,
  tripTitleClass,
} from "@/lib/utils";

type TripPageProps = {
  params: { id: string };
  searchParams?: {
    created?: string;
    duplicated?: string;
    updated?: string;
  };
};

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatShortDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const metaChipClass =
  "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground sm:text-sm";

export default async function TripPage({ params, searchParams }: TripPageProps) {
  const { id } = params;
  const expectPendingPacking =
    searchParams?.created === "1" || searchParams?.duplicated === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // These queries are independent — run them in parallel to cut latency.
  const [
    { data: trip, error },
    { count: memberCount },
    { data: packingList },
    customItemsResult,
    // scanQuota, // restore with TripSuitcaseScan
    cachedCondition,
  ] = await Promise.all([
    supabase
      .from("trips")
      .select(
        "id, user_id, destination, start_date, end_date, trip_type, travelers, created_at"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("trip_members")
      .select("id", { count: "exact", head: true })
      .eq("trip_id", id),
    supabase
      .from("packing_lists")
      .select("items")
      .eq("trip_id", id)
      .maybeSingle(),
    supabase
      .from("packing_custom_items")
      .select("id, name, category, notes, packed")
      .eq("trip_id", id)
      .order("created_at", { ascending: true }),
    // getScanQuota(user.id), // restore with TripSuitcaseScan
    peekCachedTripWeatherCondition(supabase, id),
  ]);

  if (error || !trip) {
    notFound();
  }

  const isOwner = trip.user_id === user.id;
  const isShared = (memberCount ?? 0) > 0;

  const packingItems = parsePackingItems(packingList?.items);
  // Tolerate missing table before migration is applied remotely.
  const customItemRows = customItemsResult.error
    ? []
    : (customItemsResult.data ?? []);
  const customItems = customItemRows.map((row) =>
    customItemToPackingItem({
      id: row.id,
      name: row.name,
      category: row.category,
      notes: row.notes ?? "",
      packed: row.packed === true,
    })
  );
  const exportItems = [...packingItems, ...customItems];

  return (
    <TripSceneBackgroundRoot
      tripType={trip.trip_type}
      initialCondition={cachedCondition}
    >
      <main className="relative z-10 mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
        {/* Single content-column scrim — stronger at the bottom for packing text. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-gradient-to-t from-black/60 to-black/20"
        />
        {/* Hero summary keeps the only full glass surface on this page. */}
        <section className={cn("relative overflow-hidden", glassCard)}>
          <div className="relative z-10 flex flex-col gap-6 p-5 sm:p-6">
            <header className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h1
                  className={cn(tripTitleClass, "min-w-0 sm:text-3xl lg:text-4xl")}
                >
                  {trip.destination}
                </h1>
                {isShared ? (
                  <span
                    className={cn(
                      "shrink-0 px-3 py-1 text-xs font-semibold text-foreground",
                      glassChip
                    )}
                  >
                    Shared
                    {memberCount
                      ? ` · ${memberCount} member${memberCount === 1 ? "" : "s"}`
                      : ""}
                  </span>
                ) : null}
              </div>

              <ul className="flex flex-wrap items-center gap-2">
                <li className={cn(metaChipClass, glassChip)}>
                  <CalendarRange
                    className="size-4 shrink-0 text-primary"
                    aria-hidden
                  />
                  <span className="tabular-nums">
                    <span className="sr-only">Dates: </span>
                    <time dateTime={trip.start_date}>
                      {formatShortDate(trip.start_date)}
                    </time>
                    {" – "}
                    <time dateTime={trip.end_date}>
                      {formatShortDate(trip.end_date)}
                    </time>
                  </span>
                </li>
                <li className={cn(metaChipClass, glassChip)}>
                  <Compass className="size-4 shrink-0 text-primary" aria-hidden />
                  <span>
                    <span className="sr-only">Trip type: </span>
                    {formatTripType(trip.trip_type)}
                  </span>
                </li>
                <li className={cn(metaChipClass, glassChip)}>
                  <Users className="size-4 shrink-0 text-primary" aria-hidden />
                  <span className="tabular-nums">
                    {trip.travelers}{" "}
                    {trip.travelers === 1 ? "traveler" : "travelers"}
                  </span>
                </li>
                {!isOwner ? (
                  <li className={cn(metaChipClass, glassChip)}>Shared with you</li>
                ) : null}
              </ul>

              <p className="sr-only">
                {`Starts ${formatDate(trip.start_date)}, ends ${formatDate(trip.end_date)}.`}
              </p>
            </header>

            <div className="flex flex-col gap-3">
              {isOwner ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild variant="outline" className="flex-1 sm:flex-none">
                    <Link href={`/dashboard/trips/${trip.id}/edit`}>
                      <Pencil aria-hidden />
                      Edit trip
                    </Link>
                  </Button>
                  <DuplicateTripButton
                    tripId={trip.id}
                    variant="secondary"
                    size="default"
                    className="flex-1 sm:flex-none"
                    label="Duplicate trip"
                  />
                  <DeleteTripButton
                    tripId={trip.id}
                    isOwner={isOwner}
                    variant="outline"
                    redirectTo="/dashboard"
                  />
                </div>
              ) : (
                <DuplicateTripButton
                  tripId={trip.id}
                  variant="secondary"
                  size="default"
                  className="w-full sm:w-auto"
                  label="Duplicate trip"
                />
              )}

              {isOwner ? <TripInviteDialog tripId={trip.id} /> : null}

              <TripExportShare
                destination={trip.destination}
                startDate={trip.start_date}
                endDate={trip.end_date}
                items={exportItems}
              />

              <div className="flex flex-col gap-2 border-t border-white/40 pt-3 sm:flex-row dark:border-white/10">
                <Button asChild className="w-full sm:flex-1">
                  <Link href="/dashboard/new-trip">
                    <Plus aria-hidden />
                    Create another trip
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="w-full sm:flex-1">
                  <Link href="/dashboard">
                    <ArrowLeft aria-hidden />
                    Back to dashboard
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <Suspense fallback={<TripWeatherForecastSkeleton />}>
          <TripWeatherSection
            tripId={trip.id}
            startDate={trip.start_date}
            endDate={trip.end_date}
          />
        </Suspense>

        <TripPackingListSection
          tripId={trip.id}
          initialItems={packingItems}
          customItems={customItems}
          canRegenerate={isOwner}
          canEdit={isOwner}
          expectPending={expectPendingPacking && packingItems.length === 0}
          tripCreatedAt={trip.created_at}
        />

        {/* Suitcase Snap — temporarily hidden; restore TripSuitcaseScan + getScanQuota to re-enable
        <TripSuitcaseScan
          tripId={trip.id}
          isPro={scanQuota.isPro}
          scansRemaining={scanQuota.scansRemaining}
          canEdit={isOwner}
          packedCount={
            packingItems.filter((item) => item.packed).length +
            customItems.filter((item) => item.packed).length
          }
        />
        */}

        <div className="rounded-2xl border-2 border-dashed border-blue-300/50 bg-gradient-to-br from-blue-50/50 to-teal-50/50 dark:from-blue-950/20 dark:to-teal-950/20 p-6 text-center">
          <div className="text-3xl mb-3">📸</div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">
            Suitcase Snap — Coming Soon
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            AI-powered suitcase scanning will be available with PackWise Pro.
            Snap a photo of your packed bag and we&apos;ll tell you what
            you&apos;re forgetting.
          </p>
          <span className="inline-block mt-4 px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
            Pro Feature
          </span>
        </div>
      </main>
    </TripSceneBackgroundRoot>
  );
}
