import { getTripWeather } from "@/app/dashboard/weather-actions";
import { TripSceneConditionSync } from "@/components/trip-scene-background";
import { TripWeatherForecast } from "@/components/trip-weather-forecast";
import { isKnownForecastDay } from "@/lib/weather";

type TripWeatherSectionProps = {
  tripId: string;
  startDate: string;
  endDate: string;
};

/**
 * Async server component that resolves trip weather (cache → Open-Meteo).
 * Rendered inside a <Suspense> boundary so the slow forecast fetch streams in
 * without blocking the trip header / packing list from reaching the client.
 * Also syncs the first-day condition into TripSceneBackgroundRoot when available.
 */
export async function TripWeatherSection({
  tripId,
  startDate,
  endDate,
}: TripWeatherSectionProps) {
  const weather = await getTripWeather(tripId);

  const firstDayCondition =
    weather.ok
      ? (weather.data.days.find(isKnownForecastDay) ?? weather.data.days[0])
          ?.condition ?? null
      : null;

  const syncCondition =
    firstDayCondition &&
    firstDayCondition !== "unavailable" &&
    firstDayCondition !== "unknown"
      ? firstDayCondition
      : null;

  return (
    <>
      <TripSceneConditionSync condition={syncCondition} />
      <TripWeatherForecast
        weather={weather}
        startDate={startDate}
        endDate={endDate}
      />
    </>
  );
}
