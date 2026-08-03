"use client";

import { useEffect, useState } from "react";
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
        const params = new URLSearchParams({
          destination,
          startDate,
          endDate,
        });
        const res = await fetch(`/api/weather?${params.toString()}`);
        const body = (await res.json()) as WeatherForecastResult & {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(body.error ?? "Weather data temporarily unavailable");
        }
        if (!cancelled) {
          setWeather({ ok: true, data: body });
        }
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
