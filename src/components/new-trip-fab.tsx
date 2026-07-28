"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NewTripFabProps = {
  className?: string;
};

export function NewTripFab({ className }: NewTripFabProps) {
  return (
    <Button
      asChild
      size="icon"
      className={cn(
        "fixed z-50 h-14 w-14 rounded-full shadow-lg transition-transform hover:scale-105 hover:shadow-xl active:scale-95",
        "bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-[max(1.5rem,env(safe-area-inset-right))]",
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
