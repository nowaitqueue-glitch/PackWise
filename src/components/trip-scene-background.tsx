"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  resolveTripDetailPageBackground,
  tripDetailBackgroundKey,
  type TripDetailBackground,
} from "@/lib/trip-scene-background";
import { cn } from "@/lib/utils";

type TripSceneBackgroundContextValue = {
  setForecastConditions: (conditions: string[]) => void;
};

const TripSceneBackgroundContext =
  createContext<TripSceneBackgroundContextValue | null>(null);

function backgroundFromProps(
  tripType: string,
  initialCondition?: string | null
): TripDetailBackground {
  const seed =
    initialCondition && initialCondition.trim()
      ? [initialCondition.trim()]
      : [];
  return resolveTripDetailPageBackground({ tripType, conditions: seed });
}

function TripDetailBackgroundLayer({
  background,
  visible,
}: {
  background: TripDetailBackground;
  visible: boolean;
}) {
  if (background.kind === "gradient") {
    return (
      <div
        aria-hidden
        className={cn(
          "trip-detail-gradient-bg motion-safe:animate-gradient-shift pointer-events-none absolute inset-0 bg-cover bg-center bg-fixed max-sm:bg-scroll transition-opacity duration-700 ease-in-out",
          visible ? "opacity-100" : "opacity-0"
        )}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 bg-cover bg-center bg-fixed max-sm:bg-scroll transition-opacity duration-700 ease-in-out",
        visible ? "opacity-100" : "opacity-0"
      )}
      style={{ backgroundImage: `url('${background.src}')` }}
    />
  );
}

function CrossfadeTripDetailBackdrop({
  background,
}: {
  background: TripDetailBackground;
}) {
  const key = tripDetailBackgroundKey(background);
  const [mounted, setMounted] = useState(false);
  const [activeKey, setActiveKey] = useState(key);
  const [slotA, setSlotA] = useState<TripDetailBackground>(background);
  const [slotB, setSlotB] = useState<TripDetailBackground>(background);
  const [frontIsB, setFrontIsB] = useState(false);
  const frontIsBRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (key === activeKey) return;

    if (!frontIsBRef.current) {
      setSlotB(background);
      frontIsBRef.current = true;
    } else {
      setSlotA(background);
      frontIsBRef.current = false;
    }
    setFrontIsB(frontIsBRef.current);
    setActiveKey(key);
  }, [key, background, activeKey]);

  if (!mounted) return null;

  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-[2]"
      style={{ willChange: "opacity" }}
    >
      <TripDetailBackgroundLayer background={slotA} visible={!frontIsB} />
      <TripDetailBackgroundLayer background={slotB} visible={frontIsB} />
    </div>,
    document.body
  );
}

type TripSceneBackgroundRootProps = {
  tripType: string;
  initialCondition?: string | null;
  children: ReactNode;
};

export function TripSceneBackgroundRoot({
  tripType,
  initialCondition = null,
  children,
}: TripSceneBackgroundRootProps) {
  const initialBackground = useMemo(
    () => backgroundFromProps(tripType, initialCondition),
    [tripType, initialCondition]
  );
  const [background, setBackground] =
    useState<TripDetailBackground>(initialBackground);
  const [forecastConditions, setForecastConditions] = useState<string[] | null>(
    null
  );

  useEffect(() => {
    setBackground(initialBackground);
  }, [initialBackground]);

  useEffect(() => {
    if (forecastConditions == null) return;
    setBackground(
      resolveTripDetailPageBackground({
        tripType,
        conditions: forecastConditions,
      })
    );
  }, [tripType, forecastConditions]);

  const contextValue = useMemo(
    () => ({ setForecastConditions }),
    []
  );

  return (
    <TripSceneBackgroundContext.Provider value={contextValue}>
      <CrossfadeTripDetailBackdrop background={background} />
      <div className="relative min-h-[calc(100vh-4rem)]">{children}</div>
    </TripSceneBackgroundContext.Provider>
  );
}

/** Streamed forecast updates the page background with a crossfade. */
export function TripSceneForecastSync({
  conditions,
}: {
  conditions: string[];
}) {
  const ctx = useContext(TripSceneBackgroundContext);

  useEffect(() => {
    if (!ctx) return;
    ctx.setForecastConditions(conditions);
  }, [ctx, conditions]);

  return null;
}
