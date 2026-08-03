import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { DashboardEmptyState } from "@/components/dashboard-empty-state";
import { DashboardOnboarding } from "@/components/dashboard-onboarding";
import { createClient } from "@/lib/supabase/server";
import {
  getDashboardPackingProgressMap,
  type TripPackingProgress,
} from "@/lib/dashboard-packing-progress";
import {
  getDashboardTripWeatherMap,
  type TripWeatherSummary,
} from "@/lib/trip-weather-cache";
import { TripCard, type UpcomingTrip } from "@/components/trip-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn, glassCard, pageTitleClass, sectionTitleClass } from "@/lib/utils";

function TripsGrid({
  trips,
  weatherByTripId,
  packingByTripId,
  completed = false,
}: {
  trips: UpcomingTrip[];
  weatherByTripId: Map<string, TripWeatherSummary>;
  packingByTripId: Map<string, TripPackingProgress>;
  completed?: boolean;
}) {
  return (
    <ul className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {trips.map((trip, index) => (
        <li key={trip.id}>
          <TripCard
            trip={trip}
            weather={weatherByTripId.get(trip.id) ?? null}
            packing={packingByTripId.get(trip.id) ?? null}
            completed={completed}
            onboardingAnchors={!completed && index === 0}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * Streams weather chips + packing progress into the trip grid. Cache lookups
 * and any Open-Meteo refetches run here so they never block the initial
 * dashboard HTML — cards render instantly via the <Suspense> fallback, then
 * swap in once extras resolve.
 */
async function TripsGridWithExtras({
  trips,
  completed = false,
}: {
  trips: UpcomingTrip[];
  completed?: boolean;
}) {
  const supabase = await createClient();
  const tripIds = trips.map((trip) => trip.id);
  const [weatherByTripId, packingByTripId] = await Promise.all([
    getDashboardTripWeatherMap(supabase, trips),
    getDashboardPackingProgressMap(supabase, tripIds),
  ]);
  return (
    <TripsGrid
      trips={trips}
      weatherByTripId={weatherByTripId}
      packingByTripId={packingByTripId}
      completed={completed}
    />
  );
}

function todayISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Inclusive lower bound: trips that ended within the last ~6 months. */
function sixMonthsAgoISODate(): string {
  const now = new Date();
  now.setMonth(now.getMonth() - 6);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function mapTrips(
  rows: Array<{
    id: string;
    user_id: string;
    destination: string;
    start_date: string;
    end_date: string;
    trip_type: string;
    travelers: number;
  }> | null,
  userId: string
): UpcomingTrip[] {
  return (rows ?? []).map((trip) => ({
    ...trip,
    isOwner: trip.user_id === userId,
  }));
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const today = todayISODate();
  const pastCutoff = sixMonthsAgoISODate();

  const [
    { data: upcomingData, error: upcomingError },
    { data: pastData, error: pastError },
    { data: profile, error: profileError },
  ] = await Promise.all([
    // RLS returns owned + member trips; upcoming = not yet ended
    supabase
      .from("trips")
      .select(
        "id, user_id, destination, start_date, end_date, trip_type, travelers"
      )
      .gte("end_date", today)
      .order("start_date", { ascending: true }),
    supabase
      .from("trips")
      .select(
        "id, user_id, destination, start_date, end_date, trip_type, travelers"
      )
      .lt("end_date", today)
      .gte("end_date", pastCutoff)
      .order("end_date", { ascending: false }),
    supabase
      .from("profiles")
      .select("has_seen_onboarding")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const trips = mapTrips(upcomingData, user.id);
  const pastTrips = mapTrips(pastData, user.id);
  const error = upcomingError ?? pastError;

  // Skip tour if the flag can't be read (e.g. migration not applied yet).
  const hasSeenOnboarding =
    profileError != null
      ? true
      : Boolean(
          (profile as { has_seen_onboarding?: boolean } | null)
            ?.has_seen_onboarding
        );

  const emptyMaps = {
    weather: new Map<string, TripWeatherSummary>(),
    packing: new Map<string, TripPackingProgress>(),
  };

  return (
    <main className="relative mx-auto w-full max-w-5xl px-4 pt-8 pb-28 sm:px-6 sm:pt-10 sm:pb-12 lg:px-8">
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 rounded-3xl backdrop-blur-sm",
          "bg-white/30 dark:bg-slate-950/30"
        )}
      />
      {!hasSeenOnboarding ? (
        <DashboardOnboarding hasTrips={trips.length > 0} />
      ) : null}
      <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <h1 className={pageTitleClass}>Upcoming trips</h1>
          <p className="max-w-prose text-sm text-muted-foreground sm:text-base">
            Trips you own or that were shared with you, sorted by start date.
          </p>
        </div>
        <Button asChild className="hidden shrink-0 sm:inline-flex">
          <Link href="/dashboard/new-trip" data-tour="onboarding-new-trip">
            Create a new trip
          </Link>
        </Button>
      </div>

      {error ? (
        <Card className={glassCard}>
          <CardHeader>
            <CardTitle className="text-xl">Could not load trips</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : trips.length === 0 ? (
        <DashboardEmptyState />
      ) : (
        <Suspense
          fallback={
            <TripsGrid
              trips={trips}
              weatherByTripId={emptyMaps.weather}
              packingByTripId={emptyMaps.packing}
            />
          }
        >
          <TripsGridWithExtras trips={trips} />
        </Suspense>
      )}

      {!error && pastTrips.length > 0 ? (
        <details className="group mt-10 sm:mt-12">
          <summary
            className={cn(
              "flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-1 py-2",
              "marker:content-none [&::-webkit-details-marker]:hidden",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
          >
            <div>
              <h2 className={sectionTitleClass}>
                <span className="group-open:hidden">View past trips</span>
                <span className="hidden group-open:inline">Past trips</span>
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Completed in the last 6 months · {pastTrips.length}{" "}
                {pastTrips.length === 1 ? "trip" : "trips"}
              </p>
            </div>
            <ChevronDown
              className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="mt-4">
            <Suspense
              fallback={
                <TripsGrid
                  trips={pastTrips}
                  weatherByTripId={emptyMaps.weather}
                  packingByTripId={emptyMaps.packing}
                  completed
                />
              }
            >
              <TripsGridWithExtras trips={pastTrips} completed />
            </Suspense>
          </div>
        </details>
      ) : null}
    </main>
  );
}
