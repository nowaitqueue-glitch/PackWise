"use client";

import { usePathname } from "next/navigation";
import { DashboardAmbientBackground } from "@/components/dashboard-ambient-background";
import { cn } from "@/lib/utils";

export function DashboardShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const isTripDetail =
    pathname != null && /^\/dashboard\/trips\/[^/]+$/.test(pathname);

  return (
    <div
      className={cn(
        "relative min-h-screen",
        // Transparent so the app-wide gradient + travel pattern shows through;
        // trip detail paints its own weather-image backdrop instead.
        !isTripDetail && "bg-transparent",
        className
      )}
    >
      {!isTripDetail ? <DashboardAmbientBackground /> : null}
      <div className="relative z-10">{children}</div>
    </div>
  );
}