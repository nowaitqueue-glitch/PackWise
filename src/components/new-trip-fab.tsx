"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NewTripFabProps = {
  className?: string;
};

function shouldHideFab(pathname: string | null): boolean {
  if (!pathname) return false;
  if (pathname === "/dashboard/new-trip") return true;
  return /^\/dashboard\/trips\/[^/]+\/edit\/?$/.test(pathname);
}

export function NewTripFab({ className }: NewTripFabProps) {
  const pathname = usePathname();
  if (shouldHideFab(pathname)) {
    return null;
  }

  return (
    <Button
      asChild
      size="icon"
      className={cn(
        "fixed z-50 h-14 w-14 rounded-full shadow-xl shadow-brand-from/25 hover:scale-105 hover:shadow-2xl active:scale-95",
        "bottom-[calc(var(--consent-h,0px)_+_env(safe-area-inset-bottom,0px)_+_1.5rem)] right-[max(1.5rem,env(safe-area-inset-right))]",
        // Mobile-only: the header exposes "New trip" from sm: up.
        "sm:hidden",
        "[&_svg]:size-6",
        className
      )}
    >
      <Link href="/dashboard/new-trip" aria-label="Create new trip">
        <Plus aria-hidden />
      </Link>
    </Button>
  );
}
