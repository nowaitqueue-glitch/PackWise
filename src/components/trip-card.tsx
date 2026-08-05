import Link from "next/link";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { DeleteTripButton } from "@/components/delete-trip-button";
import { DuplicateTripButton } from "@/components/duplicate-trip-button";
import { WeatherConditionIcon } from "@/components/weather-condition-icon";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TripBackgroundMorph } from "@/components/trip-background-morph";
import type { TripPackingProgress } from "@/lib/dashboard-packing-progress";
import { formatTripType } from "@/lib/trips";
import type { TripWeatherSummary } from "@/lib/trip-weather-cache";
import {
  cn,
  glassCard,
  glassCardHover,
  glassChip,
  glassContentOverlay,
  tripTitleClass,
} from "@/lib/utils";

export type UpcomingTrip = {
  id: string;
  destination: string;
  start_date: string;
  end_date: string;
  trip_type: string;
  travelers: number;
  user_id: string;
  isOwner: boolean;
};

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

type TripCardProps = {
  trip: UpcomingTrip;
  /** First-day forecast when start is within the 16-day window; omit chip when null. */
  weather?: TripWeatherSummary | null;
  /** Packing progress from the dashboard batch fetch; omit when unknown. */
  packing?: TripPackingProgress | null;
  /** Past / completed trip styling. */
  completed?: boolean;
  /** First card only — anchors for the one-time dashboard tour. */
  onboardingAnchors?: boolean;
  /** Suspense/streaming: show chip skeletons while weather/packing resolve. */
  chipsPending?: boolean;
};

export function TripCard({
  trip,
  weather = null,
  packing = null,
  completed = false,
  onboardingAnchors = false,
  chipsPending = false,
}: TripCardProps) {
  const showPacking = packing != null && packing.total > 0;

  return (
    <Card
      className={cn(
        "relative flex h-full cursor-pointer flex-col overflow-hidden",
        glassCard,
        glassCardHover,
        completed && "opacity-75"
      )}
      data-tour={onboardingAnchors ? "onboarding-packing" : undefined}
    >
      <TripBackgroundMorph
        tripId={trip.id}
        tripType={trip.trip_type}
        variant="card"
      />
      <div aria-hidden className={cn("z-0", glassContentOverlay)} />
      {/* Extra scrim: the photo stays visible up top while copy below keeps contrast. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] bg-gradient-to-t from-white/90 via-white/70 to-white/30 dark:from-slate-950/90 dark:via-slate-950/70 dark:to-slate-950/35"
      />
      <Link
        href={`/dashboard/trips/${trip.id}`}
        className="absolute inset-0 z-[1] rounded-[inherit]"
        aria-label={`Open trip to ${trip.destination}`}
      />
      <DeleteTripButton tripId={trip.id} isOwner={trip.isOwner} />
      <CardHeader
        className={cn(
          "pointer-events-none relative z-[1] space-y-2 p-5 pb-3",
          trip.isOwner && "pr-11"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <CardTitle className={cn("line-clamp-2", tripTitleClass)}>
            {trip.destination}
          </CardTitle>
          <div
            className="flex shrink-0 flex-col items-end gap-1.5"
            data-tour={onboardingAnchors ? "onboarding-forecast" : undefined}
          >
            {completed ? (
              <Badge variant="secondary" className="shadow-sm">
                Completed
              </Badge>
            ) : null}
            {!trip.isOwner ? (
              <Badge variant="secondary" className="shadow-sm">
                Shared
              </Badge>
            ) : null}
            {weather ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium shadow-sm",
                  glassChip,
                  // Stronger fill than default glassChip so copy stays readable over trip photos.
                  "bg-white/90 text-foreground dark:bg-slate-950/90 dark:text-slate-100"
                )}
                title={`High ${weather.highTemp}° / low ${weather.lowTemp}°`}
              >
                <WeatherConditionIcon
                  condition={weather.condition}
                  className="size-3.5 shrink-0 text-foreground dark:text-slate-100"
                />
                <span className="font-semibold tabular-nums text-foreground dark:text-slate-50">
                  {weather.highTemp}°
                </span>
                <span className="capitalize text-slate-600 dark:text-slate-300">
                  {weather.condition}
                </span>
              </span>
            ) : chipsPending ? (
              <span
                aria-hidden
                className="h-4 w-16 animate-pulse rounded bg-slate-900/10 dark:bg-white/10"
              />
            ) : null}
          </div>
        </div>
        <CardDescription className="flex items-center gap-1.5 font-medium">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          {formatTripType(trip.trip_type)}
        </CardDescription>
      </CardHeader>
      <CardContent className="pointer-events-none relative z-[1] flex flex-1 flex-col gap-2 p-5 pt-0 text-sm text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <CalendarDays className="size-3.5 shrink-0" aria-hidden />
          <span>{formatDateRange(trip.start_date, trip.end_date)}</span>
        </p>
        <p className="flex items-center gap-1.5">
          <Users className="size-3.5 shrink-0" aria-hidden />
          <span>
            {trip.travelers}{" "}
            {trip.travelers === 1 ? "traveler" : "travelers"}
          </span>
        </p>
        {showPacking ? (
          <div className="mt-1 flex flex-col gap-1.5">
            <Progress
              value={packing.percent}
              className="h-1.5"
              indicatorClassName="bg-travel-gradient"
              aria-label={`${packing.packed} of ${packing.total} items packed`}
            />
            <p className="text-xs font-medium tabular-nums text-muted-foreground">
              {packing.packed}/{packing.total} packed
            </p>
          </div>
        ) : chipsPending ? (
          <span
            aria-hidden
            className="mt-1 h-4 w-16 animate-pulse rounded bg-slate-900/10 dark:bg-white/10"
          />
        ) : null}
      </CardContent>
      <CardFooter className="relative z-[1] flex flex-wrap gap-2 p-5 pt-0">
        <DuplicateTripButton tripId={trip.id} />
      </CardFooter>
    </Card>
  );
}
