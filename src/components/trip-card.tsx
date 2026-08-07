import Link from "next/link";
import { CalendarDays, Check, MapPin, Users } from "lucide-react";
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
  /** Fade-out in progress (dashboard optimistic delete). */
  isRemoving?: boolean;
  /** Start list fade-out / optimistic hide (dashboard grid). */
  onOptimisticRemove?: () => void;
  /** Undo optimistic hide if the server delete fails. */
  onOptimisticRestore?: () => void;
  /** Dashboard multi-select mode. */
  isSelectionMode?: boolean;
  isSelected?: boolean;
  /** When set, card tap toggles selection instead of navigating. */
  onToggleSelect?: () => void;
};

export function TripCard({
  trip,
  weather = null,
  packing = null,
  completed = false,
  onboardingAnchors = false,
  chipsPending = false,
  isRemoving = false,
  onOptimisticRemove,
  onOptimisticRestore,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
}: TripCardProps) {
  const showPacking = packing != null && packing.total > 0;
  const selectable = isSelectionMode && Boolean(onToggleSelect);
  const selectLabel = isSelected
    ? `Deselect trip to ${trip.destination}`
    : `Select trip to ${trip.destination}`;

  return (
    <Card
      className={cn(
        "relative flex h-full cursor-pointer flex-col overflow-hidden transition-[box-shadow,border-color,transform,opacity] duration-300 ease-out",
        glassCard,
        !isSelectionMode && glassCardHover,
        completed && !isRemoving && "opacity-75",
        isRemoving && "pointer-events-none",
        isSelectionMode &&
          "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200",
        isSelected &&
          "border-brand-from/50 ring-2 ring-brand-from/40 dark:border-brand-from/40 dark:ring-brand-from/30",
        isSelectionMode &&
          !selectable &&
          "cursor-default opacity-60"
      )}
      aria-hidden={isRemoving || undefined}
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
      {selectable ? (
        <button
          type="button"
          className="absolute inset-0 z-[1] rounded-[inherit]"
          aria-label={selectLabel}
          aria-pressed={isSelected}
          onClick={onToggleSelect}
        />
      ) : !isSelectionMode ? (
        <Link
          href={`/dashboard/trips/${trip.id}`}
          className="absolute inset-0 z-[1] rounded-[inherit]"
          aria-label={`Open trip to ${trip.destination}`}
        />
      ) : null}
      {isSelectionMode ? (
        <span
          className={cn(
            "pointer-events-none absolute top-3 left-3 z-10 flex size-11 items-center justify-center",
            "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-200"
          )}
          aria-hidden
        >
          <span
            className={cn(
              "grid size-6 place-content-center rounded-full border-2 shadow-sm backdrop-blur-sm transition-all",
              isSelected
                ? "border-transparent bg-gradient-to-br from-brand-from to-brand-to text-white"
                : "border-brand-from/50 bg-white/80 dark:bg-slate-900/70",
              !selectable && "opacity-40"
            )}
          >
            {isSelected ? <Check className="size-3.5" strokeWidth={3} /> : null}
          </span>
        </span>
      ) : (
        <DeleteTripButton
          tripId={trip.id}
          isOwner={trip.isOwner}
          onOptimisticRemove={onOptimisticRemove}
          onOptimisticRestore={onOptimisticRestore}
        />
      )}
      <CardHeader
        className={cn(
          "pointer-events-none relative z-[1] space-y-2 p-5 pb-3",
          trip.isOwner && !isSelectionMode && "pr-11",
          isSelectionMode && "pl-14"
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
      <CardFooter
        className={cn(
          "relative z-[1] flex flex-wrap gap-2 p-5 pt-0",
          isSelectionMode && "pointer-events-none opacity-50"
        )}
      >
        <DuplicateTripButton tripId={trip.id} />
      </CardFooter>
    </Card>
  );
}