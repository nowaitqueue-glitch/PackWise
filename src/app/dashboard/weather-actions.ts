"use server";

import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  checkMemoryRateLimit,
  parseCookieRateStamp,
} from "@/lib/rate-limit";
import { resolveTripWeatherForecast } from "@/lib/trip-weather-cache";
import {
  getWeatherForecast,
  WeatherError,
  type WeatherForecastResult,
  type WeatherResultState,
} from "@/lib/weather";

export type GetTripWeatherState = WeatherResultState;

const GUEST_WEATHER_COOKIE = "pw_gw_rl";
const GUEST_WEATHER_MAX = 10;
const GUEST_WEATHER_WINDOW_MS = 60_000;

function guestRateKeyFromHeaders(): string {
  const h = headers();
  const realIp = h.get("x-real-ip")?.trim();
  if (realIp && process.env.NODE_ENV === "production") {
    return `guest-weather:ip:${realIp}`;
  }
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    return `guest-weather:ip:${forwarded.split(",")[0].trim()}`;
  }
  return "guest-weather:ip:127.0.0.1";
}

/**
 * Loads daily weather for a trip (auth + RLS access check).
 * Uses trip_weather cache when fresh; otherwise geocodes, fetches Open-Meteo
 * (with climate fallback for every day), caches the full daily array, and returns it.
 */
export async function getTripWeather(
  tripId: string
): Promise<GetTripWeatherState> {
  const id = tripId?.trim();
  if (!id) {
    return { ok: false, error: "Trip id is required.", code: "INVALID_INPUT" };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        ok: false,
        error: "You must be signed in.",
        code: "UNAUTHORIZED",
      };
    }

    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, destination, start_date, end_date")
      .eq("id", id)
      .maybeSingle();

    if (tripError || !trip) {
      return { ok: false, error: "Trip not found.", code: "NOT_FOUND" };
    }

    let forecast = await resolveTripWeatherForecast(supabase, trip);
    if (!forecast) {
      forecast = await getWeatherForecast({
        destination: trip.destination,
        startDate: trip.start_date,
        endDate: trip.end_date,
      });
    }

    if (!forecast?.days.length) {
      return {
        ok: false,
        error: "Weather data temporarily unavailable",
        code: "UNAVAILABLE",
      };
    }

    return { ok: true, data: forecast };
  } catch (error) {
    if (error instanceof WeatherError) {
      return { ok: false, error: error.message, code: error.code };
    }
    return { ok: false, error: "Unexpected error fetching weather." };
  }
}

export type GuestWeatherResult =
  | { ok: true; data: WeatherForecastResult }
  | { ok: false; error: string; code?: string; retryAfterSec?: number };

/**
 * Guest-mode weather via server action (preferred over public /api/weather).
 * Dual limit: per-IP memory bucket + httpOnly cookie stamp (survives multi-instance).
 */
export async function getGuestWeatherForecast(input: {
  destination: string;
  startDate: string;
  endDate: string;
}): Promise<GuestWeatherResult> {
  const destination = input.destination?.trim() ?? "";
  const startDate = input.startDate?.trim() ?? "";
  const endDate = input.endDate?.trim() ?? "";

  if (!destination || !startDate || !endDate) {
    return {
      ok: false,
      error: "Destination and dates are required.",
      code: "INVALID_INPUT",
    };
  }

  const memory = checkMemoryRateLimit(
    guestRateKeyFromHeaders(),
    GUEST_WEATHER_MAX,
    GUEST_WEATHER_WINDOW_MS
  );
  if (!memory.allowed) {
    return {
      ok: false,
      error: "Too many weather requests. Please wait a moment.",
      code: "RATE_LIMITED",
      retryAfterSec: memory.retryAfterSec,
    };
  }

  const cookieStore = cookies();
  const cookieStamp = parseCookieRateStamp(
    cookieStore.get(GUEST_WEATHER_COOKIE)?.value,
    GUEST_WEATHER_MAX,
    GUEST_WEATHER_WINDOW_MS
  );
  cookieStore.set(GUEST_WEATHER_COOKIE, cookieStamp.nextValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.ceil(GUEST_WEATHER_WINDOW_MS / 1000),
  });
  if (!cookieStamp.allowed) {
    return {
      ok: false,
      error: "Too many weather requests. Please wait a moment.",
      code: "RATE_LIMITED",
      retryAfterSec: cookieStamp.retryAfterSec,
    };
  }

  try {
    const data = await getWeatherForecast({
      destination,
      startDate,
      endDate,
    });
    return { ok: true, data };
  } catch (error) {
    if (error instanceof WeatherError) {
      return { ok: false, error: error.message, code: error.code };
    }
    return {
      ok: false,
      error: "Weather data temporarily unavailable",
      code: "UNAVAILABLE",
    };
  }
}
