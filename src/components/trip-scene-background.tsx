"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { TripBackgroundMorph } from "@/components/trip-background-morph";

type TripSceneConditionContextValue = {
  setCondition: (condition: string | null) => void;
};

const TripSceneConditionContext =
  createContext<TripSceneConditionContextValue | null>(null);

type TripSceneBackgroundRootProps = {
  tripId: string;
  tripType: string;
  /** First-day condition from a fast cache peek (no Open-Meteo). */
  initialCondition?: string | null;
  children: ReactNode;
};

/**
 * Page shell: shared-layout image background + optional weather condition updates
 * once the Suspense weather section resolves.
 */
export function TripSceneBackgroundRoot({
  tripId,
  tripType,
  initialCondition = null,
  children,
}: TripSceneBackgroundRootProps) {
  const [condition, setCondition] = useState<string | null>(initialCondition);

  return (
    <TripSceneConditionContext.Provider value={{ setCondition }}>
      <div className="relative min-h-[calc(100vh-3.5rem)]">
        <TripBackgroundMorph
          tripId={tripId}
          tripType={tripType}
          condition={condition}
          variant="page"
        />
        {children}
      </div>
    </TripSceneConditionContext.Provider>
  );
}

/**
 * Render from the streamed weather tree to upgrade the scene once a real
 * first-day condition is known (no-op when weather failed / unavailable).
 */
export function TripSceneConditionSync({
  condition,
}: {
  condition: string | null;
}) {
  const ctx = useContext(TripSceneConditionContext);

  useEffect(() => {
    if (!ctx || !condition) return;
    ctx.setCondition(condition);
  }, [condition, ctx]);

  return null;
}
