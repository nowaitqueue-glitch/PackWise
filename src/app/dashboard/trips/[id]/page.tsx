import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  customItemToPackingItem,
  parsePackingItems,
  parsePackingListSource,
  type PackingListSource,
} from "@/lib/packing";
import { getScanQuota } from "@/lib/pro";
import { formatTripType } from "@/lib/trips";
import { peekCachedTripWeatherCondition } from "@/lib/trip-weather-cache";
import { TripSceneBackgroundRoot } from "@/components/trip-scene-background";
import { DuplicateTripButton } from "@/components/duplicate-trip-button";
import { TripExportShare } from "@/components/trip-export-share";
import { TripInviteDialog } from "@/components/trip-invite-dialog";
import { TripPackingListSection } from "@/components/trip-packing-list-section";
import { TripSuitcaseScan } from "@/components/trip-suitcase-scan";
import { TripWeatherSection } from "@/components/trip-weather-section";
import { TripWeatherForecastSkeleton } from "@/components/trip-weather-forecast-skeleton";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  // Weather forecast stays in <Suspense>; only a cheap cache peek runs here
  // for the initial scene image (no Open-Meteo on the critical path).
  const [
    { data: trip, error },
    { count: memberCount },
    { data: packingList },
    customItemsResult,
    scanQuota,
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
    getScanQuota(user.id),
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
  const storedSource = parsePackingListSource(packingList?.items);
  const listSource: PackingListSource | undefined =
    storedSource ?? (packingItems.length > 0 ? "template" : undefined);

  return (
    <TripSceneBackgroundRoot
      tripId={trip.id}
      tripType={trip.trip_type}
      initialCondition={cachedCondition}
    >
      <main className="relative z-10 mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
        <section className="rounded-2xl border border-white/20 bg-white/30 text-foreground backdrop-blur-md dark:border-white/10 dark:bg-white/10">
          <Card className="w-full border-0 bg-transparent shadow-none">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <CardTitle className="font-bold text-2xl tracking-tight">
                  {trip.destination}
                </CardTitle>
                {isShared ? (
                  <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Shared
                    {memberCount
                      ? ` · ${memberCount} member${memberCount === 1 ? "" : "s"}`
                      : ""}
                  </span>
                ) : null}
              </div>
              <CardDescription>
                {formatTripType(trip.trip_type)} · {trip.travelers}{" "}
                {trip.travelers === 1 ? "traveler" : "travelers"}
                {!isOwner ? " · Shared with you" : null}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <dl className="grid gap-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Start</dt>
                  <dd className="font-medium">{formatDate(trip.start_date)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">End</dt>
                  <dd className="font-medium">{formatDate(trip.end_date)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Trip type</dt>
                  <dd className="font-medium">{formatTripType(trip.trip_type)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Travelers</dt>
                  <dd className="font-medium">{trip.travelers}</dd>
                </div>
              </dl>
              <div className="flex flex-col gap-2">
                {isOwner ? <TripInviteDialog tripId={trip.id} /> : null}
                {isOwner ? (
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/dashboard/trips/${trip.id}/edit`}>
                      <Pencil className="size-4" />
                      Edit trip
                    </Link>
                  </Button>
                ) : null}
                <DuplicateTripButton
                  tripId={trip.id}
                  variant="secondary"
                  size="default"
                  className="w-full"
                  label="Duplicate trip"
                />
                <TripExportShare
                  destination={trip.destination}
                  startDate={trip.start_date}
                  endDate={trip.end_date}
                  items={exportItems}
                />
                <Button asChild className="w-full">
                  <Link href="/dashboard/new-trip">Create another trip</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/dashboard">Back to dashboard</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <Suspense fallback={<TripWeatherForecastSkeleton />}>
          <TripWeatherSection
            tripId={trip.id}
            startDate={trip.start_date}
            endDate={trip.end_date}
          />
        </Suspense>

        <TripSuitcaseScan
          tripId={trip.id}
          isPro={scanQuota.isPro}
          scansRemaining={scanQuota.scansRemaining}
        />

        <TripPackingListSection
          tripId={trip.id}
          initialItems={packingItems}
          customItems={customItems}
          canRegenerate={isOwner}
          canEdit={isOwner}
          listSource={listSource}
          expectPending={expectPendingPacking && packingItems.length === 0}
        />
      </main>
    </TripSceneBackgroundRoot>
  );
}
