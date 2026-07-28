import Link from "next/link";
import { Settings } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

type DashboardHeaderProps = {
  email?: string | null;
};

export function DashboardHeader({ email }: DashboardHeaderProps) {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-4">
          <BrandLogo href="/dashboard" />
          {email ? (
            <span className="hidden truncate text-sm text-muted-foreground sm:inline">
              {email}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/settings" aria-label="Settings">
              <Settings className="size-4" aria-hidden />
              <span className="hidden sm:inline">Settings</span>
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/new-trip" data-tour="onboarding-new-trip">
              New trip
            </Link>
          </Button>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
