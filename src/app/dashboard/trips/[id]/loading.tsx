import { TripPackingListSkeleton } from "@/components/trip-packing-list-skeleton";
import { TripSceneBackgroundRoot } from "@/components/trip-scene-background";
import { TripWeatherForecastSkeleton } from "@/components/trip-weather-forecast-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, glassCard } from "@/lib/utils";

function TripDetailsSkeleton() {
  return (
    <section className={cn("relative overflow-hidden", glassCard)}>
      <div className="relative z-10 flex flex-col gap-6 p-5 sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Skeleton className="h-9 w-52" />
            <Skeleton className="h-6 w-24 shrink-0 rounded-full" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-44 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-10 w-32 rounded-xl" />
            <Skeleton className="h-10 w-36 rounded-xl" />
          </div>
          <Skeleton className="h-10 w-full rounded-xl" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Skeleton className="h-10 w-full rounded-xl sm:flex-1" />
            <Skeleton className="h-10 w-full rounded-xl sm:flex-1" />
          </div>
          <div className="flex flex-col gap-2 border-t border-white/40 pt-3 sm:flex-row dark:border-white/10">
            <Skeleton className="h-10 w-full rounded-xl sm:flex-1" />
            <Skeleton className="h-10 w-full rounded-xl sm:flex-1" />
          </div>
        </div>
      </div>
    </section>
  );
}

export default function TripDetailLoading() {
  return (
    <TripSceneBackgroundRoot tripType="leisure">
      <main
        className="relative mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10"
        aria-busy="true"
        aria-label="Loading trip"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-3xl bg-gradient-to-t from-black/60 to-black/20"
        />
        <TripDetailsSkeleton />
        <TripWeatherForecastSkeleton />
        <TripPackingListSkeleton />
      </main>
    </TripSceneBackgroundRoot>
  );
}
