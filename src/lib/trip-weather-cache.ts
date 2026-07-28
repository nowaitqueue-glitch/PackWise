import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getWeatherForecast,
  isKnownForecastDay,
  OPEN_METEO_FORECAST_DAYS,
  type DailyForecast,
  type WeatherForecastResult,
} from "@/lib/weather";

/** Cache TTL before refetching Open-Meteo. */
export const TRIP_WEATHER_CACHE_TTL_MS = 60 * 60 * 1000;

/** Open-Meteo daily forecast window — only show dashboard chip when start is within this many days. */
export const TRIP_WEATHER_FORECAST_HORIZON_DAYS = OPEN_METEO_FORECAST_DAYS;

/**
 * Cached forecast_json shape.
 * - `days`: full trip-range daily array (forecast + climate fallback).
 * - Top-level first-day fields kept for dashboard chip / legacy readers.
 */
export type TripWeatherCachePayload = {
  days: DailyForecast[];
  locationName: string;
  date: string;
  condition: string;
  highTemp: number;
  lowTemp: number;
  rainChance: number;
  icon: string | null;
  /** Geocoded latitude when available. */
  lat?: number;
  /** Geocoded longitude when available. */
  lon?: number;
};

export type TripWeatherSummary = Pick<
  TripWeatherCachePayload,
  "date" | "condition" | "highTemp" | "lowTemp" | "rainChance"
> & {
  icon?: string | null;
};

type TripWeatherRow = {
  trip_id: string;
  fetched_at: string;
  forecast_json: unknown;
};

type TripForWeather = {
  id: string;
  destination: string;
  start_date: string;
  end_date: string;
};

function todayISODate(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysISO(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return todayISODate(date);
}

/** True when trip start is today through today + horizon (inclusive). */
export function isStartWithinForecastWindow(
  startDate: string,
  today = todayISODate()
): boolean {
  const horizonEnd = addDaysISO(today, TRIP_WEATHER_FORECAST_HORIZON_DAYS);
  return startDate >= today && startDate <= horizonEnd;
}

export function isTripWeatherCacheFresh(
  fetchedAt: string,
  nowMs = Date.now()
): boolean {
  const fetchedMs = new Date(fetchedAt).getTime();
  if (Number.isNaN(fetchedMs)) return false;
  return nowMs - fetchedMs < TRIP_WEATHER_CACHE_TTL_MS;
}

function isUnavailableCondition(condition: string): boolean {
  return condition === "unavailable" || condition === "unknown";
}

function isDailyForecast(value: unknown): value is DailyForecast {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (typeof row.date !== "string" || typeof row.condition !== "string") {
    return false;
  }
  if (isUnavailableCondition(row.condition)) {
    return (
      (row.highTemp === null || typeof row.highTemp === "number") &&
      (row.lowTemp === null || typeof row.lowTemp === "number") &&
      (row.rainChance === null || typeof row.rainChance === "number")
    );
  }
  const projectedOk =
    row.projected === undefined || typeof row.projected === "boolean";
  return (
    projectedOk &&
    typeof row.highTemp === "number" &&
    typeof row.lowTemp === "number" &&
    typeof row.rainChance === "number"
  );
}

function summaryFromDay(day: DailyForecast | undefined): TripWeatherSummary | null {
  if (!day || !isKnownForecastDay(day)) {
    return null;
  }
  return {
    date: day.date,
    condition: day.condition,
    highTemp: day.highTemp,
    lowTemp: day.lowTemp,
    rainChance: day.rainChance,
    icon: day.icon ?? null,
  };
}

function parseFirstDaySummary(value: unknown): TripWeatherSummary | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;

  // Prefer days[0] when present (new cache shape).
  if (Array.isArray(row.days) && row.days.length > 0) {
    const first = row.days[0];
    if (isDailyForecast(first)) {
      const fromDays = summaryFromDay(first);
      if (fromDays) return fromDays;
    }
  }

  // Legacy / flattened first-day fields.
  if (
    typeof row.date !== "string" ||
    typeof row.condition !== "string" ||
    typeof row.highTemp !== "number" ||
    typeof row.lowTemp !== "number" ||
    typeof row.rainChance !== "number"
  ) {
    return null;
  }

  if (isUnavailableCondition(row.condition)) return null;

  return {
    date: row.date,
    condition: row.condition,
    highTemp: row.highTemp,
    lowTemp: row.lowTemp,
    rainChance: row.rainChance,
    icon: typeof row.icon === "string" ? row.icon : null,
  };
}

function normalizeDailyForecast(day: DailyForecast): DailyForecast {
  if (isUnavailableCondition(day.condition)) {
    return {
      date: day.date,
      condition: "unavailable",
      highTemp: null,
      lowTemp: null,
      rainChance: null,
      icon: null,
      message: day.message ?? "Forecast not available",
    };
  }
  return {
    date: day.date,
    condition: day.condition,
    highTemp: day.highTemp,
    lowTemp: day.lowTemp,
    rainChance: day.rainChance,
    icon: day.icon ?? null,
    ...(day.projected ? { projected: true } : {}),
    ...(day.message ? { message: day.message } : {}),
  };
}

function parseCachedForecast(
  value: unknown,
  destination: string
): WeatherForecastResult | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;

  if (Array.isArray(row.days) && row.days.every(isDailyForecast)) {
    const lat = typeof row.lat === "number" ? row.lat : undefined;
    const lon = typeof row.lon === "number" ? row.lon : undefined;
    return {
      destination,
      locationName:
        typeof row.locationName === "string" ? row.locationName : destination,
      days: row.days.map(normalizeDailyForecast),
      ...(lat !== undefined ? { lat } : {}),
      ...(lon !== undefined ? { lon } : {}),
    };
  }

  // Legacy single-day cache → wrap as one-day forecast.
  const summary = parseFirstDaySummary(value);
  if (!summary) return null;
  return {
    destination,
    locationName: destination,
    days: [
      {
        date: summary.date,
        condition: summary.condition,
        highTemp: summary.highTemp,
        lowTemp: summary.lowTemp,
        rainChance: summary.rainChance,
        icon: summary.icon ?? null,
      },
    ],
  };
}

export function buildTripWeatherCachePayload(
  forecast: WeatherForecastResult
): TripWeatherCachePayload | null {
  if (forecast.days.length === 0) return null;

  const coords =
    typeof forecast.lat === "number" && typeof forecast.lon === "number"
      ? { lat: forecast.lat, lon: forecast.lon }
      : {};

  const firstKnown = forecast.days.find(isKnownForecastDay);

  if (!firstKnown) {
    // Trip entirely without usable days — still cache placeholders.
    return {
      days: forecast.days,
      locationName: forecast.locationName,
      date: forecast.days[0].date,
      condition: "unavailable",
      highTemp: 0,
      lowTemp: 0,
      rainChance: 0,
      icon: null,
      ...coords,
    };
  }

  return {
    days: forecast.days,
    locationName: forecast.locationName,
    date: firstKnown.date,
    condition: firstKnown.condition,
    highTemp: firstKnown.highTemp,
    lowTemp: firstKnown.lowTemp,
    rainChance: firstKnown.rainChance,
    icon: firstKnown.icon,
    ...coords,
  };
}

async function fetchAndCacheForecast(
  supabase: SupabaseClient,
  trip: TripForWeather
): Promise<WeatherForecastResult | null> {
  try {
    const forecast = await getWeatherForecast({
      destination: trip.destination,
      startDate: trip.start_date,
      endDate: trip.end_date,
    });

    const payload = buildTripWeatherCachePayload(forecast);
    if (!payload) return null;

    await supabase.from("trip_weather").upsert(
      {
        trip_id: trip.id,
        fetched_at: new Date().toISOString(),
        forecast_json: payload,
      },
      { onConflict: "trip_id" }
    );

    return forecast;
  } catch {
    return null;
  }
}

/**
 * Marks cached weather stale so the next resolve refetches Open-Meteo.
 * Used after trip destination/date edits (no DELETE grant on trip_weather).
 */
export async function invalidateTripWeatherCache(
  supabase: SupabaseClient,
  tripId: string
): Promise<void> {
  await supabase
    .from("trip_weather")
    .update({ fetched_at: new Date(0).toISOString() })
    .eq("trip_id", tripId);
}

/**
 * Fast, non-blocking read of the first-day condition from a fresh trip_weather
 * cache row. Never calls Open-Meteo — returns null on miss / stale / parse failure.
 */
export async function peekCachedTripWeatherCondition(
  supabase: SupabaseClient,
  tripId: string
): Promise<string | null> {
  const { data: cachedRow, error: cacheError } = await supabase
    .from("trip_weather")
    .select("fetched_at, forecast_json")
    .eq("trip_id", tripId)
    .maybeSingle();

  if (cacheError || !cachedRow || !isTripWeatherCacheFresh(cachedRow.fetched_at)) {
    return null;
  }

  return parseFirstDaySummary(cachedRow.forecast_json)?.condition ?? null;
}

/**
 * Resolves full-range weather for a trip (auth/access via caller's supabase client).
 * Uses trip_weather cache when younger than TTL; otherwise fetches Open-Meteo and upserts.
 */
export async function resolveTripWeatherForecast(
  supabase: SupabaseClient,
  trip: TripForWeather
): Promise<WeatherForecastResult | null> {
  const { data: cachedRow, error: cacheError } = await supabase
    .from("trip_weather")
    .select("trip_id, fetched_at, forecast_json")
    .eq("trip_id", trip.id)
    .maybeSingle();

  if (!cacheError && cachedRow && isTripWeatherCacheFresh(cachedRow.fetched_at)) {
    const cached = parseCachedForecast(cachedRow.forecast_json, trip.destination);
    if (cached && cached.days.length > 0) {
      return cached;
    }
  }

  return fetchAndCacheForecast(supabase, trip);
}

/**
 * Resolves first-day weather for dashboard trip cards.
 * - Skips trips starting beyond the 16-day Open-Meteo window (caller omits chip).
 * - Uses trip_weather cache when younger than 1 hour.
 * - Otherwise refetches Open-Meteo and upserts cache.
 * - Failures return no entry (chip hidden).
 */
export async function getDashboardTripWeatherMap(
  supabase: SupabaseClient,
  trips: TripForWeather[]
): Promise<Map<string, TripWeatherSummary>> {
  const result = new Map<string, TripWeatherSummary>();
  const eligible = trips.filter((trip) =>
    isStartWithinForecastWindow(trip.start_date)
  );
  if (eligible.length === 0) return result;

  const ids = eligible.map((trip) => trip.id);
  const { data: cachedRows, error: cacheError } = await supabase
    .from("trip_weather")
    .select("trip_id, fetched_at, forecast_json")
    .in("trip_id", ids);

  const cacheByTrip = new Map<string, TripWeatherRow>();
  if (!cacheError) {
    for (const row of (cachedRows ?? []) as TripWeatherRow[]) {
      cacheByTrip.set(row.trip_id, row);
    }
  }

  const toFetch: TripForWeather[] = [];

  for (const trip of eligible) {
    const cached = cacheByTrip.get(trip.id);
    if (cached && isTripWeatherCacheFresh(cached.fetched_at)) {
      const summary = parseFirstDaySummary(cached.forecast_json);
      if (summary) {
        result.set(trip.id, summary);
        continue;
      }
    }
    toFetch.push(trip);
  }

  if (toFetch.length > 0) {
    const fetched = await Promise.all(
      toFetch.map((trip) => fetchAndCacheForecast(supabase, trip))
    );
    toFetch.forEach((trip, index) => {
      const forecast = fetched[index];
      if (!forecast) return;
      const summary = summaryFromDay(
        forecast.days.find(isKnownForecastDay) ?? forecast.days[0]
      );
      if (summary) result.set(trip.id, summary);
    });
  }

  return result;
}
