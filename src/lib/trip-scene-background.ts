/** Normalize DB / form trip_type values to a stable key. */
function normalizeTripTypeKey(type: string): string {
  const key = type.trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (key === "ski") return "skiing";
  if (key === "citybreak") return "city_break";

  return key;
}

function normalizeCondition(condition?: string | null): string {
  return (condition ?? "").trim().toLowerCase();
}

/**
 * Weather / trip-type → full-bleed scene image path under `/public/images`.
 *
 * Priority:
 * 1. Snow (incl. snow showers) → snow-bg.jpg
 * 2. Rain / drizzle / showers / thunderstorm → rainy-bg.jpg
 * 3. Clear / sunny + beach trip → beach-bg.jpg
 * 4. Default → pattern.png
 *
 * Business / city_break use CSS gradients on trip detail + cards
 * (see `resolveTripDetailPageBackground`); they are not image scenes.
 *
 * Snow is checked before the rain family so "Snow showers" maps to snow.
 */
export function getTripSceneBackground({
  tripType,
  condition,
}: {
  tripType: string;
  condition?: string | null;
}): string {
  const c = normalizeCondition(condition);
  const type = normalizeTripTypeKey(tripType);

  if (c.includes("snow")) {
    return "/images/snow-bg.jpg";
  }

  if (
    c.includes("rain") ||
    c.includes("drizzle") ||
    c.includes("shower") ||
    c.includes("thunder")
  ) {
    return "/images/rainy-bg.jpg";
  }

  const isClear = c.includes("clear") || c.includes("sunny");
  if (isClear && type === "beach") {
    return "/images/beach-bg.jpg";
  }

  return "/images/pattern.png";
}

export type TripGradientVariant = "soft" | "business" | "city_break";

export type TripDetailBackground =
  | { kind: "image"; src: string }
  | { kind: "gradient"; variant: TripGradientVariant };

function isRainCondition(condition: string): boolean {
  const c = normalizeCondition(condition);
  return (
    c.includes("rain") ||
    c.includes("drizzle") ||
    c.includes("shower") ||
    c.includes("thunder")
  );
}

function isSnowCondition(condition: string): boolean {
  return normalizeCondition(condition).includes("snow");
}

function isClearOrSunny(condition: string): boolean {
  const c = normalizeCondition(condition);
  return c.includes("clear") || c.includes("sunny");
}

function isUsableForecastCondition(condition: string): boolean {
  const c = normalizeCondition(condition);
  return c.length > 0 && c !== "unavailable" && c !== "unknown";
}

/** Stable key for crossfade / React deps. */
export function tripDetailBackgroundKey(bg: TripDetailBackground): string {
  return bg.kind === "gradient" ? `gradient:${bg.variant}` : bg.src;
}

/**
 * Trip detail page / cards: scan the full forecast (when available), else fall back to trip type.
 * Priority: rain → snow → clear/sunny + beach → business gradient → city_break gradient → soft gradient.
 */
export function resolveTripDetailPageBackground({
  tripType,
  conditions,
}: {
  tripType: string;
  conditions: string[];
}): TripDetailBackground {
  const type = normalizeTripTypeKey(tripType);
  const usable = conditions.filter(isUsableForecastCondition);

  if (usable.some(isRainCondition)) {
    return { kind: "image", src: "/images/rainy-bg.jpg" };
  }

  if (usable.some(isSnowCondition)) {
    return { kind: "image", src: "/images/snow-bg.jpg" };
  }

  if (type === "beach" && usable.some(isClearOrSunny)) {
    return { kind: "image", src: "/images/beach-bg.jpg" };
  }

  if (type === "business") {
    return { kind: "gradient", variant: "business" };
  }

  if (type === "city_break") {
    return { kind: "gradient", variant: "city_break" };
  }

  return { kind: "gradient", variant: "soft" };
}
