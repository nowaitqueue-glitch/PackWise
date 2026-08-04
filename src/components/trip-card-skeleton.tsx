import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, glassCard, glassContentOverlay } from "@/lib/utils";

export function TripCardSkeleton() {
  return (
    <Card
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-2xl",
        glassCard
      )}
    >
      <div aria-hidden className={glassContentOverlay} />
      <CardHeader className="relative z-10 space-y-2 p-5 pr-11 pb-3">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-8 w-3/5 rounded-lg" />
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span
              aria-hidden
              className="h-4 w-16 animate-pulse rounded bg-slate-900/10 dark:bg-white/10"
            />
          </div>
        </div>
        <Skeleton className="h-4 w-28 rounded-lg" />
      </CardHeader>
      <CardContent className="relative z-10 flex flex-1 flex-col gap-2 p-5 pt-0">
        <Skeleton className="h-4 w-4/5 rounded-lg" />
        <Skeleton className="h-4 w-2/5 rounded-lg" />
        <span
          aria-hidden
          className="mt-1 h-4 w-16 animate-pulse rounded bg-slate-900/10 dark:bg-white/10"
        />
      </CardContent>
      <CardFooter className="relative z-10 flex flex-wrap gap-2 p-5 pt-0">
        <Skeleton className="h-9 w-32 rounded-lg" />
      </CardFooter>
    </Card>
  );
}

type TripCardGridSkeletonProps = {
  count?: number;
};

export function TripCardGridSkeleton({ count = 6 }: TripCardGridSkeletonProps) {
  return (
    <ul
      className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-label="Loading trips"
    >
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          <TripCardSkeleton />
        </li>
      ))}
    </ul>
  );
}
