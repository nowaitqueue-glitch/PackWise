import { getTripWeather } from "@/app/dashboard/weather-actions";
import { TripSceneForecastSync } from "@/components/trip-scene-background";
import { TripWeatherForecast } from "@/components/trip-weather-forecast";

type TripWeatherSectionProps = {
  tripId: string;
  startDate: string;
  endDate: string;
};

/**
 * Async server component that resolves trip weather (cache → Open-Meteo).
 * Rendered inside a <Suspense> boundary so the slow forecast fetch streams in
 * without blocking the trip header / packing list from reaching the client.
 */
export async function TripWeatherSection({
  tripId,
  startDate,
  endDate,
}: TripWeatherSectionProps) {
  const weather = await getTripWeather(tripId);

  const forecastConditions =
    weather.ok
      ? weather.data.days.map((day) => day.condition)
      : [];

  return (
    <>
      <TripSceneForecastSync conditions={forecastConditions} />
      <TripWeatherForecast
        weather={weather}
        startDate={startDate}
        endDate={endDate}
      />
    </>
  );
}
