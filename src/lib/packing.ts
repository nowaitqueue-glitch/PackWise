export type PackingItem = {
  /** Stable id when present; legacy rows may omit until next persist. */
  id?: string;
  name: string;
  category: string;
  notes: string;
  packed: boolean;
  /** Optional affiliate / shopping link for the item. */
  affiliateLink?: string;
  /** True when sourced from packing_custom_items (not packing_lists JSON). */
  isCustom?: boolean;
};

/** Row from public.packing_custom_items. */
export type PackingCustomItem = {
  id: string;
  trip_id: string;
  user_id: string;
  name: string;
  category: string;
  notes: string;
  packed: boolean;
  created_at?: string;
  updated_at?: string;
};

/** Map a custom DB row into a display PackingItem. */
export function customItemToPackingItem(
  item: Pick<PackingCustomItem, "id" | "name" | "category" | "notes" | "packed">
): PackingItem {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    notes: item.notes ?? "",
    packed: item.packed === true,
    isCustom: true,
  };
}

export class PackingError extends Error {
  constructor(
    message: string,
    public readonly code: "MISSING_API_KEY" | "GENERATION_FAILED" | "PARSE_FAILED"
  ) {
    super(message);
    this.name = "PackingError";
  }
}

export type PackingListSource = "template" | "ai";

export type PackingList = {
  id: string;
  trip_id: string;
  items: PackingItem[];
  /** How the list was generated; optional for legacy rows. */
  source?: PackingListSource;
  created_at?: string;
  updated_at?: string;
};

/** Payload stored in packing_lists.items JSONB (array or wrapped object). */
export type PackingListPayload = {
  items: PackingItem[];
  source?: PackingListSource;
};

export type TripPackingInput = {
  destination: string;
  startDate: string;
  endDate: string;
  tripType: string;
  travelers: number;
};

function newPackingItemId(): string {
  return crypto.randomUUID();
}

export function isPackingItem(value: unknown): value is {
  id?: unknown;
  name: string;
  category: string;
  notes: string;
  packed?: unknown;
} {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.name === "string" &&
    typeof item.category === "string" &&
    typeof item.notes === "string"
  );
}

function coercePackingJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Reads optional generation source from packing_lists.items JSONB.
 * Supports legacy plain arrays (no source) and `{ items, source }` payloads.
 */
export function parsePackingListSource(
  value: unknown
): PackingListSource | undefined {
  const raw = coercePackingJson(value);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const source = (raw as Record<string, unknown>).source;
  if (source === "template" || source === "ai") return source;
  return undefined;
}

/**
 * Normalize raw JSONB items. Missing `packed` → false.
 * Does not invent ids on read (legacy items match by index until next write).
 * Accepts a plain array or `{ items: [...] }` (optional `source` ignored here).
 */
export function parsePackingItems(value: unknown): PackingItem[] {
  let raw: unknown = coercePackingJson(value);

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.items)) {
      raw = obj.items;
    }
  }

  if (!Array.isArray(raw)) return [];

  return raw.filter(isPackingItem).map((item) => {
    const id =
      typeof item.id === "string" && item.id.trim()
        ? item.id.trim()
        : undefined;
    const rawAffiliateLink = (item as { affiliateLink?: unknown }).affiliateLink;
    const affiliateLink =
      typeof rawAffiliateLink === "string" && rawAffiliateLink.trim()
        ? rawAffiliateLink.trim()
        : undefined;

    return {
      ...(id ? { id } : {}),
      name: item.name.trim(),
      category: item.category.trim() || "Other",
      notes: item.notes.trim(),
      packed: item.packed === true,
      ...(affiliateLink ? { affiliateLink } : {}),
    };
  });
}

/** Build JSONB value that preserves source without a DB migration. */
export function toPackingListPayload(
  items: PackingItem[],
  source?: PackingListSource
): PackingListPayload {
  return source ? { items, source } : { items };
}

/** Ensure every item has a stable id and explicit packed flag before persisting. */
export function normalizePackingItemsForStorage(
  items: Array<{
    id?: string;
    name: string;
    category: string;
    notes?: string;
    packed?: boolean;
    affiliateLink?: string;
  }>
): PackingItem[] {
  return items.map((item) => {
    const affiliateLink = item.affiliateLink?.trim();
    return {
      id: item.id?.trim() || newPackingItemId(),
      name: item.name.trim(),
      category: item.category.trim() || "Other",
      notes: item.notes?.trim() ?? "",
      packed: item.packed === true,
      ...(affiliateLink ? { affiliateLink } : {}),
    };
  });
}

export function groupPackingItemsByCategory(
  items: PackingItem[]
): Array<{ category: string; items: PackingItem[] }> {
  const order: string[] = [];
  const groups = new Map<string, PackingItem[]>();

  for (const item of items) {
    const category = item.category || "Other";
    if (!groups.has(category)) {
      order.push(category);
      groups.set(category, []);
    }
    groups.get(category)!.push(item);
  }

  return order.map((category) => ({
    category,
    items: groups.get(category)!,
  }));
}

export function packingProgress(items: PackingItem[]): {
  packed: number;
  total: number;
  percent: number;
} {
  const total = items.length;
  const packed = items.filter((item) => item.packed).length;
  const percent = total === 0 ? 0 : Math.round((packed / total) * 100);
  return { packed, total, percent };
}
