import Link from "next/link";
import { Luggage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, glassCard, travelGradient } from "@/lib/utils";

type DashboardEmptyStateProps = {
  createHref?: string;
};

export function DashboardEmptyState({
  createHref = "/dashboard/new-trip",
}: DashboardEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-6 px-6 py-14 text-center sm:px-10 sm:py-20",
        glassCard
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-24 items-center justify-center rounded-full text-white shadow-lg sm:size-28",
          travelGradient
        )}
      >
        <Luggage className="size-12 sm:size-14" strokeWidth={1.5} />
      </span>
      <div className="max-w-sm space-y-2">
        <p className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          No trips yet — plan your first getaway!
        </p>
        <p className="text-sm text-muted-foreground">
          Create a trip to generate a packing list and weather forecast.
        </p>
      </div>
      <Button asChild size="lg">
        <Link href={createHref} data-tour="onboarding-new-trip">
          Create your first trip
        </Link>
      </Button>
    </div>
  );
}
