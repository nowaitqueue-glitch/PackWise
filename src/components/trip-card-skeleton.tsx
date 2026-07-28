import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function TripCardSkeleton() {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-2 pr-9">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-8 w-3/5" />
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Skeleton className="h-5 w-14 rounded-md" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-4 w-28" />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-2/5" />
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-full sm:w-36" />
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
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
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
