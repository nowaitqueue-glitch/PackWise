"use client";

import { motion } from "framer-motion";
import { resolveTripDetailPageBackground } from "@/lib/trip-scene-background";
import { cn } from "@/lib/utils";

type TripBackgroundMorphProps = {
  tripId: string;
  tripType: string;
  /** First-day weather condition when known; cards omit this (trip-type only). */
  condition?: string | null;
  variant: "card" | "page";
  className?: string;
};

export function TripBackgroundMorph({
  tripId,
  tripType,
  condition = null,
  variant,
  className,
}: TripBackgroundMorphProps) {
  const background = resolveTripDetailPageBackground({
    tripType,
    conditions: condition && condition.trim() ? [condition.trim()] : [],
  });

  if (variant !== "card") return null;

  if (background.kind === "image") {
    return (
      <motion.div
        layoutId={`trip-bg-${tripId}`}
        aria-hidden
        style={{ backgroundImage: `url('${background.src}')` }}
        className={cn(
          "pointer-events-none absolute inset-0 z-0 rounded-[inherit] bg-cover bg-center transition-all duration-1000",
          className
        )}
        transition={{ type: "spring", stiffness: 350, damping: 35 }}
      />
    );
  }

  const gradientClass =
    background.variant === "business"
      ? "trip-detail-gradient-bg-business"
      : background.variant === "city_break"
        ? "trip-detail-gradient-bg-city-break"
        : "trip-detail-gradient-bg";
  const showGeoGrid =
    background.variant === "business" || background.variant === "city_break";

  return (
    <motion.div
      layoutId={`trip-bg-${tripId}`}
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit] transition-all duration-1000",
        gradientClass,
        className
      )}
      transition={{ type: "spring", stiffness: 350, damping: 35 }}
    >
      {showGeoGrid ? (
        <div
          aria-hidden
          className="trip-detail-geo-grid pointer-events-none absolute inset-0 rounded-[inherit]"
        />
      ) : null}
    </motion.div>
  );
}
