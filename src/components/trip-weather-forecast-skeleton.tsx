import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, glassCardHover, solidContentCard } from "@/lib/utils";

function DayForecastCardSkeleton() {
  return (
    <div
      className={cn(
        "flex min-w-[8.5rem] shrink-0 flex-col items-center gap-2 px-3 py-4 sm:min-w-[9.5rem]",
        solidContentCard
      )}
    >
      <Skeleton className="h-4 w-12" />
      <Skeleton className="h-3 w-14" />
      <Skeleton className="h-4 w-14 rounded-full" />
      <Skeleton className="size-8 rounded-full" />
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-5 w-16" />
      <Skeleton className="h-3 w-12" />
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
    <Card
      className={cn("w-full", solidContentCard, glassCardHover)}
      aria-busy="true"
      aria-label="Loading weather forecast"
    >
      <CardHeader className="space-y-2">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-52" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="snap-rail no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 py-1">
          {Array.from({ length: dayCount }, (_, index) => (
            <DayForecastCardSkeleton key={index} />
          ))}
        </div>
        <Skeleton className="h-3 w-48" />
      </CardContent>
    </Card>
  );
}
