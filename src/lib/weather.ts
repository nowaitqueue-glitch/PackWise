import axios from "axios";
import { getClimateFallbackDays } from "@/lib/climate";

/**
 * Open-Meteo daily forecast covers up to 16 days from today.
 * Days beyond that window use static climate averages and are marked
 * `projected: true` / `source: "climate"`.
 *
 * No API key required.
 */

export const OPEN_METEO_FORECAST_DAYS = 16;

export type DailyForecast = {
  date: string; // YYYY-MM-DD
  /** Condition label for UI / packing templates. */
  condition: string;
  /** Daily high (°C). Null only for legacy cached rows. */
  highTemp: number | null;
  /** Daily low (°C). Null only for legacy cached rows. */
  lowTemp: number | null;
  /** 0–1. Null only for legacy cached rows. */
  rainChance: number | null;
  /** Emoji icon from forecast or climate data. */
  icon: string | null;
  /** True when estimated from climate averages (beyond real forecast). */
  projected?: boolean;
  /** Data origin for UI badges. */
  source?: "forecast" | "climate";
  /** Present for days with no usable estimate (legacy cache only). */
  message?: string;
};

/** Shape returned by {@link getWeatherFromOpenMeteo}. */
export type OpenMeteoDayForecast = {
  date: string;
  tempMax: number;
  tempMin: number;
  /** 0–100 */
  rainChance: number;
  condition: string;
  /** Emoji */
  icon: string;
};

export type WeatherForecastResult = {
  destination: string;
  locationName: string;
  days: DailyForecast[];
  /** Geocoded latitude (Open-Meteo). Omitted when climate-only / geocode failed. */
  lat?: number;
  /** Geocoded longitude (Open-Meteo). Omitted when climate-only / geocode failed. */
  lon?: number;
};

/** Result shape shared by weather UI (client) and server actions. */
export type WeatherResultState =
  | { ok: true; data: WeatherForecastResult }
  | { ok: false; error: string; code?: string };

export class WeatherError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "INVALID_DATES"
      | "GEOCODE_NOT_FOUND"
      | "API_ERROR"
  ) {
    super(message);
    this.name = "WeatherError";
  }
}

type ParsedDestination = {
  city: string;
  countryCode?: string;
  raw: string;
};

type GeocodeResult = {
  name: string;
  lat: number;
  lon: number;
  timezone?: string;
  country?: string;
  countryCode?: string;
  admin1?: string;
};

type OpenMeteoGeocodeHit = {
  name: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  country?: string;
  country_code?: string;
  admin1?: string;
};

type OpenMeteoGeocodeResponse = {
  results?: OpenMeteoGeocodeHit[];
};

type OpenMeteoDailyForecast = {
  time: string[];
  weathercode?: number[];
  weather_code?: number[];
  temperature_2m_max?: (number | null)[];
  temperature_2m_min?: (number | null)[];
  precipitation_probability_max?: (number | null)[];
};

type OpenMeteoHourlyForecast = {
  time?: string[];
  weathercode?: (number | null)[];
  weather_code?: (number | null)[];
  /** 1 during daylight, 0 at night (Open-Meteo `is_day`). */
  is_day?: (number | null)[];
  /** Per-hour precipitation probability, 0–100. */
  precipitation_probability?: (number | null)[];
};

/**
 * Daytime-derived summary for one local calendar day: the representative
 * DAYTIME weathercode plus the DAYTIME precipitation probability. Keeping the
 * probability alongside the code lets the displayed rain % and the icon agree
 * (both reflect daylight hours, not a nighttime spike).
 */
type DaytimeInfo = {
  code: number;
  /** Max precipitation probability across daylight hours (0–100), or null. */
  precipProb: number | null;
};

type OpenMeteoForecastResponse = {
  daily?: OpenMeteoDailyForecast;
  hourly?: OpenMeteoHourlyForecast;
};

export type KnownDailyForecast = DailyForecast & {
  condition: string;
  highTemp: number;
  lowTemp: number;
  rainChance: number;
};

type WmoWeatherInfo = {
  condition: string;
  icon: string;
};

const CONDITION_EMOJI: Record<string, string> = {
  Clear: "☀️",
  Sunny: "☀️",
  "Partly Cloudy": "⛅",
  Overcast: "☁️",
  Clouds: "☁️",
  Fog: "🌫️",
  Mist: "🌫️",
  Rain: "🌧️",
  Drizzle: "🌦️",
  Showers: "🌦️",
  "Rain showers": "🌦️",
  Snow: "❄️",
  "Snow showers": "❄️",
  Thunderstorm: "⛈️",
  Seasonal: "🌍",
  "Mild climate": "🌤️",
};

/** True for placeholder days (incl. legacy cached `"unknown"`). */
export function isUnavailableForecastDay(day: DailyForecast): boolean {
  return day.condition === "unavailable" || day.condition === "unknown";
}

export function isProjectedForecastDay(day: DailyForecast): boolean {
  return (
    (day.projected === true || day.source === "climate") &&
    !isUnavailableForecastDay(day)
  );
}

export function isKnownForecastDay(day: DailyForecast): day is KnownDailyForecast {
  return (
    !isUnavailableForecastDay(day) &&
    day.highTemp !== null &&
    day.lowTemp !== null &&
    day.rainChance !== null
  );
}

/**
 * Parse `"Berlin, DE"` → city + optional ISO country code.
 * Without a comma, the full string is treated as the city name.
 */
export function parseDestination(destination: string): ParsedDestination {
  const raw = destination.trim();
  const commaIndex = raw.lastIndexOf(",");
  if (commaIndex === -1) {
    return { raw, city: raw };
  }

  const city = raw.slice(0, commaIndex).trim();
  const countryCode = raw.slice(commaIndex + 1).trim().toUpperCase();
  return {
    raw,
    city: city || raw,
    countryCode: countryCode.length === 2 ? countryCode : undefined,
  };
}

/**
 * Map WMO weather interpretation codes → condition label + emoji.
 * Codes match Open-Meteo / WMO WWMA exactly.
 * @see https://open-meteo.com/en/docs
 */
export function wmoWeatherInfo(code: number | null | undefined): WmoWeatherInfo {
  if (code == null || !Number.isFinite(code)) {
    return { condition: "Clouds", icon: "☁️" };
  }
  // 0 Clear sky · 1 Mainly clear
  if (code === 0 || code === 1) return { condition: "Clear", icon: "☀️" };
  // 2 Partly cloudy
  if (code === 2) return { condition: "Partly Cloudy", icon: "⛅" };
  // 3 Overcast
  if (code === 3) return { condition: "Overcast", icon: "☁️" };
  // 45 Fog · 48 Depositing rime fog
  if (code === 45 || code === 48) return { condition: "Fog", icon: "🌫️" };
  // 51–55 Drizzle · 56–57 Freezing drizzle
  if (code >= 51 && code <= 57) return { condition: "Drizzle", icon: "🌦️" };
  // 61–65 Rain · 66–67 Freezing rain
  if (code >= 61 && code <= 67) return { condition: "Rain", icon: "🌧️" };
  // 71–75 Snow fall · 77 Snow grains
  if (code >= 71 && code <= 77) return { condition: "Snow", icon: "❄️" };
  // 80–82 Rain showers slight/moderate/violent
  if (code >= 80 && code <= 82) return { condition: "Showers", icon: "🌦️" };
  // 85–86 Snow showers slight/heavy
  if (code >= 85 && code <= 86) {
    return { condition: "Snow showers", icon: "❄️" };
  }
  // 95 Thunderstorm · 96/99 Thunderstorm with slight/heavy hail
  if (code === 95 || code === 96 || code === 99) {
    return { condition: "Thunderstorm", icon: "⛈️" };
  }
  return { condition: "Clouds", icon: "☁️" };
}

/** Map WMO weather interpretation codes to PackWise condition labels. */
export function conditionFromWeatherCode(
  code: number | null | undefined
): string {
  return wmoWeatherInfo(code).condition;
}

export function emojiForCondition(condition: string): string {
  return CONDITION_EMOJI[condition] ?? "☁️";
}

function logWeather(step: string, detail?: unknown): void {
  if (detail === undefined) {
    console.log(`[weather] ${step}`);
    return;
  }
  console.log(`[weather] ${step}`, detail);
}

function parseDateOnly(value: string): string {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new WeatherError(
      `Invalid date format "${value}". Use YYYY-MM-DD.`,
      "INVALID_DATES"
    );
  }
  return trimmed;
}

function assertDateRange(startDate: string, endDate: string): void {
  if (endDate < startDate) {
    throw new WeatherError(
      "End date must be on or after the start date.",
      "INVALID_DATES"
    );
  }
}

function addDaysISO(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function todayISODate(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Inclusive calendar days from startDate through endDate. */
export function enumerateTripDates(
  startDate: string,
  endDate: string
): string[] {
  const dates: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    dates.push(cursor);
    cursor = addDaysISO(cursor, 1);
  }
  return dates;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function rainChance01FromPercent(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.round(clamp01(value / 100) * 100) / 100;
}

function rainChancePercent(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function daysBetween(a: string, b: string): number {
  const msA = new Date(`${a}T00:00:00`).getTime();
  const msB = new Date(`${b}T00:00:00`).getTime();
  return Math.round(Math.abs(msA - msB) / 86_400_000);
}

function pickGeocodeHit(
  results: OpenMeteoGeocodeHit[] | undefined,
  countryCode?: string
): OpenMeteoGeocodeHit | undefined {
  if (!results?.length) return undefined;
  const code = countryCode?.trim().toUpperCase();
  if (!code) return results[0];

  const match = results.find(
    (r) => r.country_code?.trim().toUpperCase() === code
  );
  if (match) return match;

  const fallback = results[0];
  console.warn(
    `[weather] geocode: no result with country_code=${code}; falling back to first hit`,
    {
      requestedCountry: code,
      fallbackName: fallback.name,
      fallbackCountry: fallback.country_code,
      fallbackAdmin1: fallback.admin1,
      candidateCountries: results.map((r) => r.country_code),
    }
  );
  return fallback;
}

/**
 * Open-Meteo geocoding uses `name=` (not `q=`). Prefer `name={city}` plus
 * `countryCode=` when available — `name=City,CC` often returns zero hits.
 */
function buildGeocodeUrl(city: string, countryCode?: string): string {
  const params = new URLSearchParams({
    name: city,
    count: "10",
    language: "en",
    format: "json",
  });
  const code = countryCode?.trim().toUpperCase();
  if (code) {
    params.set("countryCode", code);
  }
  return `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`;
}

function buildForecastUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "weathercode",
    ].join(","),
    // Hourly weathercode + is_day let us derive a Google-like DAYTIME condition
    // instead of the daily code (which reflects the worst code across all 24h).
    // precipitation_probability lets us show a DAYTIME rain % that agrees with
    // the daytime icon (the daily *_max can peak at night). Still one request.
    hourly: ["weathercode", "is_day", "precipitation_probability"].join(","),
    // CRITICAL: timezone=auto makes Open-Meteo aggregate daily min/max and align
    // day boundaries to the destination's LOCAL time. Without it, days are cut on
    // UTC boundaries, shifting highs/lows and dates vs Google.
    timezone: "auto",
    // Whole-degree defaults match Google; Open-Meteo defaults are °C + km/h.
    temperature_unit: "celsius",
    windspeed_unit: "kmh",
    precipitation_unit: "mm",
    forecast_days: String(OPEN_METEO_FORECAST_DAYS),
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

async function geocodeDestination(
  city: string,
  countryCode?: string
): Promise<GeocodeResult | null> {
  const url = buildGeocodeUrl(city, countryCode);
  logWeather("geocode request", { city, countryCode, url });

  try {
    const { data } = await axios.get<OpenMeteoGeocodeResponse>(url, {
      timeout: 30_000,
    });

    const hit = pickGeocodeHit(data.results, countryCode);
    if (!hit) {
      logWeather("geocode result", { found: false, city, countryCode });
      return null;
    }

    const result: GeocodeResult = {
      name: hit.name,
      lat: hit.latitude,
      lon: hit.longitude,
      timezone: hit.timezone,
      country: hit.country,
      countryCode: hit.country_code,
      admin1: hit.admin1,
    };
    console.log("[weather] chosen location", {
      city: result.name,
      country: result.country,
      countryCode: result.countryCode,
      admin1: result.admin1,
      latitude: result.lat,
      longitude: result.lon,
    });
    return result;
  } catch (error) {
    logWeather("geocode failed", error instanceof Error ? error.message : error);
    return null;
  }
}

async function fetchDailyForecast(
  lat: number,
  lon: number
): Promise<OpenMeteoForecastResponse | null> {
  const url = buildForecastUrl(lat, lon);
  logWeather("forecast request", { url });

  try {
    const { data } = await axios.get<OpenMeteoForecastResponse>(url, {
      timeout: 30_000,
    });
    const dayCount = data.daily?.time?.length ?? 0;
    logWeather("forecast response", { dayCount });
    return data;
  } catch (error) {
    logWeather(
      "forecast failed",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/** WMO codes ≥ 51 are precipitation (drizzle/rain/snow/showers/thunderstorm). */
function isPrecipitationCode(code: number | null | undefined): boolean {
  return typeof code === "number" && Number.isFinite(code) && code >= 51;
}

/** True for thunderstorm codes (95 = storm, 96/99 = storm with hail). */
function isThunderstormCode(code: number | null | undefined): boolean {
  return code === 95 || code === 96 || code === 99;
}

/**
 * Precipitation "severity" ranking used to surface the most SIGNIFICANT weather
 * during the day instead of the most FREQUENT. A handful of thunderstorm/rain
 * hours matter far more for packing than numerous drizzle hours, so plain
 * mode-of-the-day hides them. Order (high→low): thunderstorm > rain > showers >
 * drizzle > snow > non-precip (0).
 */
function precipSeverity(code: number | null | undefined): number {
  if (typeof code !== "number" || !Number.isFinite(code)) return 0;
  if (isThunderstormCode(code)) return 5; // 95/96/99 thunderstorm
  if (code >= 61 && code <= 67) return 4; // 61–67 rain / freezing rain
  if (code >= 80 && code <= 82) return 3; // 80–82 rain showers
  if (code >= 51 && code <= 57) return 2; // 51–57 drizzle
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 1; // snow
  return 0;
}

/**
 * Pick the most SEVERE precip code (see {@link precipSeverity}); within the same
 * severity tier prefer the higher (more intense) code, e.g. 96 > 95, 65 > 61.
 */
function pickMostSeverePrecip(codes: number[]): number {
  let best = codes[0];
  let bestSeverity = -1;
  for (const c of codes) {
    const s = precipSeverity(c);
    if (s > bestSeverity || (s === bestSeverity && c > best)) {
      best = c;
      bestSeverity = s;
    }
  }
  return best;
}

/**
 * Pick the most FREQUENT code; ties broken toward the more significant (higher)
 * code. Used for the daytime SKY state when there's no meaningful precipitation.
 */
function pickMostFrequent(codes: number[]): number {
  const counts = new Map<number, number>();
  for (const c of codes) counts.set(c, (counts.get(c) ?? 0) + 1);
  let best = codes[0];
  let bestCount = 0;
  for (const [code, count] of Array.from(counts.entries())) {
    if (count > bestCount || (count === bestCount && code > best)) {
      best = code;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Open-Meteo's DAILY weathercode is the most significant code across the full
 * 24h (including night), so a clear day with a brief overnight shower reads as
 * "Overcast"/"Rain" — cloudier/wetter than Google's daytime-focused summary.
 *
 * Derive a representative DAYTIME condition from hourly codes instead:
 * - Thunderstorms are short but critical to pack for, so ANY daytime storm hour
 *   surfaces a thunderstorm — never averaged away by more numerous cloudy hours.
 * - If precipitation meaningfully fills the daytime (≥2 daytime precip hours, or
 *   the DAYTIME precip probability is ≥40% with ≥1 precip hour), surface the
 *   most SEVERE precip type (severity-weighted, not mode) so a few rain/shower
 *   hours aren't hidden behind numerous drizzle hours.
 * - Otherwise show the dominant daytime sky state. When the daytime rain chance
 *   is high (≥50%) we avoid a misleadingly sunny icon by surfacing the cloudiest
 *   sky code present — without regressing the "not overcast every day" fix, since
 *   this only triggers on genuinely high-chance days.
 * Falls back to the daily code when no hourly data is available.
 */
function representativeDaytimeCode(
  daytimeCodes: number[],
  daytimePrecipProb: number | null | undefined,
  dailyProbMax: number | null | undefined,
  fallback: number | null | undefined
): number | null | undefined {
  const codes = daytimeCodes.filter((c) => Number.isFinite(c));
  if (codes.length === 0) return fallback;

  const precip = codes.filter(isPrecipitationCode);

  // Always surface daytime thunderstorms regardless of frequency/probability —
  // they're brief but the single most important condition to reflect.
  const thunder = precip.filter(isThunderstormCode);
  if (thunder.length > 0) return Math.max(...thunder);

  // Prefer the DAYTIME precip probability so the threshold (and the % we show)
  // reflect daylight; fall back to the daily max when hourly prob is missing.
  const prob =
    typeof daytimePrecipProb === "number"
      ? daytimePrecipProb
      : typeof dailyProbMax === "number"
      ? dailyProbMax
      : 0;

  // Loosened from the old (≥2 hrs OR ≥50%) rule so light-but-real rain isn't
  // dropped: 2+ daytime precip hours, OR ≥40% daytime chance with ≥1 precip hour.
  const meaningfulPrecip =
    precip.length >= 2 || (prob >= 40 && precip.length >= 1);
  if (meaningfulPrecip) return pickMostSeverePrecip(precip);

  // No meaningful precip → dominant daytime SKY state.
  const skyCodes = codes.filter((c) => !isPrecipitationCode(c));
  const pool = skyCodes.length > 0 ? skyCodes : codes;
  // On high-chance days, don't show a sunny icon next to a high rain %: surface
  // the cloudiest sky code (overcast > partly cloudy > clear) instead of the
  // most frequent one. Gated on ≥50% so ordinary days keep their real sky state.
  if (prob >= 50) {
    const cloudCodes = pool.filter((c) => c >= 0 && c <= 3);
    if (cloudCodes.length > 0) return Math.max(...cloudCodes);
  }
  return pickMostFrequent(pool);
}

/**
 * Map each LOCAL forecast date → daytime weathercode + daytime precip prob.
 * Hourly `time` is already in destination-local tz (timezone=auto), so the
 * date prefix groups hours into the same calendar day Open-Meteo used for daily.
 */
function buildDaytimeInfoMap(
  daily: OpenMeteoDailyForecast | undefined,
  hourly: OpenMeteoHourlyForecast | undefined
): Map<string, DaytimeInfo> {
  const map = new Map<string, DaytimeInfo>();
  const times = hourly?.time;
  const hourlyCodes = hourly?.weathercode ?? hourly?.weather_code;
  if (!daily?.time?.length || !times?.length || !hourlyCodes?.length) return map;

  const hourlyProb = hourly?.precipitation_probability;
  const codesByDate = new Map<string, number[]>();
  const probByDate = new Map<string, number[]>();
  for (let i = 0; i < times.length; i++) {
    if (hourly?.is_day?.[i] !== 1) continue; // daytime hours only
    const date = times[i].slice(0, 10);
    const code = hourlyCodes[i];
    if (typeof code === "number") {
      const list = codesByDate.get(date);
      if (list) list.push(code);
      else codesByDate.set(date, [code]);
    }
    const p = hourlyProb?.[i];
    if (typeof p === "number" && Number.isFinite(p)) {
      const list = probByDate.get(date);
      if (list) list.push(p);
      else probByDate.set(date, [p]);
    }
  }

  for (let i = 0; i < daily.time.length; i++) {
    const date = daily.time[i];
    const dailyCode = daily.weathercode?.[i] ?? daily.weather_code?.[i];
    const probs = probByDate.get(date);
    // Daytime rain chance = max across daylight hours, so the % reflects the
    // day's peak (not a nighttime spike) and lines up with the daytime icon.
    const daytimeProb = probs && probs.length > 0 ? Math.max(...probs) : null;
    const rep = representativeDaytimeCode(
      codesByDate.get(date) ?? [],
      daytimeProb,
      daily.precipitation_probability_max?.[i],
      dailyCode
    );
    if (typeof rep === "number") {
      map.set(date, { code: rep, precipProb: daytimeProb });
    }
  }
  return map;
}

function openMeteoDayFromIndex(
  index: number,
  daily: OpenMeteoDailyForecast,
  daytimeInfoByDate?: Map<string, DaytimeInfo>
): OpenMeteoDayForecast | null {
  const date = daily.time[index];
  const high = daily.temperature_2m_max?.[index];
  const low = daily.temperature_2m_min?.[index];
  if (!date || typeof high !== "number" || typeof low !== "number") {
    return null;
  }

  const dailyCode = daily.weathercode?.[index] ?? daily.weather_code?.[index];
  const info = daytimeInfoByDate?.get(date);
  // Prefer the daytime-derived condition (Google-like); fall back to daily code.
  const code = info?.code ?? dailyCode;
  const { condition, icon } = wmoWeatherInfo(code);
  // Prefer the DAYTIME precip probability so the % agrees with the daytime icon;
  // fall back to the daily max when hourly probability is unavailable.
  const rainChance =
    info?.precipProb != null
      ? rainChancePercent(info.precipProb)
      : rainChancePercent(daily.precipitation_probability_max?.[index]);
  return {
    date,
    // Whole-degree rounding to match Google's display.
    tempMax: Math.round(high),
    tempMin: Math.round(low),
    rainChance,
    condition,
    icon,
  };
}

function forecastDayFromOpenMeteo(
  date: string,
  index: number,
  daily: OpenMeteoDailyForecast,
  daytimeInfoByDate?: Map<string, DaytimeInfo>
): DailyForecast | null {
  const day = openMeteoDayFromIndex(index, daily, daytimeInfoByDate);
  if (!day) return null;

  const matchedDate = day.date === date ? date : day.date;
  return {
    date: matchedDate,
    condition: day.condition,
    highTemp: day.tempMax,
    lowTemp: day.tempMin,
    rainChance: rainChance01FromPercent(day.rainChance),
    icon: day.icon,
    projected: false,
    source: "forecast",
  };
}

function buildForecastMap(
  daily: OpenMeteoDailyForecast | undefined,
  daytimeInfoByDate?: Map<string, DaytimeInfo>
): Map<string, DailyForecast> {
  const map = new Map<string, DailyForecast>();
  if (!daily?.time?.length) return map;

  for (let i = 0; i < daily.time.length; i++) {
    const date = daily.time[i];
    const day = forecastDayFromOpenMeteo(date, i, daily, daytimeInfoByDate);
    if (day) map.set(date, day);
  }
  return map;
}

function findNearestForecastDay(
  date: string,
  forecastByDate: Map<string, DailyForecast>
): DailyForecast | null {
  if (forecastByDate.size === 0) return null;

  let best: DailyForecast | null = null;
  let bestDistance = Infinity;
  for (const [forecastDate, day] of Array.from(forecastByDate.entries())) {
    const distance = daysBetween(date, forecastDate);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { ...day, date };
    }
  }
  return best;
}

/**
 * Last calendar date covered by a real Open-Meteo forecast (today + 15 days).
 */
export function forecastWindowEndDate(today = todayISODate()): string {
  return addDaysISO(today, OPEN_METEO_FORECAST_DAYS - 1);
}

function locationLabel(
  destination: string,
  place?: GeocodeResult | null
): string {
  if (!place) return destination;
  const parts = [place.name, place.admin1, place.country].filter(Boolean);
  return parts.join(", ");
}

/**
 * Geocode a city (optional country filter) and return a 16-day daily forecast.
 * No API key. Rain chance is 0–100; icon is an emoji.
 */
export async function getWeatherFromOpenMeteo(
  city: string,
  countryCode?: string
): Promise<OpenMeteoDayForecast[]> {
  const name = city.trim();
  if (!name) {
    throw new WeatherError("City is required.", "INVALID_DATES");
  }

  logWeather("getWeatherFromOpenMeteo", { city: name, countryCode });

  const place = await geocodeDestination(name, countryCode);
  if (!place) {
    throw new WeatherError(
      `Could not find coordinates for "${name}".`,
      "GEOCODE_NOT_FOUND"
    );
  }

  const forecast = await fetchDailyForecast(place.lat, place.lon);
  const daily = forecast?.daily;
  if (!daily?.time?.length) {
    throw new WeatherError("Forecast response was empty.", "API_ERROR");
  }

  const daytimeInfoByDate = buildDaytimeInfoMap(daily, forecast?.hourly);
  const days: OpenMeteoDayForecast[] = [];
  for (let i = 0; i < daily.time.length; i++) {
    const day = openMeteoDayFromIndex(i, daily, daytimeInfoByDate);
    if (day) days.push(day);
  }
  return days;
}

/**
 * Fetches a daily weather summary for a destination and date range.
 * Uses Open-Meteo geocoding + 16-day daily forecast. Every trip day receives
 * either a real forecast or a static climate average — no unavailable gaps.
 */
export async function getWeatherForecast(params: {
  destination: string;
  startDate: string;
  endDate: string;
  countryCode?: string;
}): Promise<WeatherForecastResult> {
  const destination = params.destination.trim();
  if (!destination) {
    throw new WeatherError("Destination is required.", "INVALID_DATES");
  }

  const startDate = parseDateOnly(params.startDate);
  const endDate = parseDateOnly(params.endDate);
  assertDateRange(startDate, endDate);

  const parsed = parseDestination(destination);
  const city = parsed.city;
  const countryCode = params.countryCode ?? parsed.countryCode;

  logWeather("received destination", {
    destination,
    city,
    countryCode,
    startDate,
    endDate,
  });

  const tripDates = enumerateTripDates(startDate, endDate);

  const place = await geocodeDestination(city, countryCode);
  if (!place) {
    logWeather("using climate fallback for entire trip (geocode failed)", {
      destination,
      days: tripDates.length,
    });
    return {
      destination,
      locationName: destination,
      days: getClimateFallbackDays(destination, startDate, endDate),
    };
  }

  let forecastByDate = new Map<string, DailyForecast>();
  let daytimeInfoByDate = new Map<string, DaytimeInfo>();
  const forecast = await fetchDailyForecast(place.lat, place.lon);
  if (forecast?.daily) {
    daytimeInfoByDate = buildDaytimeInfoMap(forecast.daily, forecast.hourly);
    forecastByDate = buildForecastMap(forecast.daily, daytimeInfoByDate);
  }

  // Derive the real forecast window from the dates Open-Meteo actually returned.
  // These are in the destination's LOCAL tz (timezone=auto), so we avoid the
  // off-by-one that server-local "today" would introduce when the server and
  // destination are in different timezones.
  const forecastDates = Array.from(forecastByDate.keys()).sort();
  const windowStart = forecastDates[0];
  const windowEnd = forecastDates[forecastDates.length - 1];

  const climateFallbackDates: string[] = [];
  const days = tripDates.map((date) => {
    const exact = forecastByDate.get(date);
    if (exact) {
      return { ...exact, date };
    }

    // Only interpolate within the covered window (rare gaps); outside it, use
    // seasonal climate averages rather than a misleading nearest-day copy.
    if (windowStart && windowEnd && date >= windowStart && date <= windowEnd) {
      const nearest = findNearestForecastDay(date, forecastByDate);
      if (nearest) {
        return nearest;
      }
    }

    climateFallbackDates.push(date);
    const [climateDay] = getClimateFallbackDays(destination, date, date);
    return climateDay;
  });

  const sampleDay = days.find((day) => day.source === "forecast");
  if (sampleDay) {
    const dailyIndex = forecast?.daily?.time?.indexOf(sampleDay.date) ?? -1;
    const dailyProbMax =
      dailyIndex >= 0
        ? forecast?.daily?.precipitation_probability_max?.[dailyIndex] ?? null
        : null;
    const dailyCode =
      dailyIndex >= 0
        ? forecast?.daily?.weathercode?.[dailyIndex] ??
          forecast?.daily?.weather_code?.[dailyIndex] ??
          null
        : null;
    const info = daytimeInfoByDate.get(sampleDay.date);
    logWeather("forecast sample day", {
      coords: { lat: place.lat, lon: place.lon },
      date: sampleDay.date,
      highTemp: sampleDay.highTemp,
      lowTemp: sampleDay.lowTemp,
      // Displayed rain % now prefers the daytime probability (see below).
      rainChancePercent: Math.round((sampleDay.rainChance ?? 0) * 100),
      dailyPrecipProbMax: dailyProbMax,
      daytimePrecipProb: info?.precipProb ?? null,
      dailyWeathercode: dailyCode,
      chosenWeathercode: info?.code ?? dailyCode,
      condition: sampleDay.condition,
      forecastWindow: { start: windowStart, end: windowEnd },
    });
  }

  if (climateFallbackDates.length > 0) {
    logWeather("days using climate fallback", climateFallbackDates);
  }

  return {
    destination,
    locationName: locationLabel(destination, place),
    days,
    lat: place.lat,
    lon: place.lon,
  };
}

/** Alias for {@link getWeatherForecast} — core trip weather fetcher. */
export const getTripWeather = getWeatherForecast;
