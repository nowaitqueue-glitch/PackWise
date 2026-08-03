import { packingProgress, parsePackingItems } from "@/lib/packing";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TripPackingProgress = {
  packed: number;
  total: number;
  percent: number;
};

type TripCounts = { packed: number; total: number };

/**
 * Batch-loads packing progress for many trips (generated list + custom items).
 * One query each — avoids N+1 from the dashboard trip grid.
 */
export async function getDashboardPackingProgressMap(
  supabase: SupabaseClient,
  tripIds: string[]
): Promise<Map<string, TripPackingProgress>> {
  const result = new Map<string, TripPackingProgress>();
  if (tripIds.length === 0) return result;

  const [{ data: lists }, customResult] = await Promise.all([
    supabase
      .from("packing_lists")
      .select("trip_id, items")
      .in("trip_id", tripIds),
    supabase
      .from("packing_custom_items")
      .select("trip_id, packed")
      .in("trip_id", tripIds),
  ]);

  const countsByTrip = new Map<string, TripCounts>();

  for (const row of lists ?? []) {
    const tripId = row.trip_id as string;
    const progress = packingProgress(parsePackingItems(row.items));
    countsByTrip.set(tripId, {
      packed: progress.packed,
      total: progress.total,
    });
  }

  // Tolerate missing custom-items table before migration is applied.
  if (!customResult.error) {
    for (const row of customResult.data ?? []) {
      const tripId = row.trip_id as string;
      const current = countsByTrip.get(tripId) ?? { packed: 0, total: 0 };
      current.total += 1;
      if (row.packed === true) current.packed += 1;
      countsByTrip.set(tripId, current);
    }
  }

  for (const tripId of tripIds) {
    const counts = countsByTrip.get(tripId) ?? { packed: 0, total: 0 };
    const percent =
      counts.total === 0
        ? 0
        : Math.round((counts.packed / counts.total) * 100);
    result.set(tripId, { ...counts, percent });
  }

  return result;
}
