import type { PackingItem } from "@/lib/packing";
import type { WeatherForecastResult } from "@/lib/weather";

export type GuestPackingListInput = {
  destination: string;
  startDate: string;
  endDate: string;
  tripType: string;
  travelers: number;
};

export type GuestPackingListResponse = {
  items: PackingItem[];
  weather: WeatherForecastResult | null;
};

/**
 * Client-safe guest packing list fetch.
 * Catalog / search run on the server via POST /api/packing/guest.
 */
export async function buildGuestPackingList(
  input: GuestPackingListInput
): Promise<GuestPackingListResponse> {
  const res = await fetch("/api/packing/guest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      destination: input.destination,
      startDate: input.startDate,
      endDate: input.endDate,
      tripType: input.tripType,
      travelers: input.travelers,
    }),
  });

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : "Could not build packing list.";
    throw new Error(message);
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray((payload as { items?: unknown }).items)
  ) {
    throw new Error("Invalid packing list response.");
  }

  const data = payload as GuestPackingListResponse;
  return {
    items: data.items,
    weather: data.weather ?? null,
  };
}
