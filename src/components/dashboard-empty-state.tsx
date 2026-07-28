import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function DashboardEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 px-4 py-16 text-center sm:py-24">
      <Image
        src="/images/empty-suitcase.png"
        alt=""
        width={300}
        height={300}
        className="mx-auto h-auto w-full max-w-[300px] animate-in fade-in duration-700"
        aria-hidden
        priority
      />
      <div className="max-w-sm space-y-2">
        <p className="text-xl font-semibold tracking-tight text-foreground">
          No trips yet — plan your first getaway!
        </p>
        <p className="text-sm text-muted-foreground">
          Create a trip to generate a packing list and weather forecast.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard/new-trip" data-tour="onboarding-new-trip">
          Create your first trip
        </Link>
      </Button>
    </div>
  );
}
