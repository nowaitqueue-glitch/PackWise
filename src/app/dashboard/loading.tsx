import { TripCardGridSkeleton } from "@/components/trip-card-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-28 sm:px-6 sm:pt-10 sm:pb-12 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-10 w-56 rounded-xl" />
          <Skeleton className="h-4 w-72 max-w-full rounded-lg" />
        </div>
        <Skeleton className="hidden h-10 w-40 shrink-0 rounded-xl sm:block" />
      </div>
      <TripCardGridSkeleton />
    </main>
  );
}
