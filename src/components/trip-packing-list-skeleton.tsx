import { Skeleton } from "@/components/ui/skeleton";
import { cn, solidContentCard } from "@/lib/utils";

function PackingPanelSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <section className={cn("relative overflow-hidden", solidContentCard)}>
      <div className="relative z-10 flex flex-col gap-4 p-5 sm:p-6">
        {children}
      </div>
    </section>
  );
}

function PackingItemRowSkeleton() {
  return (
    <li className="flex min-h-11 items-center gap-3 px-2 py-1.5">
      <Skeleton className="size-5 shrink-0 rounded-md" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    </li>
  );
}

function PackingCategorySkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <PackingPanelSkeleton>
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <ul className="-mx-2 flex flex-col">
        {Array.from({ length: rows }, (_, index) => (
          <PackingItemRowSkeleton key={index} />
        ))}
      </ul>
    </PackingPanelSkeleton>
  );
}

export function TripPackingListSkeleton() {
  return (
    <div
      className="flex w-full flex-col gap-4"
      aria-busy="true"
      aria-label="Loading packing list"
      data-testid="packing-list-skeleton"
    >
      <PackingPanelSkeleton>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-9 w-28 shrink-0 rounded-lg" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-2.5 w-full rounded-full" />
        </div>
      </PackingPanelSkeleton>
      <PackingCategorySkeleton rows={4} />
      <PackingCategorySkeleton rows={3} />
      <PackingCategorySkeleton rows={3} />
    </div>
  );
}
