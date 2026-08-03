import { Skeleton } from "@/components/ui/skeleton";
import { cn, glassCard } from "@/lib/utils";

/** Field counts per glass section: destination, dates, trip details. */
const SECTIONS = [2, 1, 2];

export default function NewTripLoading() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-40" />
        <div className="space-y-2">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-5 w-64 max-w-full" />
        </div>
      </div>

      <div className="flex flex-col gap-5 sm:gap-6">
        {SECTIONS.map((fields, section) => (
          <div
            key={section}
            className={cn(glassCard, "flex flex-col gap-5 p-5 sm:p-6")}
          >
            <Skeleton className="h-6 w-32" />
            {Array.from({ length: fields }, (_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ))}
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    </main>
  );
}
