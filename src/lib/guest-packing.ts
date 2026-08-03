import {
  normalizePackingItemsForStorage,
  type PackingItem,
} from "@/lib/packing";
import {
  buildPackingProfile,
  searchPackingItems,
} from "@/lib/packing-search";
import type { WeatherForecastResult } from "@/lib/weather";

type GuestWeatherDay = {
  highTemp: number | null;
  lowTemp: number | null;
  rainChance: number | null;
  condition: string;
};

function isKnownGuestWeatherDay(
  day: GuestWeatherDay
): day is GuestWeatherDay & {
  highTemp: number;
  lowTemp: number;
  rainChance: number;
} {
  return (
    day.highTemp !== null &&
    day.lowTemp !== null &&
    day.rainChance !== null
  );
}

/**
 * Fetch trip weather via the public, rate-limited API (client-safe).
 * Never calls Open-Meteo or `@/lib/weather` runtime helpers from the browser.
 */
async function fetchGuestWeather(input: {
  destination: string;
  startDate: string;
  endDate: string;
}): Promise<WeatherForecastResult | null> {
  try {
    const params = new URLSearchParams({
      destination: input.destination,
      startDate: input.startDate,
      endDate: input.endDate,
    });
    const res = await fetch(`/api/weather?${params.toString()}`);
    if (!res.ok) return null;
    return (await res.json()) as WeatherForecastResult;
  } catch {
    return null;
  }
}

/**
 * Client-safe packing list builder for guest trips.
 * Weather comes from `/api/weather`; items from the in-browser template engine.
 */
export async function buildGuestPackingList(input: {
  destination: string;
  startDate: string;
  endDate: string;
  tripType: string;
  travelers: number;
}): Promise<{ items: PackingItem[]; weather: WeatherForecastResult | null }> {
  const weather = await fetchGuestWeather({
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
  });

  const weatherDays =
    weather?.days.filter((day) =>
      isKnownGuestWeatherDay({
        highTemp: day.highTemp,
        lowTemp: day.lowTemp,
        rainChance: day.rainChance,
        condition: day.condition,
      })
    ) ?? [];

  const profile = buildPackingProfile({
    tripType: input.tripType,
    startDate: input.startDate,
    endDate: input.endDate,
    travelers: input.travelers,
    weatherDays: weatherDays.map((day) => ({
      highTemp: day.highTemp,
      lowTemp: day.lowTemp,
      rainChance: day.rainChance,
      condition: day.condition,
    })),
  });

  const items = normalizePackingItemsForStorage(
    searchPackingItems(profile).map((item) => ({
      ...item,
      packed: false,
    }))
  );

  return { items, weather };
}
