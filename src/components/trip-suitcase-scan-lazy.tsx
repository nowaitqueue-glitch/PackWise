"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/** Client-only lazy wrapper so trip detail can use `ssr: false`. */
export const TripSuitcaseScan = dynamic(
  () =>
    import("@/components/trip-suitcase-scan").then((m) => ({
      default: m.TripSuitcaseScan,
    })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-48 w-full" />,
  }
);
