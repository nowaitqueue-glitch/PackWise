/**
 * Tag-based packing list query engine.
 *
 * Builds a needs profile from trip type + weather, filters
 * {@link PACKING_ITEMS}, applies quantity rules (trip days × travelers), and
 * returns items shaped for existing packing storage / checkbox UI.
 */

import {
  PACKING_CATEGORY_ORDER,
  PACKING_ITEMS,
  type PackingCategory,
  type PackingDatabaseItem,
  type QuantityMode,
  type QuantityRule,
} from "./packing-items-database";

export type PackingSearchProfile = {
  tripType: string;
  avgTemp: number;
  hasRain: boolean;
  hasSnow: boolean;
  isHumid: boolean;
  tripDays: number;
  /** Party size; clothing / consumables / per-person docs scale by this (min 1). */
  travelers: number;
  isFlightLong: boolean;
  /** Clear skies + warmth (or very hot) → UV needs. */
  hasClearHot?: boolean;
};

/** Minimal weather day shape used when building a profile. */
export type PackingWeatherDay = {
  highTemp: number | null;
  lowTemp: number | null;
  /** 0–1 precipitation probability. */
  rainChance: number | null;
  condition: string;
};

export type PackingSearchResultItem = {
  name: string;
  category: string;
  notes?: string;
  affiliateLink?: string;
};

const DAY_MS = 86_400_000;

const CATEGORY_RANK = new Map<string, number>(
  PACKING_CATEGORY_ORDER.map((category, index) => [category, index])
);

const ONE_PER_TRAVELER_NOTE = "One per traveler";

/** Inclusive calendar days between YYYY-MM-DD dates (end − start + 1), min 1. */
export function inclusiveTripDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = new Date(`${endDate}T00:00:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 1;
  return Math.max(1, Math.round((end - start) / DAY_MS) + 1);
}

function normalizeTripTypeKey(tripType: string): string {
  return tripType.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * Maps trip type → need tags.
 * skiing/ski → ski + snow; beach → beach + swim; city break → city; etc.
 */
export function tripTypeNeedTags(tripType: string): string[] {
  const key = normalizeTripTypeKey(tripType);

  switch (key) {
    case "beach":
      return ["beach", "swim"];
    case "business":
      return ["business"];
    case "hiking":
      return ["hiking"];
    case "ski":
    case "skiing":
      return ["ski", "snow"];
    case "city":
    case "city_break":
    case "citybreak":
      return ["city"];
    case "leisure":
      return ["leisure", "city"];
    case "other":
    default:
      return ["leisure"];
  }
}

/**
 * Derives need tags from a packing profile.
 *
 * Temperature: &lt; -5 → veryCold+cold; &lt; 5 → cold; &gt; 25 → hot.
 * UV when hasClearHot (or avgTemp &gt; 28).
 * Rain / snow / humid from booleans.
 * longTrip when tripDays ≥ 7.
 * flight always when isFlightLong; longFlight when isFlightLong.
 */
export function computeNeeds(profile: PackingSearchProfile): string[] {
  const needs = new Set<string>();

  for (const tag of tripTypeNeedTags(profile.tripType)) {
    needs.add(tag);
  }

  if (profile.avgTemp < -5) {
    needs.add("veryCold");
    needs.add("cold");
  } else if (profile.avgTemp < 5) {
    needs.add("cold");
  } else if (profile.avgTemp > 25) {
    needs.add("hot");
  }

  if (profile.hasClearHot || profile.avgTemp > 28) {
    needs.add("UV");
  }

  if (profile.hasRain) needs.add("rain");
  if (profile.hasSnow) needs.add("snow");
  if (profile.isHumid) needs.add("humid");

  if (profile.tripDays >= 7) needs.add("longTrip");

  if (profile.isFlightLong) {
    needs.add("flight");
    needs.add("longFlight");
  }

  return Array.from(needs);
}

function itemMatchesNeeds(
  item: PackingDatabaseItem,
  needs: ReadonlySet<string>
): boolean {
  return item.tags.some(
    (tag) => tag === "mandatory" || tag === "all" || needs.has(tag)
  );
}

function relevanceScore(
  item: PackingDatabaseItem,
  needs: ReadonlySet<string>
): number {
  return item.tags.filter((tag) => needs.has(tag)).length;
}

/**
 * Quantity rules:
 * - perDay: ceil(tripDays * value) — e.g. value 1 → one per day
 * - perDays: ceil(tripDays / value) — e.g. value 2 → one every 2 days
 * - fixed: value
 */
export function resolveQuantity(
  rule: QuantityRule | undefined,
  tripDays: number
): number | undefined {
  if (!rule) return undefined;
  const days = Math.max(1, tripDays);

  switch (rule.type) {
    case "perDay":
      return Math.max(1, Math.ceil(days * rule.value));
    case "perDays":
      return Math.max(1, Math.ceil(days / rule.value));
    case "fixed":
      return Math.max(1, Math.ceil(rule.value));
    default:
      return undefined;
  }
}

/**
 * Infer traveler scaling when catalog omits quantityMode.
 * Clothing / toiletries scale per person; other categories stay shared.
 */
export function resolveQuantityMode(item: PackingDatabaseItem): QuantityMode {
  if (item.quantityMode) return item.quantityMode;

  if (item.category === "Clothing") {
    return item.quantityRule ? "per_person_consumable" : "per_person";
  }
  if (item.category === "Toiletries") {
    return "per_person_consumable";
  }
  return "shared";
}

/**
 * Apply traveler count on top of a day/fixed base quantity.
 * Shared items keep the base; per-person modes multiply (travelers min 1).
 * When a per-person item has no rule, base defaults to 1.
 */
export function applyTravelerQuantity(
  baseQuantity: number | undefined,
  mode: QuantityMode,
  travelers: number
): number | undefined {
  const party = Math.max(1, Math.floor(travelers) || 1);

  if (mode === "shared") {
    return baseQuantity;
  }

  const base = baseQuantity ?? 1;
  return Math.max(1, base * party);
}

function withQuantityName(name: string, quantity: number | undefined): string {
  if (quantity === undefined || quantity <= 1) return name;
  return `${name} (x${quantity})`;
}

function withTravelerNote(
  notes: string | undefined,
  mode: QuantityMode,
  travelers: number
): string | undefined {
  if (mode !== "per_person" || travelers <= 1) {
    return notes;
  }
  if (!notes) return ONE_PER_TRAVELER_NOTE;
  if (notes.toLowerCase().includes("one per traveler")) return notes;
  return `${ONE_PER_TRAVELER_NOTE}. ${notes}`;
}

function dedupeByName(
  items: PackingSearchResultItem[]
): PackingSearchResultItem[] {
  const seen = new Set<string>();
  const result: PackingSearchResultItem[] = [];

  for (const item of items) {
    const key = item.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function sortByCategoryThenRelevance(
  entries: Array<{ item: PackingSearchResultItem; relevance: number; index: number }>
): PackingSearchResultItem[] {
  return entries
    .sort((a, b) => {
      const rankA =
        CATEGORY_RANK.get(a.item.category) ?? PACKING_CATEGORY_ORDER.length;
      const rankB =
        CATEGORY_RANK.get(b.item.category) ?? PACKING_CATEGORY_ORDER.length;
      if (rankA !== rankB) return rankA - rankB;
      if (b.relevance !== a.relevance) return b.relevance - a.relevance;
      return a.index - b.index;
    })
    .map((entry) => entry.item);
}

/**
 * Filter / sort / quantity-scale packing items for a trip profile.
 * Returns `{ name, category, notes?, affiliateLink? }` compatible with
 * {@link normalizePackingItemsForStorage}.
 */
export function searchPackingItems(
  profile: PackingSearchProfile
): PackingSearchResultItem[] {
  const tripDays = Math.max(1, profile.tripDays);
  const travelers = Math.max(1, Math.floor(profile.travelers) || 1);
  const needsList = computeNeeds({ ...profile, tripDays, travelers });
  const needs = new Set(needsList);

  const matched = PACKING_ITEMS.filter((item) => itemMatchesNeeds(item, needs));

  const entries = matched.map((item, index) => {
    const mode = resolveQuantityMode(item);
    const baseQuantity = resolveQuantity(item.quantityRule, tripDays);
    const quantity = applyTravelerQuantity(baseQuantity, mode, travelers);
    const notes = withTravelerNote(item.notes, mode, travelers);
    const result: PackingSearchResultItem = {
      name: withQuantityName(item.name, quantity),
      category: item.category as PackingCategory,
      ...(notes ? { notes } : {}),
      ...(item.affiliateLink ? { affiliateLink: item.affiliateLink } : {}),
    };
    return {
      item: result,
      relevance: relevanceScore(item, needs),
      index,
    };
  });

  return dedupeByName(sortByCategoryThenRelevance(entries));
}

function isSnowCondition(condition: string): boolean {
  return /snow/i.test(condition);
}

function isRainyCondition(condition: string): boolean {
  return /rain|drizzle|shower|thunder/i.test(condition);
}

function isClearOrSunny(condition: string): boolean {
  return /clear|sun/i.test(condition);
}

/**
 * Build a {@link PackingSearchProfile} from trip metadata and forecast days.
 *
 * - tripDays from inclusive start/end dates
 * - travelers from trip (min 1)
 * - avgTemp from mean of daily midpoints (fallback 18°C)
 * - hasRain if any day rainChance &gt; 0.5 or rainy condition
 * - hasSnow from snow conditions (or ski trips leave snow to trip-type tags)
 * - isHumid from heavy rain (rainChance &gt; 0.7) as humidity proxy
 * - isFlightLong when tripDays ≥ 3
 * - hasClearHot when clear/sunny and avgTemp &gt; 22, or avgTemp &gt; 28
 */
export function buildPackingProfile(input: {
  tripType: string;
  startDate: string;
  endDate: string;
  travelers?: number;
  weatherDays?: PackingWeatherDay[];
}): PackingSearchProfile {
  const tripDays = inclusiveTripDays(input.startDate, input.endDate);
  const travelers = Math.max(1, Math.floor(input.travelers ?? 1) || 1);
  const days = input.weatherDays ?? [];

  let avgTemp = 18;
  let hasRain = false;
  let hasSnow = false;
  let isHumid = false;
  let anyClear = false;

  if (days.length > 0) {
    const midpoints: number[] = [];

    for (const day of days) {
      const high = day.highTemp;
      const low = day.lowTemp;
      if (typeof high === "number" && typeof low === "number") {
        midpoints.push((high + low) / 2);
      } else if (typeof high === "number") {
        midpoints.push(high);
      } else if (typeof low === "number") {
        midpoints.push(low);
      }

      const rainChance = day.rainChance ?? 0;
      if (rainChance > 0.5 || isRainyCondition(day.condition)) {
        hasRain = true;
      }
      if (rainChance > 0.7) {
        isHumid = true;
      }
      if (isSnowCondition(day.condition)) {
        hasSnow = true;
      }
      if (isClearOrSunny(day.condition)) {
        anyClear = true;
      }
    }

    if (midpoints.length > 0) {
      avgTemp =
        Math.round(
          (midpoints.reduce((sum, t) => sum + t, 0) / midpoints.length) * 10
        ) / 10;
    }
  }

  const hasClearHot =
    (anyClear && avgTemp > 22) || avgTemp > 28;

  return {
    tripType: input.tripType,
    avgTemp,
    hasRain,
    hasSnow,
    isHumid,
    tripDays,
    travelers,
    isFlightLong: tripDays >= 3,
    hasClearHot,
  };
}
