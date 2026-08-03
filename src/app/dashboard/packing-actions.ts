"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
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

type GeneratePackingListResult =
  | { ok: true; items: PackingItem[]; source: PackingListSource }
  | { ok: false; error: string; code?: string };

type RegeneratePackingListResult =
  | { ok: true; source: PackingListSource; items: PackingItem[] }
  | { ok: false; error: string };

type UpdatePackingItemPackedResult =
  | { ok: true }
  | { ok: false; error: string };

/** Known production hosts (hostname only; port ignored for these). */
const KNOWN_APP_HOSTNAMES = new Set([
  "packwise.app",
  "www.packwise.app",
]);

function normalizeOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/$/, "");
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function parseHost(value: string): { hostname: string; host: string } | null {
  const raw = value.split(",")[0]?.trim();
  if (!raw) return null;
  try {
    const url = raw.includes("://") ? new URL(raw) : new URL(`http://${raw}`);
    return {
      hostname: url.hostname.toLowerCase(),
      host: url.host.toLowerCase(),
    };
  } catch {
    return null;
  }
}

function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

/**
 * Hosts allowed for x-forwarded-host: loopback variants, known production
 * domains, and hosts derived from trusted env origins (APP_URL, VERCEL_URL, etc.).
 */
function isAllowedForwardedHost(hostHeader: string): boolean {
  const parsed = parseHost(hostHeader);
  if (!parsed) return false;

  if (isLoopbackHostname(parsed.hostname)) {
    return true;
  }

  if (KNOWN_APP_HOSTNAMES.has(parsed.hostname)) {
    return true;
  }

  const envOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.TEST_BASE_URL,
    process.env.VERCEL_URL,
    process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN,
  ];

  for (const candidate of envOrigins) {
    if (!candidate?.trim()) continue;
    const envHost = parseHost(candidate);
    if (!envHost) continue;
    if (
      parsed.host === envHost.host ||
      parsed.hostname === envHost.hostname
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Origin for internal packing kickoff.
 * Priority: NEXT_PUBLIC_APP_URL → allowlisted x-forwarded-host → localhost:3000 (dev).
 */
async function resolveAppOrigin(): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    return normalizeOrigin(appUrl);
  }

  try {
    const headerStore = await headers();
    const forwardedHost =
      headerStore.get("x-forwarded-host")?.split(",")[0]?.trim();
    if (forwardedHost && isAllowedForwardedHost(forwardedHost)) {
      const proto =
        headerStore.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
        (isLoopbackHostname(parseHost(forwardedHost)?.hostname ?? "")
          ? "http"
          : "https");
      return `${proto}://${forwardedHost}`;
    }
  } catch {
    // headers() unavailable outside a request context
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }

  const fromEnv =
    process.env.TEST_BASE_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (fromEnv) {
    return normalizeOrigin(fromEnv);
  }

  return "http://localhost:3000";
}

/**
 * Prefer session-scoped trip weather; fall back to a direct forecast so
 * Bearer / background jobs still get weather-aware lists when cookies
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

  try {
    return await getWeatherForecast({
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
    });
  } catch {
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

/**
 * Updates a single item's packed flag by rewriting the items JSONB array.
 * Owner-only (RLS enforces is_trip_owner; members have read-only access).
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

  const { data: packingList, error: listError } = await supabase
    .from("packing_lists")
    .select("items")
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
  }

  if (index < 0 && typeof params.itemIndex === "number") {
    index = params.itemIndex;
  }

  if (index < 0 || index >= items.length) {
    return { ok: false, error: "Packing item not found." };
  }

  items[index] = { ...items[index], packed: params.packed };

  const { error } = await upsertPackingList(params.tripId, items, {
    preserveSourceFrom: packingList.items,
  });
  if (error) {
    return { ok: false, error };
  }

  revalidatePath(`/dashboard/trips/${params.tripId}`);
  return { ok: true };
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
  try {
    const weather = await fetchTripWeather(params.tripId, params.trip);
    const items = buildTagBasedPackingList(params.trip, weather);
    const source: PackingListSource = "template";

    const { error } = await upsertPackingList(params.tripId, items, {
      supabaseClient: params.supabase,
      source,
    });
    if (error) {
      return { ok: false, error, code: "GENERATION_FAILED" };
    }

    return { ok: true, items, source };
  } catch (error) {
    if (error instanceof PackingError) {
      return { ok: false, error: error.message, code: error.code };
    }
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unexpected error generating packing list.",
      code: "GENERATION_FAILED",
    };
  }
}

/**
 * tripId-only wrapper: load the trip, generate packing, upsert packing_lists.
 * Used by the authenticated generate API; create/duplicate kick off via
 * {@link generatePackingListInBackground} instead of awaiting this.
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
 * Starts packing list generation without waiting for it to finish.
 * Fire-and-forget POST to `/api/packing/generate` (Bearer JWT) so a separate
 * invocation can finish after the create/redirect response returns.
 *
 * Falls back to an in-process generate if no access token is available
 * (may be truncated on serverless once the parent response completes).
 */
export async function generatePackingListInBackground(
  tripId: string
): Promise<void> {
  const id = tripId?.trim();
  if (!id) {
    return;
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token?.trim();

  if (accessToken) {
    const url = `${await resolveAppOrigin()}/api/packing/generate`;
    void fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tripId: id }),
    }).catch((error) => {
      console.error("[packing] background generate kickoff failed", error);
    });
    return;
  }

  // No JWT available — best-effort in-process (may be truncated on serverless).
  void (async () => {
    const result = await generatePackingListAction(id);
    if (!result.ok) {
      console.error("[packing] background generate failed", result.error);
      return;
    }
    revalidatePath(`/dashboard/trips/${id}`);
  })();
}

/**
 * Re-runs weather-aware tag-based packing list generation for an existing trip.
 * Owner-only (members can view the list but not regenerate or check items off).
 */
export async function regeneratePackingList(
  tripId: string
): Promise<RegeneratePackingListResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, user_id, destination, start_date, end_date, trip_type, travelers")
    .eq("id", tripId)
    .maybeSingle();

  if (tripError || !trip) {
    return { ok: false, error: "Trip not found." };
  }

  if (trip.user_id !== user.id) {
    return { ok: false, error: "Only the trip owner can regenerate the list." };
  }

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
    return { ok: false, error: result.error };
  }

  revalidatePath(`/dashboard/trips/${tripId}`);
  return { ok: true, source: result.source, items: result.items };
}
