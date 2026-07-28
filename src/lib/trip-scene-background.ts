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
 * 4. Business trip → city-bg.jpg
 * 5. Default → pattern.png
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

  if (type === "business") {
    return "/images/city-bg.jpg";
  }

  return "/images/pattern.png";
}
