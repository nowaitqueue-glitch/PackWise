import type { PackingItem } from "@/lib/packing";

export const GUEST_TRIP_KEY = "guest_trip";
export const GUEST_PACKED_ITEMS_KEY = "guest_packed_items";
export const GUEST_PACKING_ITEMS_KEY = "guest_packing_items";
/** Guest-only custom packing items (transferred to packing_custom_items on claim). */
export const GUEST_CUSTOM_ITEMS_KEY = "guest_custom_items";
export const GUEST_CHECKOFF_COUNT_KEY = "guest_checkoff_count";
export const GUEST_CTA_DISMISSED_KEY = "guest_cta_dismissed";
export const GUEST_LOCKED_DISMISSED_KEY = "guest_locked_dismissed";
/** sessionStorage snapshot used during claim so a rebuild failure can restore. */
export const CLAIM_PACKING_SNAPSHOT_KEY = "packwise-claim-packing-snapshot";

/** Legacy key from the earlier `/guest` flow — migrated on read. */
const LEGACY_GUEST_STORAGE_KEY = "packwise-guest-trip";

export type GuestTrip = {
  destination: string;
  startDate: string;
  endDate: string;
  tripType: string;
  travelers: number;
};

/** Packed state keyed by packing item name (stable across regenerations). */
export type GuestPackedItems = Record<string, boolean>;

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isGuestTrip(value: unknown): value is GuestTrip {
  if (!value || typeof value !== "object") return false;
  const trip = value as Record<string, unknown>;
  return (
    typeof trip.destination === "string" &&
    trip.destination.trim().length > 0 &&
    typeof trip.startDate === "string" &&
    typeof trip.endDate === "string" &&
    typeof trip.tripType === "string" &&
    typeof trip.travelers === "number" &&
    Number.isFinite(trip.travelers) &&
    trip.travelers >= 1
  );
}

function migrateLegacyGuestTrip(): GuestTrip | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(LEGACY_GUEST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      trip?: {
        destination?: string;
        start_date?: string;
        end_date?: string;
        trip_type?: string;
        travelers?: number;
      };
      packingItems?: PackingItem[];
    };
    const legacy = parsed?.trip;
    if (
      !legacy?.destination ||
      !legacy.start_date ||
      !legacy.end_date ||
      !legacy.trip_type ||
      !legacy.travelers
    ) {
      return null;
    }

    const trip: GuestTrip = {
      destination: legacy.destination,
      startDate: legacy.start_date,
      endDate: legacy.end_date,
      tripType: legacy.trip_type,
      travelers: legacy.travelers,
    };
    writeGuestTrip(trip);

    if (Array.isArray(parsed.packingItems)) {
      const packed: GuestPackedItems = {};
      for (const item of parsed.packingItems) {
        if (item?.name) packed[item.name] = Boolean(item.packed);
      }
      writeGuestPackedItems(packed);
    }

    localStorage.removeItem(LEGACY_GUEST_STORAGE_KEY);
    return trip;
  } catch {
    return null;
  }
}

export function readGuestTrip(): GuestTrip | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(GUEST_TRIP_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (isGuestTrip(parsed)) return parsed;
    }
    return migrateLegacyGuestTrip();
  } catch {
    return migrateLegacyGuestTrip();
  }
}

export function writeGuestTrip(trip: GuestTrip): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(GUEST_TRIP_KEY, JSON.stringify(trip));
  } catch {
    // Quota / private mode — ignore; guest demo stays in-memory for the page.
  }
}

export function clearGuestTrip(): void {
  if (!canUseStorage()) return;
  try {
    localStorage.removeItem(GUEST_TRIP_KEY);
    localStorage.removeItem(GUEST_PACKED_ITEMS_KEY);
    localStorage.removeItem(GUEST_PACKING_ITEMS_KEY);
    localStorage.removeItem(GUEST_CUSTOM_ITEMS_KEY);
    localStorage.removeItem(GUEST_CHECKOFF_COUNT_KEY);
    localStorage.removeItem(LEGACY_GUEST_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
  try {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(CLAIM_PACKING_SNAPSHOT_KEY);
    }
  } catch {
    // Ignore storage failures.
  }
}

function isPackingItemArray(value: unknown): value is PackingItem[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) =>
      item &&
      typeof item === "object" &&
      typeof (item as PackingItem).name === "string" &&
      (item as PackingItem).name.trim().length > 0 &&
      typeof (item as PackingItem).category === "string"
  );
}

export function readGuestPackingItems(): PackingItem[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(GUEST_PACKING_ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return isPackingItemArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeGuestPackingItems(items: PackingItem[]): void {
  if (!canUseStorage()) return;
  try {
    if (items.length === 0) {
      localStorage.removeItem(GUEST_PACKING_ITEMS_KEY);
      return;
    }
    localStorage.setItem(GUEST_PACKING_ITEMS_KEY, JSON.stringify(items));
  } catch {
    // Quota / private mode — ignore.
  }
}

function normalizeGuestCustomItems(items: PackingItem[]): PackingItem[] {
  return items
    .filter(
      (item) =>
        item &&
        typeof item.name === "string" &&
        item.name.trim().length > 0 &&
        typeof item.category === "string"
    )
    .map((item) => ({
      id:
        typeof item.id === "string" && item.id.trim()
          ? item.id.trim()
          : crypto.randomUUID(),
      name: item.name.trim(),
      category: item.category.trim() || "Other",
      notes: typeof item.notes === "string" ? item.notes : "",
      packed: item.packed === true,
      isCustom: true as const,
    }));
}

export function readGuestCustomItems(): PackingItem[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(GUEST_CUSTOM_ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return normalizeGuestCustomItems(parsed as PackingItem[]);
  } catch {
    return [];
  }
}

export function writeGuestCustomItems(items: PackingItem[]): void {
  if (!canUseStorage()) return;
  try {
    const normalized = normalizeGuestCustomItems(items);
    if (normalized.length === 0) {
      localStorage.removeItem(GUEST_CUSTOM_ITEMS_KEY);
      return;
    }
    localStorage.setItem(GUEST_CUSTOM_ITEMS_KEY, JSON.stringify(normalized));
  } catch {
    // Quota / private mode — ignore.
  }
}

/** Snapshot packing into sessionStorage before claim rebuild (safe restore). */
export function snapshotClaimPackingItems(items: PackingItem[]): void {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return;
  }
  try {
    if (items.length === 0) {
      sessionStorage.removeItem(CLAIM_PACKING_SNAPSHOT_KEY);
      return;
    }
    sessionStorage.setItem(CLAIM_PACKING_SNAPSHOT_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage failures.
  }
}

export function readClaimPackingSnapshot(): PackingItem[] {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return [];
  }
  try {
    const raw = sessionStorage.getItem(CLAIM_PACKING_SNAPSHOT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return isPackingItemArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearClaimPackingSnapshot(): void {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") {
    return;
  }
  try {
    sessionStorage.removeItem(CLAIM_PACKING_SNAPSHOT_KEY);
  } catch {
    // Ignore storage failures.
  }
}

/** Restore snapshot into local guest packing storage after a failed claim rebuild. */
export function restoreClaimPackingSnapshot(): PackingItem[] {
  const items = readClaimPackingSnapshot();
  if (items.length > 0) {
    writeGuestPackingItems(items);
    const packed: GuestPackedItems = {};
    for (const item of items) {
      packed[item.name] = item.packed === true;
    }
    writeGuestPackedItems(packed);
    syncGuestCheckoffCount(items);
  }
  return items;
}

export function hasGuestTrip(): boolean {
  return readGuestTrip() != null;
}

export function readGuestPackedItems(): GuestPackedItems {
  if (!canUseStorage()) return {};
  try {
    const raw = localStorage.getItem(GUEST_PACKED_ITEMS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: GuestPackedItems = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "boolean") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function writeGuestPackedItems(packed: GuestPackedItems): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(GUEST_PACKED_ITEMS_KEY, JSON.stringify(packed));
  } catch {
    // Quota / private mode — ignore.
  }
}

export function setGuestItemPacked(itemName: string, packed: boolean): void {
  const name = itemName.trim();
  if (!name) return;
  const current = readGuestPackedItems();
  writeGuestPackedItems({ ...current, [name]: packed });
}

export function readGuestCheckoffCount(): number {
  if (!canUseStorage()) return 0;
  try {
    const raw = localStorage.getItem(GUEST_CHECKOFF_COUNT_KEY);
    if (raw == null) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function writeGuestCheckoffCount(count: number): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(
      GUEST_CHECKOFF_COUNT_KEY,
      String(Math.max(0, Math.floor(count)))
    );
  } catch {
    // Quota / private mode — ignore.
  }
}

/** Recompute `guest_checkoff_count` from the current packing list packed flags. */
export function syncGuestCheckoffCount(items: PackingItem[]): number {
  const count = items.reduce((n, item) => n + (item.packed ? 1 : 0), 0);
  writeGuestCheckoffCount(count);
  return count;
}

export function applyPackedState(items: PackingItem[]): PackingItem[] {
  const packed = readGuestPackedItems();
  return items.map((item) => ({
    ...item,
    packed: packed[item.name] === true,
  }));
}

export function isGuestCtaDismissed(): boolean {
  if (!canUseStorage()) return false;
  try {
    return localStorage.getItem(GUEST_CTA_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissGuestCta(): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(GUEST_CTA_DISMISSED_KEY, "1");
  } catch {
    // Ignore storage failures.
  }
}

export function isGuestLockedDismissed(): boolean {
  if (!canUseStorage()) return false;
  try {
    return localStorage.getItem(GUEST_LOCKED_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissGuestLocked(): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(GUEST_LOCKED_DISMISSED_KEY, "1");
  } catch {
    // Ignore storage failures.
  }
}

/** Tokyo city-break sample: 7 inclusive days starting today. */
export function createSampleGuestTrip(): GuestTrip {
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return {
    destination: "Tokyo, JP",
    startDate: toISODate(start),
    endDate: toISODate(end),
    tripType: "city break",
    travelers: 1,
  };
}
