import type { DailyForecast } from "@/lib/weather";
import {
  isKnownForecastDay,
  isProjectedForecastDay,
} from "@/lib/weather";
import type { GetTripWeatherState } from "@/app/dashboard/weather-actions";
import { WeatherConditionIcon } from "@/components/weather-condition-icon";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

function todayISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDayLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
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
        "min-w-[100px] shrink-0 snap-start rounded-lg border px-3 py-3 text-center",
        highlighted
          ? "border-primary/40 bg-primary/5"
          : "border-border/80 bg-muted/30",
        projected && "border-dashed opacity-80"
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">
        {formatDayLabel(day.date)}
      </p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/80">
        Day {dayIndex + 1}
      </p>

      <div className="mt-2 flex justify-center">
        <WeatherConditionIcon
          condition={day.condition}
          iconCode={day.icon}
          className="h-7 w-7 text-foreground"
        />
      </div>

      <p className="mt-2 text-xs capitalize text-foreground/90">
        {day.condition}
      </p>
      <p className="mt-1 text-sm tabular-nums">
        <span className="text-muted-foreground">{day.lowTemp}°</span>
        <span className="text-muted-foreground"> / </span>
        <span className="font-semibold">{day.highTemp}°</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        🌧 {formatRainPercent(day.rainChance ?? 0)}
      </p>
      {debugCoords ? (
        <p className="mt-1 font-mono text-[9px] leading-tight text-muted-foreground/70">
          {debugCoords.lat.toFixed(4)},{debugCoords.lon.toFixed(4)}
        </p>
      ) : null}
    </div>
  );
}

function WeatherUnavailableCard({ message }: { message?: string }) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Weather forecast</CardTitle>
        <CardDescription>Destination forecast</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {message ?? "Weather data temporarily unavailable"}
        </p>
      </CardContent>
    </Card>
  );
}

type TripWeatherForecastProps = {
  weather: GetTripWeatherState;
  startDate: string;
  endDate: string;
};

export function TripWeatherForecast({
  weather,
  startDate,
  endDate,
}: TripWeatherForecastProps) {
  if (!weather.ok) {
    return <WeatherUnavailableCard message={weather.error} />;
  }

  const { days, locationName, lat, lon } = weather.data;

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
  const showSwipeHint = days.length > 3;
  const debugCoords =
    process.env.NEXT_PUBLIC_DEBUG_WEATHER === "true" &&
    typeof lat === "number" &&
    typeof lon === "number"
      ? { lat, lon }
      : null;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">Weather forecast</CardTitle>
            <CardDescription>
              {locationName}
              {projectedCount > 0
                ? " · Later days use seasonal averages"
                : null}
            </CardDescription>
          </div>
          {showSwipeHint ? (
            <p className="shrink-0 text-xs text-muted-foreground sm:hidden">
              swipe →
            </p>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth rounded-2xl border border-white/20 bg-white/30 p-3 pb-2 backdrop-blur-md dark:border-white/10 dark:bg-white/10">
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
        {projectedCount > 0 ? (
          <p className="text-xs text-muted-foreground">
            Showing {forecastCount} forecast day
            {forecastCount === 1 ? "" : "s"} and {projectedCount} projected day
            {projectedCount === 1 ? "" : "s"} across {tripDayCount} trip days.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {forecastCount}-day forecast across {tripDayCount} trip day
            {tripDayCount === 1 ? "" : "s"}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
