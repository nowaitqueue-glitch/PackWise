"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_GEMINI_MODEL,
  generateContentWithRetry,
  getGeminiApiKey,
  getGeminiModel,
} from "@/lib/gemini";
import { parsePackingItems } from "@/lib/packing";
import {
  consumeScanCredit,
  getScanQuota,
  userHasProAccessForUser,
} from "@/lib/pro";
import { getTripWeather } from "@/app/dashboard/weather-actions";
import {
  isKnownForecastDay,
  type WeatherForecastResult,
} from "@/lib/weather";

const BUCKET = "suitcase-scans";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MiB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const SYSTEM_PROMPT =
  "You are a helpful travel packing assistant. Analyze photos of packed suitcases. Based on the trip details (destination, weather, type), list any obviously missing essentials (e.g., no jacket visible for cold weather, no power adapter). Be helpful, not critical. Only mention items that seem clearly missing from what is visible — do not invent long laundry lists. Respond with JSON of the form { \"suggestions\": string[] }.";

export type ScanSuitcaseResult =
  | {
      ok: true;
      suggestions: string[];
      storagePath: string;
      scansRemaining: number | null;
      isPro: boolean;
    }
  | { ok: false; error: string; code?: string; scansRemaining?: number };

function formatWeatherSummary(
  weather: WeatherForecastResult | null,
  fallbackNote?: string
): string {
  if (!weather) {
    return (
      fallbackNote ??
      "Weather forecast unavailable. Use seasonal norms for the destination and dates."
    );
  }

  const knownDays = weather.days.filter(isKnownForecastDay);
  if (knownDays.length === 0) {
    return `Location: ${weather.locationName}. Weather data not yet available; use seasonal averages for the destination and trip dates.`;
  }

  const dayLines = knownDays.map(
    (day) =>
      `${day.date}: ${day.condition}, high ${day.highTemp}°C / low ${day.lowTemp}°C, rain chance ${Math.round(day.rainChance * 100)}%`
  );

  return [
    `Location: ${weather.locationName}`,
    "Daily forecast:",
    ...dayLines,
  ].join("\n");
}

function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "jpg";
  }
}

function parseSuggestions(content: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== "object") {
    return [];
  }

  const suggestions = (parsed as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(suggestions)) {
    return [];
  }

  return suggestions
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Accepts FormData with `tripId` + `image` (File).
 * Verifies trip access + scan quota, uploads to private storage, analyzes with Gemini vision.
 * Free users: 3 scans/month (profiles.scans_remaining). Pro: unlimited.
 */
export async function scanSuitcase(
  formData: FormData
): Promise<ScanSuitcaseResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error:
        "Gemini API key is not configured. Set GEMINI_API_KEY in .env.local.",
      code: "MISSING_API_KEY",
    };
  }

  const tripIdRaw = formData.get("tripId");
  const tripId = typeof tripIdRaw === "string" ? tripIdRaw.trim() : "";
  if (!tripId) {
    return { ok: false, error: "Missing trip id.", code: "INVALID_INPUT" };
  }

  const image = formData.get("image");
  if (!(image instanceof File) || image.size === 0) {
    return {
      ok: false,
      error: "No image was provided. Take a photo of your open suitcase.",
      code: "NO_IMAGE",
    };
  }

  if (!ALLOWED_TYPES.has(image.type)) {
    return {
      ok: false,
      error: "Please upload a photo (JPEG, PNG, WebP, or HEIC).",
      code: "INVALID_IMAGE",
    };
  }

  if (image.size > MAX_BYTES) {
    return {
      ok: false,
      error: "Image is too large. Please use a photo under 10 MB.",
      code: "IMAGE_TOO_LARGE",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in.", code: "UNAUTHORIZED" };
  }

  const isPro = await userHasProAccessForUser(user.id, supabase);
  const quota = await getScanQuota(user.id, supabase);

  if (!isPro && !quota.canScan) {
    return {
      ok: false,
      error:
        "You've used all 3 free suitcase scans this month. Upgrade to Pro for unlimited scans.",
      code: "SCAN_LIMIT",
      scansRemaining: 0,
    };
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, destination, start_date, end_date, trip_type, travelers")
    .eq("id", tripId)
    .maybeSingle();

  if (tripError || !trip) {
    return { ok: false, error: "Trip not found.", code: "NOT_FOUND" };
  }

  const buffer = Buffer.from(await image.arrayBuffer());
  const ext = extensionForMime(image.type);
  // Path must match storage RLS: {trip_id}/{user_id}/{filename}
  const objectPath = `${trip.id}/${user.id}/${randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, buffer, {
      contentType: image.type,
      upsert: false,
    });

  if (uploadError) {
    return {
      ok: false,
      error: `Upload failed: ${uploadError.message}`,
      code: "UPLOAD_FAILED",
    };
  }

  const weather = await getTripWeather(trip.id);
  const weatherSummary = weather.ok
    ? formatWeatherSummary(weather.data)
    : formatWeatherSummary(null, weather.error);

  const userText = [
    "Analyze this image of a packed suitcase. Based on the trip details below, list any obviously missing essentials. Be helpful, not critical.",
    'Respond with JSON: { "suggestions": string[] }. If nothing obvious is missing, return a short encouraging note in suggestions (one item).',
    "",
    `Destination: ${trip.destination}`,
    `Dates: ${trip.start_date} to ${trip.end_date}`,
    `Trip type: ${trip.trip_type}`,
    `Travelers: ${trip.travelers}`,
    "",
    "Weather summary:",
    weatherSummary,
  ].join("\n");

  let content: string | null = null;

  try {
    const model = getGeminiModel(
      {
        model: DEFAULT_GEMINI_MODEL,
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 800,
          responseMimeType: "application/json",
        },
      },
      apiKey
    );

    const result = await generateContentWithRetry(model, [
      { text: userText },
      {
        inlineData: {
          mimeType: image.type,
          data: buffer.toString("base64"),
        },
      },
    ]);

    content = result.response.text() || null;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gemini vision request failed.";
    return { ok: false, error: message, code: "ANALYSIS_FAILED" };
  }

  if (!content) {
    return {
      ok: false,
      error: "Model returned an empty response.",
      code: "ANALYSIS_FAILED",
    };
  }

  const suggestions = parseSuggestions(content);
  if (suggestions.length === 0) {
    return {
      ok: false,
      error: "Could not parse suggestions from the model.",
      code: "PARSE_FAILED",
    };
  }

  let scansRemaining: number | null = null;
  if (isPro) {
    scansRemaining = null;
  } else {
    const consumed = await consumeScanCredit(user.id, supabase);
    if (!consumed.ok) {
      // Analysis succeeded; still report success but surface quota error softly
      scansRemaining = 0;
    } else {
      scansRemaining = consumed.scansRemaining;
    }
  }

  return {
    ok: true,
    suggestions,
    storagePath: objectPath,
    scansRemaining,
    isPro,
  };
}

export type AddSuitcaseSuggestionsResult =
  | { ok: true; added: number; skipped: number }
  | { ok: false; error: string; code?: string };

/**
 * Appends Suitcase Snap suggestions as custom packing items.
 * Skips names already present on the trip packing list (case-insensitive).
 * Owner-only — same gate as createCustomPackingItem.
 */
export async function addSuitcaseSuggestionsToList(params: {
  tripId: string;
  suggestions: string[];
}): Promise<AddSuitcaseSuggestionsResult> {
  const tripId = params.tripId.trim();
  if (!tripId) {
    return { ok: false, error: "Missing trip id.", code: "INVALID_INPUT" };
  }

  const names = Array.from(
    new Set(
      params.suggestions
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );

  if (names.length === 0) {
    return { ok: false, error: "No suggestions to add.", code: "EMPTY" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in.", code: "UNAUTHORIZED" };
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, user_id")
    .eq("id", tripId)
    .maybeSingle();

  if (tripError || !trip) {
    return { ok: false, error: "Trip not found.", code: "NOT_FOUND" };
  }

  if (trip.user_id !== user.id) {
    return {
      ok: false,
      error: "Only the trip owner can update the packing list.",
      code: "FORBIDDEN",
    };
  }

  const [{ data: packingList }, { data: customRows, error: customError }] =
    await Promise.all([
      supabase
        .from("packing_lists")
        .select("items")
        .eq("trip_id", tripId)
        .maybeSingle(),
      supabase
        .from("packing_custom_items")
        .select("name")
        .eq("trip_id", tripId),
    ]);

  if (customError) {
    return {
      ok: false,
      error: customError.message,
      code: "LOOKUP_FAILED",
    };
  }

  const existingNames = new Set<string>();
  for (const item of parsePackingItems(packingList?.items)) {
    existingNames.add(item.name.trim().toLowerCase());
  }
  for (const row of customRows ?? []) {
    if (typeof row.name === "string" && row.name.trim()) {
      existingNames.add(row.name.trim().toLowerCase());
    }
  }

  const toAdd = names.filter(
    (name) => !existingNames.has(name.toLowerCase())
  );
  const skipped = names.length - toAdd.length;

  if (toAdd.length === 0) {
    return { ok: true, added: 0, skipped };
  }

  const { error: insertError } = await supabase
    .from("packing_custom_items")
    .insert(
      toAdd.map((name) => ({
        trip_id: tripId,
        user_id: user.id,
        name,
        category: "Miscellaneous",
        notes: "From Suitcase Snap",
        packed: false,
      }))
    );

  if (insertError) {
    return {
      ok: false,
      error: insertError.message,
      code: "INSERT_FAILED",
    };
  }

  revalidatePath(`/dashboard/trips/${tripId}`);
  return { ok: true, added: toAdd.length, skipped };
}
