"use server";

import { createClient } from "@/lib/supabase/server";
import { resolveTripWeatherForecast } from "@/lib/trip-weather-cache";
import {
  getWeatherForecast,
  WeatherError,
  type WeatherForecastResult,
} from "@/lib/weather";

export type GetTripWeatherState =
  | { ok: true; data: WeatherForecastResult }
  | { ok: false; error: string; code?: string };

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
