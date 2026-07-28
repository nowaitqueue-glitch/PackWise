import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function DayForecastCardSkeleton() {
  return (
    <div className="min-w-[100px] shrink-0 snap-start rounded-lg border border-border/80 bg-muted/30 px-3 py-3 text-center">
      <Skeleton className="mx-auto h-3 w-14" />
      <Skeleton className="mx-auto mt-0.5 h-2.5 w-10" />
      <Skeleton className="mx-auto mt-2 size-7 rounded-full" />
      <Skeleton className="mx-auto mt-2 h-3 w-16" />
      <Skeleton className="mx-auto mt-1 h-4 w-12" />
      <Skeleton className="mx-auto mt-1 h-3 w-10" />
    </div>
  );
}

type TripWeatherForecastSkeletonProps = {
  dayCount?: number;
};

export function TripWeatherForecastSkeleton({
  dayCount = 5,
}: TripWeatherForecastSkeletonProps) {
  return (
    <Card className="w-full" aria-busy="true" aria-label="Loading weather forecast">
      <CardHeader className="space-y-2">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-52" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth rounded-2xl border border-white/20 bg-white/30 p-3 pb-2 backdrop-blur-md dark:border-white/10 dark:bg-white/10">
          {Array.from({ length: dayCount }, (_, index) => (
            <DayForecastCardSkeleton key={index} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
