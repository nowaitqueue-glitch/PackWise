import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardEmptyState } from "@/components/dashboard-empty-state";
import { DashboardOnboarding } from "@/components/dashboard-onboarding";
import { createClient } from "@/lib/supabase/server";
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

function TripsGrid({
  trips,
  weatherByTripId,
}: {
  trips: UpcomingTrip[];
  weatherByTripId: Map<string, TripWeatherSummary>;
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {trips.map((trip, index) => (
        <li key={trip.id}>
          <TripCard
            trip={trip}
            weather={weatherByTripId.get(trip.id) ?? null}
            onboardingAnchors={index === 0}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * Streams weather chips into the trip grid. The cache lookup (single batched
 * query) plus any Open-Meteo refetches for stale/missing entries run here so
 * they never block the initial dashboard HTML — cards render instantly via the
 * <Suspense> fallback, then swap in with chips once weather resolves.
 */
async function TripsGridWithWeather({ trips }: { trips: UpcomingTrip[] }) {
  const supabase = await createClient();
  const weatherByTripId = await getDashboardTripWeatherMap(supabase, trips);
  return <TripsGrid trips={trips} weatherByTripId={weatherByTripId} />;
}

function todayISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

  const [
    { data: tripsData, error },
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
      .from("profiles")
      .select("has_seen_onboarding")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const trips: UpcomingTrip[] = (tripsData ?? []).map((trip) => ({
    ...trip,
    isOwner: trip.user_id === user.id,
  }));

  // Skip tour if the flag can't be read (e.g. migration not applied yet).
  const hasSeenOnboarding =
    profileError != null
      ? true
      : Boolean(
          (profile as { has_seen_onboarding?: boolean } | null)
            ?.has_seen_onboarding
        );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      {!hasSeenOnboarding ? (
        <DashboardOnboarding hasTrips={trips.length > 0} />
      ) : null}
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Upcoming trips
          </h1>
          <p className="text-sm text-muted-foreground">
            Trips you own or that were shared with you, sorted by start date.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/new-trip" data-tour="onboarding-new-trip">
            Create a new trip
          </Link>
        </Button>
      </div>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Could not load trips</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : trips.length === 0 ? (
        <DashboardEmptyState />
      ) : (
        <Suspense fallback={<TripsGrid trips={trips} weatherByTripId={new Map()} />}>
          <TripsGridWithWeather trips={trips} />
        </Suspense>
      )}
    </main>
  );
}
