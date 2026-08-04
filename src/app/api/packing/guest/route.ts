import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import {
  normalizePackingItemsForStorage,
  type PackingItem,
} from "@/lib/packing";
import {
  buildPackingProfile,
  searchPackingItems,
} from "@/lib/packing-search";
import {
  getWeatherForecast,
  isKnownForecastDay,
  type WeatherForecastResult,
} from "@/lib/weather";

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TRAVELERS = 50;

type RateBucket = { count: number; resetAt: number };

/** In-memory limiter for this route only (single-instance / dev). */
const rateBuckets = new Map<string, RateBucket>();

function checkRateLimit(
  key: string
): { allowed: true } | { allowed: false; retryAfterSec: number } {
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateBuckets.set(key, bucket);
  }
  if (bucket.count >= RATE_LIMIT_MAX) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count += 1;
  return { allowed: true };
}

function rateLimitExceeded(retryAfterSec: number) {
  return NextResponse.json(
    {
      error: "Too many requests. Limit is 30 packing requests per minute.",
      retryAfterSec,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    }
  );
}

export type GuestPackingRequestBody = {
  destination: string;
  startDate: string;
  endDate: string;
  tripType: string;
  travelers: number;
};

function parseBody(body: unknown): GuestPackingRequestBody | { error: string } {
  if (!body || typeof body !== "object") {
    return {
      error:
        "Request body must be JSON with destination, startDate, endDate, tripType, and travelers.",
    };
  }

  const obj = body as Record<string, unknown>;
  const destination =
    typeof obj.destination === "string" ? obj.destination.trim() : "";
  const startDate =
    typeof obj.startDate === "string" ? obj.startDate.trim() : "";
  const endDate = typeof obj.endDate === "string" ? obj.endDate.trim() : "";
  const tripType = typeof obj.tripType === "string" ? obj.tripType.trim() : "";
  const travelers =
    typeof obj.travelers === "number"
      ? obj.travelers
      : typeof obj.travelers === "string"
        ? Number(obj.travelers)
        : NaN;

  if (!destination) {
    return { error: "Body field destination (non-empty string) is required." };
  }
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    return {
      error: "Body fields startDate and endDate must be YYYY-MM-DD.",
    };
  }
  if (endDate < startDate) {
    return { error: "endDate must be on or after startDate." };
  }
  if (!tripType) {
    return { error: "Body field tripType (non-empty string) is required." };
  }
  if (
    !Number.isFinite(travelers) ||
    !Number.isInteger(travelers) ||
    travelers < 1 ||
    travelers > MAX_TRAVELERS
  ) {
    return {
      error: `Body field travelers must be an integer from 1 to ${MAX_TRAVELERS}.`,
    };
  }

  return { destination, startDate, endDate, tripType, travelers };
}

function buildGuestItems(
  input: GuestPackingRequestBody,
  weather: WeatherForecastResult | null
): PackingItem[] {
  const weatherDays = weather?.days.filter(isKnownForecastDay) ?? [];
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

  return normalizePackingItemsForStorage(
    searchPackingItems(profile).map((item) => ({
      ...item,
      packed: false,
    }))
  );
}

/**
 * POST /api/packing/guest
 *
 * Unauthenticated guest packing list generation. Catalog / search runs
 * server-side only. Rate-limited to 30 requests/minute per IP.
 *
 * Body: { destination, startDate, endDate, tripType, travelers }
 * Response: { items, weather }
 */
export async function POST(request: NextRequest) {
  const rateKey = `ip:${getClientIp(request)}`;
  const limit = checkRateLimit(rateKey);
  if (!limit.allowed) {
    return rateLimitExceeded(limit.retryAfterSec);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "Request body must be JSON with destination, startDate, endDate, tripType, and travelers.",
      },
      { status: 400 }
    );
  }

  const parsed = parseBody(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  let weather: WeatherForecastResult | null = null;
  try {
    weather = await getWeatherForecast({
      destination: parsed.destination,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
    });
  } catch {
    // Weather is optional for packing; continue with template defaults.
    weather = null;
  }

  const items = buildGuestItems(parsed, weather);

  return NextResponse.json({ items, weather });
}