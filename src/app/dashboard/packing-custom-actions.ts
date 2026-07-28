"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  customItemToPackingItem,
  type PackingCustomItem,
  type PackingItem,
} from "@/lib/packing";
import {
  PACKING_CATEGORIES,
  type PackingCategory,
} from "@/lib/packing-items-database";

type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? object : { item: T }))
  | { ok: false; error: string };

const CATEGORY_SET = new Set<string>(PACKING_CATEGORIES);

function normalizeCategory(raw: string): PackingCategory | null {
  const trimmed = raw.trim();
  if (CATEGORY_SET.has(trimmed)) {
    return trimmed as PackingCategory;
  }
  return null;
}

function normalizeName(raw: string): string | null {
  const name = raw.trim();
  return name.length > 0 ? name : null;
}

async function requireTripOwner(tripId: string): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, user_id")
    .eq("id", tripId)
    .maybeSingle();

  if (tripError || !trip) {
    return { ok: false, error: "Trip not found." };
  }

  if (trip.user_id !== user.id) {
    return {
      ok: false,
      error: "Only the trip owner can update the packing list.",
    };
  }

  return { ok: true, userId: user.id };
}

function mapRow(row: Record<string, unknown>): PackingCustomItem {
  return {
    id: String(row.id),
    trip_id: String(row.trip_id),
    user_id: String(row.user_id),
    name: String(row.name),
    category: String(row.category),
    notes: typeof row.notes === "string" ? row.notes : "",
    packed: row.packed === true,
    created_at:
      typeof row.created_at === "string" ? row.created_at : undefined,
    updated_at:
      typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

/**
 * Creates a custom packing item for a trip. Owner-only.
 */
export async function createCustomPackingItem(params: {
  tripId: string;
  name: string;
  category: string;
  notes?: string;
}): Promise<ActionResult<PackingItem>> {
  const auth = await requireTripOwner(params.tripId);
  if (!auth.ok) return auth;

  const name = normalizeName(params.name);
  if (!name) {
    return { ok: false, error: "Item name is required." };
  }

  const category = normalizeCategory(params.category);
  if (!category) {
    return { ok: false, error: "Choose a valid category." };
  }

  const notes = (params.notes ?? "").trim();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("packing_custom_items")
    .insert({
      trip_id: params.tripId,
      user_id: auth.userId,
      name,
      category,
      notes,
      packed: false,
    })
    .select("id, trip_id, user_id, name, category, notes, packed, created_at, updated_at")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to add custom item." };
  }

  revalidatePath(`/dashboard/trips/${params.tripId}`);
  return { ok: true, item: customItemToPackingItem(mapRow(data)) };
}

/**
 * Updates name / category / notes on a custom packing item. Owner-only.
 */
export async function updateCustomPackingItem(params: {
  tripId: string;
  itemId: string;
  name: string;
  category: string;
  notes?: string;
}): Promise<ActionResult<PackingItem>> {
  const auth = await requireTripOwner(params.tripId);
  if (!auth.ok) return auth;

  const name = normalizeName(params.name);
  if (!name) {
    return { ok: false, error: "Item name is required." };
  }

  const category = normalizeCategory(params.category);
  if (!category) {
    return { ok: false, error: "Choose a valid category." };
  }

  const notes = (params.notes ?? "").trim();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("packing_custom_items")
    .update({
      name,
      category,
      notes,
      user_id: auth.userId,
    })
    .eq("id", params.itemId)
    .eq("trip_id", params.tripId)
    .select("id, trip_id, user_id, name, category, notes, packed, created_at, updated_at")
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data) {
    return { ok: false, error: "Custom packing item not found." };
  }

  revalidatePath(`/dashboard/trips/${params.tripId}`);
  return { ok: true, item: customItemToPackingItem(mapRow(data)) };
}

/**
 * Toggles packed on a custom packing item. Owner-only.
 */
export async function updateCustomPackingItemPacked(params: {
  tripId: string;
  itemId: string;
  packed: boolean;
}): Promise<ActionResult> {
  const auth = await requireTripOwner(params.tripId);
  if (!auth.ok) return auth;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("packing_custom_items")
    .update({ packed: params.packed })
    .eq("id", params.itemId)
    .eq("trip_id", params.tripId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data) {
    return { ok: false, error: "Custom packing item not found." };
  }

  revalidatePath(`/dashboard/trips/${params.tripId}`);
  return { ok: true };
}

/**
 * Deletes a custom packing item. Owner-only.
 */
export async function deleteCustomPackingItem(params: {
  tripId: string;
  itemId: string;
}): Promise<ActionResult> {
  const auth = await requireTripOwner(params.tripId);
  if (!auth.ok) return auth;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("packing_custom_items")
    .delete()
    .eq("id", params.itemId)
    .eq("trip_id", params.tripId)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data) {
    return { ok: false, error: "Custom packing item not found." };
  }

  revalidatePath(`/dashboard/trips/${params.tripId}`);
  return { ok: true };
}
