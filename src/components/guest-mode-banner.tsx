import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, travelGradient } from "@/lib/utils";

type GuestModeBannerProps = {
  showSaveCta?: boolean;
};

export function GuestModeBanner({ showSaveCta = false }: GuestModeBannerProps) {
  return (
    <div
      role="status"
      className={cn("relative text-white shadow-md", travelGradient)}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="flex items-start gap-2 text-sm font-medium leading-relaxed sm:items-center">
          <Sparkles className="mt-0.5 size-4 shrink-0 sm:mt-0" aria-hidden />
          <span>
            You&apos;re using a guest demo — create a free account to save your
            trips and unlock all features.
          </span>
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:self-auto">
          <Button
            asChild
            size="sm"
            variant="secondary"
            className="border-transparent bg-white text-blue-600 shadow-sm backdrop-blur-none hover:bg-white/90 hover:shadow-md dark:border-transparent dark:bg-white dark:text-blue-700 dark:hover:bg-white/90"
          >
            <Link href="/signup?from=guest">Create free account</Link>
          </Button>
          {showSaveCta ? (
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/20 hover:text-white"
            >
              <Link href="/signup?from=guest">Save my trip</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
