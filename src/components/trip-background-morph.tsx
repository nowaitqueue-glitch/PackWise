"use client";

import { motion } from "framer-motion";
import { getTripSceneBackground } from "@/lib/trip-scene-background";
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
  const imageUrl = getTripSceneBackground({ tripType, condition });

  return (
    <>
      <motion.div
        layoutId={`trip-bg-${tripId}`}
        aria-hidden
        style={{ backgroundImage: `url('${imageUrl}')` }}
        className={cn(
          "pointer-events-none bg-cover bg-center transition-all duration-1000",
          variant === "card" && "absolute inset-0 z-0 rounded-[inherit]",
          variant === "page" &&
            "absolute inset-0 -z-10 min-h-[calc(100vh-3.5rem)]",
          className
        )}
        transition={{ type: "spring", stiffness: 350, damping: 35 }}
      />
      {variant === "page" ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 min-h-[calc(100vh-3.5rem)] bg-black/40 transition-all duration-1000"
        />
      ) : null}
    </>
  );
}
