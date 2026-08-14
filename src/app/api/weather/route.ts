import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import { createBearerClient } from "@/lib/supabase/bearer";
import { createClient } from "@/lib/supabase/server";
import { getWeatherForecast, WeatherError } from "@/lib/weather";

const RATE_LIMIT_MAX = 30;
/** Unauthenticated callers get a tighter ceiling. */
const GUEST_RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

type RateBucket = { count: number; resetAt: number };

/** In-memory limiter for this route only (single-instance / dev). */
const rateBuckets = new Map<string, RateBucket>();

function checkRateLimit(
  key: string,
  max = RATE_LIMIT_MAX
): { allowed: true } | { allowed: false; retryAfterSec: number } {
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateBuckets.set(key, bucket);
  }
  if (bucket.count >= max) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count += 1;
  return { allowed: true };
}

/**
 * Enforce IP always; when authenticated, also enforce per-user so one account
 * cannot burn quota across devices / rotating IPs. Guests use a tighter IP cap.
 */
function enforceRateLimits(
  request: NextRequest,
  userId: string | null
): { allowed: true } | { allowed: false; retryAfterSec: number } {
  const ipMax = userId ? RATE_LIMIT_MAX : GUEST_RATE_LIMIT_MAX;
  const keys: Array<{ key: string; max: number }> = [
    { key: `ip:${getClientIp(request)}`, max: ipMax },
  ];
  if (userId) keys.push({ key: `user:${userId}`, max: RATE_LIMIT_MAX });

  for (const { key, max } of keys) {
    const result = checkRateLimit(key, max);
    if (!result.allowed) return result;
  }
  return { allowed: true };
}

function rateLimitExceeded(retryAfterSec: number, guest = false) {
  const limit = guest ? GUEST_RATE_LIMIT_MAX : RATE_LIMIT_MAX;
  return NextResponse.json(
    {
      error: `Too many requests. Limit is ${limit} weather requests per minute.`,
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
 * Rate-limited to 30 requests/minute per IP, and also per authenticated user
 * id when available (both buckets must allow). Dashboard weather-actions call
 * getWeatherForecast / resolveTripWeatherForecast directly and bypass this
 * route entirely.
 *
 * Server-only: Open-Meteo forecast with static climate fallback for every trip day.
 * No API key required.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  const limit = enforceRateLimits(request, user?.id ?? null);
  if (!limit.allowed) {
    return rateLimitExceeded(limit.retryAfterSec, !user);
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
