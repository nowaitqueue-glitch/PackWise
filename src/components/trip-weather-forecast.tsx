"use client";

import { useEffect, useRef, useState } from "react";
import { Droplets } from "lucide-react";
import type { DailyForecast, WeatherResultState } from "@/lib/weather";
import {
  isKnownForecastDay,
  isProjectedForecastDay,
} from "@/lib/weather";
import { WeatherConditionIcon } from "@/components/weather-condition-icon";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  cn,
  glassCardHover,
  glassChip,
  sectionTitleClass,
  solidContentCard,
} from "@/lib/utils";

function todayISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatWeekday(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
  });
}

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function formatRainPercent(rainChance: number): string {
  return `${Math.round(rainChance * 100)}%`;
}

function countInclusiveDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = new Date(`${endDate}T00:00:00`).getTime();
  return Math.round((end - start) / 86_400_000) + 1;
}

function DayForecastCard({
  day,
  dayIndex,
  highlighted,
  debugCoords,
}: {
  day: DailyForecast;
  dayIndex: number;
  highlighted: boolean;
  debugCoords?: { lat: number; lon: number } | null;
}) {
  const projected = isProjectedForecastDay(day);

  return (
    <div
      className={cn(
        "flex min-w-[8.5rem] shrink-0 flex-col items-center gap-2 px-3 py-4 text-center sm:min-w-[9.5rem]",
        solidContentCard,
        // Opaque enough that forecast type stays legible over scenic trip backdrops.
        "bg-white/95 dark:bg-gray-950/95",
        glassCardHover,
        highlighted && "border-primary/50 ring-2 ring-primary/30",
        // Dashed border marks projection without dimming all text via opacity.
        projected && "border-dashed"
      )}
    >
      <div className="flex flex-col items-center">
        <p className="text-sm font-semibold tracking-tight text-foreground dark:text-slate-100">
          {formatWeekday(day.date)}
        </p>
        <p className="text-xs tabular-nums text-slate-600 dark:text-slate-300">
          {formatShortDate(day.date)}
        </p>
      </div>

      <span
        className={cn(
          "px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 dark:text-slate-300",
          glassChip,
          "bg-white/90 dark:bg-slate-950/90"
        )}
      >
        Day {dayIndex + 1}
      </span>

      <WeatherConditionIcon
        condition={day.condition}
        iconCode={day.icon}
        className="h-8 w-8 text-foreground dark:text-slate-100"
      />

      <p className="line-clamp-2 text-xs capitalize text-slate-600 dark:text-slate-300">
        {day.condition}
      </p>

      <p className="flex items-baseline gap-1 text-base tabular-nums">
        <span className="font-bold text-foreground dark:text-slate-50">
          {day.highTemp}°
        </span>
        <span className="text-slate-500 dark:text-slate-400">/</span>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {day.lowTemp}°
        </span>
      </p>

      <p className="flex items-center gap-1 text-xs font-medium tabular-nums text-sky-700 dark:text-sky-300">
        <Droplets className="size-3.5 shrink-0" aria-hidden />
        {formatRainPercent(day.rainChance ?? 0)}
        <span className="sr-only">chance of rain</span>
      </p>

      {debugCoords ? (
        <p className="font-mono text-[9px] leading-tight text-slate-500 dark:text-slate-400">
          {debugCoords.lat.toFixed(4)},{debugCoords.lon.toFixed(4)}
        </p>
      ) : null}
    </div>
  );
}

function WeatherUnavailableCard({ message }: { message?: string }) {
  return (
    <Card
      className={cn(
        "w-full",
        solidContentCard,
        "bg-white/95 dark:bg-gray-950/95",
        glassCardHover
      )}
    >
      <CardHeader>
        <CardTitle className={sectionTitleClass}>Weather forecast</CardTitle>
        <CardDescription className="text-slate-600 dark:text-slate-300">
          Destination forecast
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {message ?? "Weather data temporarily unavailable"}
        </p>
      </CardContent>
    </Card>
  );
}

type TripWeatherForecastProps = {
  weather: WeatherResultState;
  startDate: string;
  endDate: string;
};

export function TripWeatherForecast({
  weather,
  startDate,
  endDate,
}: TripWeatherForecastProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const days = weather.ok ? weather.data.days : [];

  useEffect(() => {
    const el = railRef.current;
    if (!el) {
      setIsOverflowing(false);
      return;
    }

    const checkOverflow = () => {
      setIsOverflowing(el.scrollWidth > el.clientWidth);
    };

    checkOverflow();

    const observer = new ResizeObserver(checkOverflow);
    observer.observe(el);
    for (const child of Array.from(el.children)) {
      observer.observe(child);
    }

    return () => observer.disconnect();
  }, [days.length]);

  if (!weather.ok) {
    return <WeatherUnavailableCard message={weather.error} />;
  }

  const { locationName, lat, lon } = weather.data;

  if (days.length === 0) {
    return <WeatherUnavailableCard />;
  }

  const knownDays = days.filter(isKnownForecastDay);
  const today = todayISODate();
  const tripDayCount = countInclusiveDays(startDate, endDate);
  const projectedCount = days.filter(isProjectedForecastDay).length;
  const forecastCount = knownDays.length - projectedCount;
  const highlightDate =
    days.some((d) => d.date === today) ? today : startDate;
  const debugCoords =
    process.env.NEXT_PUBLIC_DEBUG_WEATHER === "true" &&
    typeof lat === "number" &&
    typeof lon === "number"
      ? { lat, lon }
      : null;

  return (
    <Card
      className={cn(
        "w-full",
        solidContentCard,
        "bg-white/95 dark:bg-gray-950/95",
        glassCardHover
      )}
    >
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className={sectionTitleClass}>Weather forecast</CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-300">
              {locationName}
              {projectedCount > 0
                ? " · Later days use seasonal averages"
                : null}
            </CardDescription>
          </div>
          {isOverflowing ? (
            <p
              className={cn(
                "shrink-0 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300",
                glassChip,
                "bg-white/90 dark:bg-slate-950/90"
              )}
            >
              swipe →
            </p>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="relative -mx-1">
          <div
            ref={railRef}
            className="snap-rail no-scrollbar flex gap-3 overflow-x-auto scroll-smooth px-1 py-1"
            aria-label="Daily forecast"
          >
            {days.map((day, index) => (
              <DayForecastCard
                key={day.date}
                day={day}
                dayIndex={index}
                highlighted={day.date === highlightDate}
                debugCoords={debugCoords}
              />
            ))}
          </div>
          {isOverflowing ? (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent"
            />
          ) : null}
        </div>
        {projectedCount > 0 ? (
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Showing {forecastCount} forecast day
            {forecastCount === 1 ? "" : "s"} and {projectedCount} projected day
            {projectedCount === 1 ? "" : "s"} across {tripDayCount} trip days.
          </p>
        ) : (
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {forecastCount}-day forecast across {tripDayCount} trip day
            {tripDayCount === 1 ? "" : "s"}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
