import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, glassChip, glassHeader } from "@/lib/utils";

export function GuestHeader() {
  return (
    <header className={cn("sticky top-0 z-40", glassHeader)}>
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <BrandLogo href="/dashboard/guest" />
          <Badge variant="secondary" className="font-medium text-muted-foreground">
            Guest
          </Badge>
        </div>

        {/* Mirrors the dashboard header's frosted account cluster. */}
        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="shrink-0">
            <Link href="/signup?from=guest">Create account</Link>
          </Button>
          <div className={cn("flex items-center gap-0.5 p-1 shadow-sm", glassChip)}>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
