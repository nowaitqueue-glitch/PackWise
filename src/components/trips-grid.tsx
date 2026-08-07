"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { DashboardEmptyState } from "@/components/dashboard-empty-state";
import { TripCard, type UpcomingTrip } from "@/components/trip-card";
import type { TripPackingProgress } from "@/lib/dashboard-packing-progress";
import type { TripWeatherSummary } from "@/lib/trip-weather-cache";
import { cn } from "@/lib/utils";

const REMOVE_ANIMATION_MS = 300;
const BATCH_STAGGER_MS = 50;

type TripsListContextValue = {
  removingIds: ReadonlySet<string>;
  removedIds: ReadonlySet<string>;
  beginRemove: (tripId: string) => void;
  beginRemoveMany: (tripIds: string[], staggerMs?: number) => void;
  restore: (tripId: string) => void;
  restoreMany: (tripIds: string[]) => void;
  isSelectionMode: boolean;
  selectedTrips: readonly string[];
  enterSelectionMode: () => void;
  exitSelectionMode: () => void;
  toggleSelect: (tripId: string) => void;
  clearSelection: () => void;
  isSelected: (tripId: string) => boolean;
  canSelect: (tripId: string) => boolean;
};

const TripsListContext = createContext<TripsListContextValue | null>(null);

type TripsListProviderProps = {
  children: ReactNode;
  /** Trip ids the current user owns (only these are selectable for batch delete). */
  ownedTripIds?: string[];
};

/**
 * Optimistic remove + multi-select state above Suspense so chips fallback →
 * resolved swap does not remount and resurrect a deleted / deselected card.
 */
export function TripsListProvider({
  children,
  ownedTripIds = [],
}: TripsListProviderProps) {
  const ownedSet = useMemo(() => new Set(ownedTripIds), [ownedTripIds]);
  const [removingIds, setRemovingIds] = useState(() => new Set<string>());
  const [removedIds, setRemovedIds] = useState(() => new Set<string>());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTrips, setSelectedTrips] = useState<string[]>([]);
  const timersRef = useRef(new Map<string, number>());
  const staggerTimersRef = useRef<number[]>([]);

  const clearStaggerTimers = useCallback(() => {
    for (const timer of staggerTimersRef.current) {
      window.clearTimeout(timer);
    }
    staggerTimersRef.current = [];
  }, []);

  const beginRemove = useCallback((tripId: string) => {
    setRemovingIds((prev) => {
      const next = new Set(prev);
      next.add(tripId);
      return next;
    });
    setSelectedTrips((prev) => prev.filter((id) => id !== tripId));
    const existing = timersRef.current.get(tripId);
    if (existing != null) {
      window.clearTimeout(existing);
    }
    const timer = window.setTimeout(() => {
      timersRef.current.delete(tripId);
      setRemovedIds((prev) => {
        const next = new Set(prev);
        next.add(tripId);
        return next;
      });
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(tripId);
        return next;
      });
    }, REMOVE_ANIMATION_MS);
    timersRef.current.set(tripId, timer);
  }, []);

  const beginRemoveMany = useCallback(
    (tripIds: string[], staggerMs = BATCH_STAGGER_MS) => {
      clearStaggerTimers();
      tripIds.forEach((tripId, index) => {
        const delay = index * staggerMs;
        if (delay === 0) {
          beginRemove(tripId);
          return;
        }
        const timer = window.setTimeout(() => {
          beginRemove(tripId);
        }, delay);
        staggerTimersRef.current.push(timer);
      });
    },
    [beginRemove, clearStaggerTimers]
  );

  const restore = useCallback((tripId: string) => {
    const existing = timersRef.current.get(tripId);
    if (existing != null) {
      window.clearTimeout(existing);
      timersRef.current.delete(tripId);
    }
    setRemovingIds((prev) => {
      const next = new Set(prev);
      next.delete(tripId);
      return next;
    });
    setRemovedIds((prev) => {
      const next = new Set(prev);
      next.delete(tripId);
      return next;
    });
  }, []);

  const restoreMany = useCallback(
    (tripIds: string[]) => {
      clearStaggerTimers();
      for (const tripId of tripIds) {
        restore(tripId);
      }
    },
    [clearStaggerTimers, restore]
  );

  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedTrips([]);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTrips([]);
  }, []);

  const toggleSelect = useCallback(
    (tripId: string) => {
      if (!ownedSet.has(tripId)) return;
      setSelectedTrips((prev) =>
        prev.includes(tripId)
          ? prev.filter((id) => id !== tripId)
          : [...prev, tripId]
      );
    },
    [ownedSet]
  );

  const isSelected = useCallback(
    (tripId: string) => selectedTrips.includes(tripId),
    [selectedTrips]
  );

  const canSelect = useCallback(
    (tripId: string) => ownedSet.has(tripId),
    [ownedSet]
  );

  const value = useMemo(
    () => ({
      removingIds,
      removedIds,
      beginRemove,
      beginRemoveMany,
      restore,
      restoreMany,
      isSelectionMode,
      selectedTrips,
      enterSelectionMode,
      exitSelectionMode,
      toggleSelect,
      clearSelection,
      isSelected,
      canSelect,
    }),
    [
      removingIds,
      removedIds,
      beginRemove,
      beginRemoveMany,
      restore,
      restoreMany,
      isSelectionMode,
      selectedTrips,
      enterSelectionMode,
      exitSelectionMode,
      toggleSelect,
      clearSelection,
      isSelected,
      canSelect,
    ]
  );

  return (
    <TripsListContext.Provider value={value}>{children}</TripsListContext.Provider>
  );
}

/** Alias — same provider (optimistic delete + selection). */
export const TripsOptimisticProvider = TripsListProvider;

export function useTripsList(): TripsListContextValue | null {
  return useContext(TripsListContext);
}

/** @deprecated Prefer useTripsList */
export function useTripsOptimistic(): TripsListContextValue | null {
  return useContext(TripsListContext);
}

/** Plain records — Maps are not RSC→client serializable. */
export type TripWeatherById = Record<string, TripWeatherSummary>;
export type TripPackingById = Record<string, TripPackingProgress>;

type TripsGridProps = {
  trips: UpcomingTrip[];
  weatherByTripId: TripWeatherById;
  packingByTripId: TripPackingById;
  completed?: boolean;
  chipsPending?: boolean;
};

export function TripsGrid({
  trips,
  weatherByTripId,
  packingByTripId,
  completed = false,
  chipsPending = false,
}: TripsGridProps) {
  const list = useTripsList();
  const removingIds = list?.removingIds;
  const removedIds = list?.removedIds;
  const isSelectionMode = list?.isSelectionMode ?? false;

  const visibleTrips = useMemo(() => {
    if (!removedIds || removedIds.size === 0) return trips;
    return trips.filter((trip) => !removedIds.has(trip.id));
  }, [trips, removedIds]);

  if (visibleTrips.length === 0) {
    return completed ? null : <DashboardEmptyState />;
  }

  return (
    <ul className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {visibleTrips.map((trip, index) => {
        const isRemoving = removingIds?.has(trip.id) ?? false;
        const canSelect = list?.canSelect(trip.id) ?? false;
        return (
          <li
            key={trip.id}
            className={cn(
              "transition-[opacity,transform] duration-300 ease-out motion-reduce:transform-none motion-reduce:transition-none",
              isRemoving &&
                "pointer-events-none translate-y-2 scale-95 opacity-0"
            )}
          >
            <TripCard
              trip={trip}
              weather={weatherByTripId[trip.id] ?? null}
              packing={packingByTripId[trip.id] ?? null}
              completed={completed}
              onboardingAnchors={!completed && index === 0}
              chipsPending={chipsPending}
              isRemoving={isRemoving}
              onOptimisticRemove={
                list ? () => list.beginRemove(trip.id) : undefined
              }
              onOptimisticRestore={
                list ? () => list.restore(trip.id) : undefined
              }
              isSelectionMode={isSelectionMode}
              isSelected={list?.isSelected(trip.id) ?? false}
              onToggleSelect={
                canSelect && list
                  ? () => list.toggleSelect(trip.id)
                  : undefined
              }
            />
          </li>
        );
      })}
    </ul>
  );
}