import { NextRequest, NextResponse } from "next/server";
import { createBearerClient } from "@/lib/supabase/bearer";
import { createClient } from "@/lib/supabase/server";
import { getWeatherForecast, WeatherError } from "@/lib/weather";

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

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

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function rateLimitExceeded(retryAfterSec: number) {
  return NextResponse.json(
    {
      error: "Too many requests. Limit is 30 weather requests per minute.",
      retryAfterSec,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    }
  );
}

/**
 * Resolve the caller via cookie session (server client) or Authorization Bearer.
 * Uses getUser() (not getSession): project API routes validate the JWT with
 * getUser — Supabase recommends it over getSession for server trust boundaries.
 */
async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const accessToken = authHeader.slice(7).trim();
    if (accessToken) {
      const supabase = createBearerClient(accessToken);
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(accessToken);
      if (!error && user) return user;
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

/**
 * GET /api/weather?destination=Paris&startDate=2026-07-20&endDate=2026-07-24
 *
 * Cookie session, Authorization Bearer, or unauthenticated guest callers.
 * Rate-limited to 30 requests/minute per authenticated user id, or per IP
 * for guests. Dashboard weather-actions call getWeatherForecast /
 * resolveTripWeatherForecast directly and bypass this route entirely.
 *
 * Server-only: Open-Meteo forecast with static climate fallback for every trip day.
 * No API key required.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  const rateKey = user ? `user:${user.id}` : `ip:${clientIp(request)}`;
  const limit = checkRateLimit(rateKey);
  if (!limit.allowed) {
    return rateLimitExceeded(limit.retryAfterSec);
  }

  const { searchParams } = request.nextUrl;
  const destination = searchParams.get("destination") ?? "";
  const startDate = searchParams.get("startDate") ?? "";
  const endDate = searchParams.get("endDate") ?? "";

  if (!destination || !startDate || !endDate) {
    return NextResponse.json(
      {
        error:
          "Query params destination, startDate, and endDate are required (dates as YYYY-MM-DD).",
      },
      { status: 400 }
    );
  }

  try {
    const result = await getWeatherForecast({
      destination,
      startDate,
      endDate,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof WeatherError) {
      const status =
        error.code === "GEOCODE_NOT_FOUND"
          ? 404
          : error.code === "INVALID_DATES"
            ? 400
            : 502;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status }
      );
    }

    return NextResponse.json(
      { error: "Unexpected error fetching weather." },
      { status: 500 }
    );
  }
}
