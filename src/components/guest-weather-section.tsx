"use client";

import { useEffect, useState } from "react";
import { getGuestWeatherForecast } from "@/app/dashboard/weather-actions";
import { TripWeatherForecast } from "@/components/trip-weather-forecast";
import { TripWeatherForecastSkeleton } from "@/components/trip-weather-forecast-skeleton";
import type { WeatherForecastResult } from "@/lib/weather";

type GuestWeatherState =
  | { ok: true; data: WeatherForecastResult }
  | { ok: false; error: string };

type GuestWeatherSectionProps = {
  destination: string;
  startDate: string;
  endDate: string;
};

export function GuestWeatherSection({
  destination,
  startDate,
  endDate,
}: GuestWeatherSectionProps) {
  const [weather, setWeather] = useState<GuestWeatherState | null>(null);

  useEffect(() => {
    let cancelled = false;
    setWeather(null);

    void (async () => {
      try {
        const result = await getGuestWeatherForecast({
          destination,
          startDate,
          endDate,
        });
        if (cancelled) return;
        if (!result.ok) {
          setWeather({
            ok: false,
            error: result.error || "Weather data temporarily unavailable",
          });
          return;
        }
        setWeather({ ok: true, data: result.data });
      } catch (error) {
        if (!cancelled) {
          setWeather({
            ok: false,
            error:
              error instanceof Error
                ? error.message
                : "Weather data temporarily unavailable",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [destination, startDate, endDate]);

  if (!weather) {
    return <TripWeatherForecastSkeleton />;
  }

  return (
    <TripWeatherForecast
      weather={weather}
      startDate={startDate}
      endDate={endDate}
    />
  );
}
