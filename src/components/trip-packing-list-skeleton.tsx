import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function PackingItemRowSkeleton() {
  return (
    <li className="flex items-start gap-3 border-b border-border pb-2 last:border-0 last:pb-0">
      <Skeleton className="mt-0.5 size-5 shrink-0 rounded-md" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    </li>
  );
}

function PackingCategorySkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <section className="flex flex-col gap-3">
      <Skeleton className="h-4 w-24" />
      <ul className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, index) => (
          <PackingItemRowSkeleton key={index} />
        ))}
      </ul>
    </section>
  );
}

export function TripPackingListSkeleton() {
  return (
    <Card
      className="w-full"
      aria-busy="true"
      aria-label="Loading packing list"
      data-testid="packing-list-skeleton"
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-8 w-24 shrink-0" />
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <PackingCategorySkeleton rows={4} />
        <PackingCategorySkeleton rows={3} />
        <PackingCategorySkeleton rows={3} />
      </CardContent>
    </Card>
  );
}
