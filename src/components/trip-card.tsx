import Link from "next/link";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { DeleteTripButton } from "@/components/delete-trip-button";
import { DuplicateTripButton } from "@/components/duplicate-trip-button";
import { WeatherConditionIcon } from "@/components/weather-condition-icon";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TripBackgroundMorph } from "@/components/trip-background-morph";
import { formatTripType } from "@/lib/trips";
import type { TripWeatherSummary } from "@/lib/trip-weather-cache";
import { cn } from "@/lib/utils";

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
  /** First card only — anchors for the one-time dashboard tour. */
  onboardingAnchors?: boolean;
};

export function TripCard({
  trip,
  weather = null,
  onboardingAnchors = false,
}: TripCardProps) {
  return (
    <Card
      className="relative flex h-full cursor-pointer flex-col overflow-hidden border-white/20 bg-card/80 backdrop-blur-sm transition-all hover:-translate-y-1 hover:scale-[1.01] hover:border-foreground/20 hover:shadow-lg"
      data-tour={onboardingAnchors ? "onboarding-packing" : undefined}
    >
      <TripBackgroundMorph
        tripId={trip.id}
        tripType={trip.trip_type}
        variant="card"
      />
      <Link
        href={`/dashboard/trips/${trip.id}`}
        className="absolute inset-0 z-[1] rounded-[inherit]"
        aria-label={`Open trip to ${trip.destination}`}
      />
      <DeleteTripButton tripId={trip.id} isOwner={trip.isOwner} />
      <CardHeader
        className={cn(
          "pointer-events-none relative z-[1] space-y-2",
          trip.isOwner && "pr-9"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="line-clamp-2 font-bold text-2xl tracking-tight">
            {trip.destination}
          </CardTitle>
          <div
            className="flex shrink-0 flex-col items-end gap-1.5"
            data-tour={onboardingAnchors ? "onboarding-forecast" : undefined}
          >
            {!trip.isOwner ? (
              <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                Shared
              </span>
            ) : null}
            {weather ? (
              <Badge
                variant="secondary"
                className="gap-1 border-border/60 bg-muted/70 font-normal text-muted-foreground shadow-none"
                title={`High ${weather.highTemp}° / low ${weather.lowTemp}°`}
              >
                <WeatherConditionIcon
                  condition={weather.condition}
                  className="size-3.5 shrink-0"
                />
                <span className="tabular-nums text-foreground/80">
                  {weather.highTemp}°
                </span>
                <span className="capitalize">{weather.condition}</span>
              </Badge>
            ) : null}
          </div>
        </div>
        <CardDescription className="flex items-center gap-1.5">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          {formatTripType(trip.trip_type)}
        </CardDescription>
      </CardHeader>
      <CardContent className="pointer-events-none relative z-[1] flex flex-1 flex-col gap-2 text-sm text-muted-foreground">
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
      </CardContent>
      <CardFooter className="relative z-[1] flex flex-wrap gap-2">
        <DuplicateTripButton tripId={trip.id} />
      </CardFooter>
    </Card>
  );
}
