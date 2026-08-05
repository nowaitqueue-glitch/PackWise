import {
  Calendar,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  type LucideIcon,
  type LucideProps,
  Sun,
  Tornado,
  Wind,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CONDITION_ICONS: Record<string, LucideIcon> = {
  Clear: Sun,
  Sunny: Sun,
  "Partly Cloudy": Cloud,
  Overcast: Cloud,
  Clouds: Cloud,
  Rain: CloudRain,
  Drizzle: CloudRain,
  Showers: CloudRain,
  "Rain showers": CloudRain,
  Thunderstorm: CloudLightning,
  Snow: CloudSnow,
  "Snow showers": CloudSnow,
  Atmosphere: CloudFog,
  Mist: CloudFog,
  Fog: CloudFog,
  Haze: CloudFog,
  Smoke: CloudFog,
  Dust: CloudFog,
  Sand: CloudFog,
  Ash: CloudFog,
  Squall: Wind,
  Tornado: Tornado,
  Seasonal: Cloud,
  "Mild climate": Sun,
  unavailable: Calendar,
  unknown: Calendar,
};

/** Subtle looping motion per weather condition; unknown/unavailable stay still. */
const CONDITION_ANIMATION: Record<string, string> = {
  Clear: "motion-safe:animate-weather-bounce",
  Sunny: "motion-safe:animate-weather-bounce",
  "Partly Cloudy": "motion-safe:animate-weather-drift",
  Overcast: "motion-safe:animate-weather-drift",
  Clouds: "motion-safe:animate-weather-drift",
  Rain: "motion-safe:animate-weather-rain",
  Drizzle: "motion-safe:animate-weather-rain",
  Showers: "motion-safe:animate-weather-rain",
  "Rain showers": "motion-safe:animate-weather-rain",
  Thunderstorm: "motion-safe:animate-weather-rain",
  Snow: "motion-safe:animate-weather-fall",
  "Snow showers": "motion-safe:animate-weather-fall",
};

/** WMO weathercodes stored as decimal strings on DailyForecast.icon. */
function conditionFromWmoIconCode(iconCode: string): string | undefined {
  if (!/^\d{1,3}$/.test(iconCode)) return undefined;
  const code = Number(iconCode);
  if (code === 0 || code === 1) return "Clear";
  if (code === 2) return "Partly Cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return "Clouds";
}

/** True when `icon` is an emoji (Open-Meteo path) rather than a numeric code. */
function isEmojiIcon(iconCode: string): boolean {
  if (/^\d{1,3}[dn]?$/i.test(iconCode)) return false;
  return /[^\u0000-\u007F]/.test(iconCode);
}

type WeatherConditionIconProps = LucideProps & {
  condition: string;
  /** Emoji or WMO weathercode string. */
  iconCode?: string | null;
};

export function WeatherConditionIcon({
  condition,
  iconCode,
  className,
  ...props
}: WeatherConditionIconProps) {
  if (iconCode && isEmojiIcon(iconCode)) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center text-[1.75rem] leading-none",
          className
        )}
        aria-hidden
        role="img"
      >
        {iconCode}
      </span>
    );
  }

  const fromWmo = iconCode ? conditionFromWmoIconCode(iconCode) : undefined;
  const key = CONDITION_ICONS[condition]
    ? condition
    : fromWmo ?? condition;
  const Icon = CONDITION_ICONS[key] ?? Cloud;
  const motion = CONDITION_ANIMATION[key];
  const pulse =
    motion == null ? "motion-safe:animate-pulse-slow" : undefined;

  return (
    <Icon
      className={cn(
        // Default stroke color so Lucide icons stay visible when callers omit text-*.
        "text-foreground dark:text-slate-100",
        motion,
        pulse,
        className
      )}
      aria-hidden
      {...props}
    />
  );
}
