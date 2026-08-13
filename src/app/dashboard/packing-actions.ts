"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/error-reporting";
import {
  PackingError,
  normalizePackingItemsForStorage,
  parsePackingItems,
  parsePackingListSource,
  toPackingListPayload,
  type PackingItem,
  type PackingListSource,
  type TripPackingInput,
} from "@/lib/packing";
import {
  buildPackingProfile,
  searchPackingItems,
} from "@/lib/packing-search";
import { getTripWeather } from "@/app/dashboard/weather-actions";
import {
  getWeatherForecast,
  isKnownForecastDay,
  type WeatherForecastResult,
} from "@/lib/weather";

const PACKING_GENERATE_FRIENDLY_ERROR =
  "Couldn't generate packing list. Please try again.";

/** Compact weather context for logs (no secrets / PII beyond trip destination). */
function summarizeWeatherForLog(weather: WeatherForecastResult | null) {
  if (!weather) {
    return { available: false as const };
  }

  const knownDays = weather.days.filter(isKnownForecastDay);
  const highs = knownDays
    .map((day) => day.highTemp)
    .filter((temp): temp is number => typeof temp === "number");
  const lows = knownDays
    .map((day) => day.lowTemp)
    .filter((temp): temp is number => typeof temp === "number");

  return {
    available: true as const,
    locationName: weather.locationName,
    dayCount: weather.days.length,
    knownDayCount: knownDays.length,
    highTempMin: highs.length ? Math.min(...highs) : null,
    highTempMax: highs.length ? Math.max(...highs) : null,
    lowTempMin: lows.length ? Math.min(...lows) : null,
    lowTempMax: lows.length ? Math.max(...lows) : null,
  };
}

type GeneratePackingListResult =
  | { ok: true; items: PackingItem[]; source: PackingListSource }
  | { ok: false; error: string; code?: string };

type RegeneratePackingListResult =
  | { ok: true; source: PackingListSource; items: PackingItem[] }
  | { ok: false; error: string };

type UpdatePackingItemPackedResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Prefer session-scoped trip weather; fall back to a direct forecast so
 * Bearer / API clients still get weather-aware lists when cookies
 * are unavailable.
 */
async function fetchTripWeather(
  tripId: string,
  trip: TripPackingInput
): Promise<WeatherForecastResult | null> {
  const weather = await getTripWeather(tripId);
  if (weather.ok) {
    return weather.data;
  }

  console.info("[packing] trip weather unavailable, trying direct forecast", {
    tripId,
    error: weather.error,
    code: weather.code,
  });

  try {
    return await getWeatherForecast({
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
    });
  } catch (error) {
    console.info(
      "[packing] direct weather forecast failed; continuing without weather",
      {
        tripId,
        error: error instanceof Error ? error.message : String(error),
      }
    );
    return null;
  }
}

/**
 * Tag-based packing list from trip type, duration, and forecast summary.
 */
function buildTagBasedPackingList(
  trip: TripPackingInput,
  weather: WeatherForecastResult | null
): PackingItem[] {
  const weatherDays = weather?.days.filter(isKnownForecastDay) ?? [];
  const profile = buildPackingProfile({
    tripType: trip.tripType,
    startDate: trip.startDate,
    endDate: trip.endDate,
    travelers: trip.travelers,
    weatherDays: weatherDays.map((day) => ({
      highTemp: day.highTemp,
      lowTemp: day.lowTemp,
      rainChance: day.rainChance,
      condition: day.condition,
    })),
  });

  return normalizePackingItemsForStorage(
    searchPackingItems(profile).map((item) => ({
      ...item,
      packed: false,
    }))
  );
}

async function upsertPackingList(
  tripId: string,
  items: PackingItem[],
  options?: {
    supabaseClient?: SupabaseClient;
    source?: PackingListSource;
    /** When updating packed flags, keep existing source if not provided. */
    preserveSourceFrom?: unknown;
  }
): Promise<{ error: string | null }> {
  const supabase = options?.supabaseClient ?? (await createClient());
  const normalized = normalizePackingItemsForStorage(items);
  const source =
    options?.source ??
    (options?.preserveSourceFrom !== undefined
      ? parsePackingListSource(options.preserveSourceFrom)
      : undefined);

  const { error } = await supabase.from("packing_lists").upsert(
    {
      trip_id: tripId,
      items: toPackingListPayload(normalized, source),
    },
    { onConflict: "trip_id" }
  );

  return { error: error?.message ?? null };
}

const PACKED_UPDATE_MAX_ATTEMPTS = 5;

/**
 * Updates a single generated item's packed flag in packing_lists.items JSONB.
 *
 * F6: avoids blind whole-array races by optimistic concurrency on
 * packing_lists.updated_at — read → mutate one item → update only if
 * updated_at still matches; retry on conflict. Custom items use the
 * packing_custom_items row update instead (see packing-custom-actions).
 *
 * F7: when itemId is provided and missing, fail immediately — never fall
 * back to itemIndex (which can toggle the wrong row after list reshuffles).
 * Owner-only (RLS / ownership check; members have read-only access).
 */
export async function updatePackingItemPacked(params: {
  tripId: string;
  itemId?: string;
  itemIndex?: number;
  packed: boolean;
}): Promise<UpdatePackingItemPackedResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, user_id")
    .eq("id", params.tripId)
    .maybeSingle();

  if (tripError || !trip) {
    return { ok: false, error: "Trip not found." };
  }

  if (trip.user_id !== user.id) {
    return {
      ok: false,
      error: "Only the trip owner can update the packing list.",
    };
  }

  for (let attempt = 0; attempt < PACKED_UPDATE_MAX_ATTEMPTS; attempt++) {
    const { data: packingList, error: listError } = await supabase
      .from("packing_lists")
      .select("items, updated_at")
      .eq("trip_id", params.tripId)
      .maybeSingle();

    if (listError) {
      return { ok: false, error: listError.message };
    }

    if (!packingList) {
      return { ok: false, error: "Packing list not found." };
    }

    const items = parsePackingItems(packingList.items);
    let index = -1;

    if (params.itemId) {
      index = items.findIndex((item) => item.id === params.itemId);
      if (index < 0) {
        return { ok: false, error: "Packing item not found." };
      }
    } else if (typeof params.itemIndex === "number") {
      index = params.itemIndex;
    }

    if (index < 0 || index >= items.length) {
      return { ok: false, error: "Packing item not found." };
    }

    // Already at desired packed state — treat as success (idempotent).
    if (items[index].packed === params.packed) {
      return { ok: true };
    }

    const nextItems = items.map((item, i) =>
      i === index ? { ...item, packed: params.packed } : item
    );
    const source = parsePackingListSource(packingList.items);
    const payload = toPackingListPayload(
      normalizePackingItemsForStorage(nextItems),
      source
    );

    let updateQuery = supabase
      .from("packing_lists")
      .update({ items: payload })
      .eq("trip_id", params.tripId);

    // Optimistic lock: only commit if nobody else wrote since we read.
    if (typeof packingList.updated_at === "string" && packingList.updated_at) {
      updateQuery = updateQuery.eq("updated_at", packingList.updated_at);
    }

    const { data: updated, error } = await updateQuery
      .select("id")
      .maybeSingle();

    if (error) {
      return { ok: false, error: error.message };
    }

    if (updated) {
      revalidatePath(`/dashboard/trips/${params.tripId}`);
      return { ok: true };
    }

    // 0 rows: concurrent writer won — retry with a fresh read.
  }

  return {
    ok: false,
    error: "Could not update packing item. Please try again.",
  };
}

/**
 * Best-effort: fetch weather, build tag-based packing list, upsert.
 * Returns ok:false without throwing so trip creation can still redirect.
 */
export async function generateAndStorePackingList(params: {
  tripId: string;
  trip: TripPackingInput;
  /** Optional client (e.g. Bearer JWT) so API routes can upsert under RLS. */
  supabase?: SupabaseClient;
}): Promise<GeneratePackingListResult> {
  const tripContext = {
    tripId: params.tripId,
    destination: params.trip.destination,
    tripType: params.trip.tripType,
    startDate: params.trip.startDate,
    endDate: params.trip.endDate,
    travelers: params.trip.travelers,
  };

  console.info("[packing] generate start", tripContext);

  try {
    const weather = await fetchTripWeather(params.tripId, params.trip);
    const weatherSummary = summarizeWeatherForLog(weather);
    console.info("[packing] weather ready", {
      tripId: params.tripId,
      weather: weatherSummary,
    });

    const items = buildTagBasedPackingList(params.trip, weather);
    const source: PackingListSource = "template";
    console.info("[packing] items built", {
      tripId: params.tripId,
      itemCount: items.length,
      source,
      weather: weatherSummary,
    });

    const { error } = await upsertPackingList(params.tripId, items, {
      supabaseClient: params.supabase,
      source,
    });
    if (error) {
      console.error("[packing] upsert failed", {
        ...tripContext,
        itemCount: items.length,
        weather: weatherSummary,
        error,
      });
      reportError(new Error(error), {
        context: "packing_generate_upsert",
        ...tripContext,
        itemCount: items.length,
        weather: weatherSummary,
      });
      return {
        ok: false,
        error: PACKING_GENERATE_FRIENDLY_ERROR,
        code: "GENERATION_FAILED",
      };
    }

    console.info("[packing] generate success", {
      tripId: params.tripId,
      itemCount: items.length,
      source,
      weather: weatherSummary,
    });
    return { ok: true, items, source };
  } catch (error) {
    if (error instanceof PackingError) {
      console.error("[packing] generate PackingError", {
        ...tripContext,
        code: error.code,
        error: error.message,
      });
      reportError(error, {
        context: "packing_generate",
        ...tripContext,
        code: error.code,
      });
      return { ok: false, error: error.message, code: error.code };
    }

    console.error("[packing] generate unexpected error", tripContext, error);
    reportError(error, {
      context: "packing_generate",
      ...tripContext,
    });
    return {
      ok: false,
      error: PACKING_GENERATE_FRIENDLY_ERROR,
      code: "GENERATION_FAILED",
    };
  }
}

/**
 * tripId-only wrapper: load the trip, generate packing, upsert packing_lists.
 * Used by the authenticated generate API (`POST /api/packing/generate`).
 */
export async function generatePackingListAction(
  tripId: string,
  options?: { supabase?: SupabaseClient }
): Promise<GeneratePackingListResult> {
  const id = tripId?.trim();
  if (!id) {
    return { ok: false, error: "Trip id is required.", code: "GENERATION_FAILED" };
  }

  const supabase = options?.supabase ?? (await createClient());
  const { data: trip, error } = await supabase
    .from("trips")
    .select("destination, start_date, end_date, trip_type, travelers")
    .eq("id", id)
    .maybeSingle();

  if (error || !trip) {
    return {
      ok: false,
      error: error?.message ?? "Trip not found.",
      code: "GENERATION_FAILED",
    };
  }

  return generateAndStorePackingList({
    tripId: id,
    trip: {
      destination: trip.destination,
      startDate: trip.start_date,
      endDate: trip.end_date,
      tripType: trip.trip_type,
      travelers: trip.travelers,
    },
    supabase,
  });
}

/**
 * Re-runs weather-aware tag-based packing list generation for an existing trip.
 * Owner-only (members can view the list but not regenerate or check items off).
 * Also used by trip-detail auto-generate after create/duplicate.
 */
export async function regeneratePackingList(
  tripId: string
): Promise<RegeneratePackingListResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: "You must be signed in." };
    }

    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select(
        "id, user_id, destination, start_date, end_date, trip_type, travelers"
      )
      .eq("id", tripId)
      .maybeSingle();

    if (tripError || !trip) {
      return { ok: false, error: "Trip not found." };
    }

    if (trip.user_id !== user.id) {
      return {
        ok: false,
        error: "Only the trip owner can regenerate the list.",
      };
    }

    console.info("[packing] regenerate start", { tripId: trip.id });

    const result = await generateAndStorePackingList({
      tripId: trip.id,
      trip: {
        destination: trip.destination,
        startDate: trip.start_date,
        endDate: trip.end_date,
        tripType: trip.trip_type,
        travelers: trip.travelers,
      },
    });

    if (!result.ok) {
      console.error("[packing] regenerate failed", {
        tripId: trip.id,
        error: result.error,
        code: result.code,
      });
      return { ok: false, error: result.error };
    }

    revalidatePath(`/dashboard/trips/${tripId}`);
    return { ok: true, source: result.source, items: result.items };
  } catch (error) {
    console.error("[packing] regenerate unexpected error", { tripId }, error);
    reportError(error, { context: "packing_regenerate", tripId });
    return { ok: false, error: PACKING_GENERATE_FRIENDLY_ERROR };
  }
}
