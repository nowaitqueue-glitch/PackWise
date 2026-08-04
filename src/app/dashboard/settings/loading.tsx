import { Skeleton } from "@/components/ui/skeleton";
import { cn, glassCard } from "@/lib/utils";

export default function SettingsLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:py-12">
      <header className="mb-8 flex flex-col gap-4 sm:mb-10">
        <Skeleton className="h-11 w-44" />
        <div className="space-y-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>
      </header>

      <div className="space-y-6">
        {Array.from({ length: 4 }, (_, index) => (
          <section
            key={index}
            className={cn(glassCard, "p-5 sm:p-6")}
            aria-hidden
          >
            <div className="flex items-start gap-3">
              <Skeleton className="size-10 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-56 max-w-full" />
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-3/4 rounded-xl" />
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}