import Link from "next/link";
import { Plus, Settings } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn, glassChip, glassHeader } from "@/lib/utils";

type DashboardHeaderProps = {
  email?: string | null;
};

export function DashboardHeader({ email }: DashboardHeaderProps) {
  return (
    <header className={cn("sticky top-0 z-40", glassHeader)}>
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        <BrandLogo href="/dashboard" />

        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="shrink-0 px-3 sm:px-4">
            <Link
              href="/dashboard/new-trip"
              data-tour="onboarding-new-trip"
              aria-label="New trip"
            >
              <Plus aria-hidden />
              <span className="hidden sm:inline">New trip</span>
            </Link>
          </Button>

          {/* Account cluster: identity + preferences + session, grouped in one frosted shell. */}
          <div
            className={cn(
              "flex items-center gap-0.5 p-1 shadow-sm",
              glassChip
            )}
          >
            {email ? (
              <span
                className="hidden max-w-[7rem] truncate px-2 text-xs font-medium text-muted-foreground sm:inline lg:max-w-[12rem]"
                title={email}
              >
                {email}
              </span>
            ) : null}
            <ThemeToggle />
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11 rounded-full p-2"
            >
              <Link href="/dashboard/settings" aria-label="Settings">
                <Settings className="size-4" aria-hidden />
              </Link>
            </Button>
            <LogoutButton className="rounded-full" />
          </div>
        </div>
      </div>
    </header>
  );
}
