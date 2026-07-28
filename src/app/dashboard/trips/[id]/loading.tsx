import { TripPackingListSkeleton } from "@/components/trip-packing-list-skeleton";
import { TripWeatherForecastSkeleton } from "@/components/trip-weather-forecast-skeleton";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function TripDetailsSkeleton() {
  return (
    <section className="rounded-2xl border border-white/20 bg-white/30 text-foreground backdrop-blur-md dark:border-white/10 dark:bg-white/10">
      <Card className="w-full border-0 bg-transparent shadow-none">
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-5 w-16 rounded-md" />
          </div>
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <dl className="grid gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex justify-between gap-4">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export default function TripDetailLoading() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-fixed">
      <main
        className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10"
        aria-busy="true"
        aria-label="Loading trip"
      >
        <TripDetailsSkeleton />
        <TripWeatherForecastSkeleton />
        <TripPackingListSkeleton />
      </main>
    </div>
  );
}
