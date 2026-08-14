"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  normalizePackingItemsForStorage,
  toPackingListPayload,
  type PackingItem,
} from "@/lib/packing";
import { isTripType } from "@/lib/trips";

export type ClaimGuestTripInput = {
  trip: {
    destination: string;
    start_date: string;
    end_date: string;
    trip_type: string;
    travelers: number;
  };
  packingItems: PackingItem[];
  /** Guest custom items → packing_custom_items on claim. */
  customItems?: PackingItem[];
  packingSource?: "template" | "ai";
  /**
   * Client-generated fingerprint (localStorage). Same key on retry returns the
   * existing trip instead of inserting a duplicate.
   */
  claimId?: string;
};

export type ClaimGuestTripResult =
  | { ok: true; tripId: string; warning?: string }
  | { ok: false; error: string };

const CLAIM_KEY_MAX = 128;

function normalizeClaimKey(raw: string | undefined): string | null {
  const key = raw?.trim();
  if (!key || key.length > CLAIM_KEY_MAX) return null;
  return key;
}

/**
 * Best-effort claim: no multi-statement Postgres transaction from the JS client.
 * Idempotency via guest_claims ledger; packing failure leaves guest storage intact
 * on the client (do not clear until ok). Custom-item failure returns success + warning.
 */
export async function claimGuestTrip(
  input: ClaimGuestTripInput
): Promise<ClaimGuestTripResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in to save your trip." };
  }

  const destination = input.trip.destination?.trim();
  const startDate = input.trip.start_date?.trim();
  const endDate = input.trip.end_date?.trim();
  const tripType = input.trip.trip_type?.trim();
  const travelers = Number(input.trip.travelers);
  const claimKey = normalizeClaimKey(input.claimId);

  if (!destination) {
    return { ok: false, error: "Guest trip is missing a destination." };
  }
  if (!startDate || !endDate) {
    return { ok: false, error: "Guest trip is missing dates." };
  }
  if (endDate < startDate) {
    return { ok: false, error: "Guest trip has invalid dates." };
  }
  if (!isTripType(tripType)) {
    return { ok: false, error: "Guest trip has an invalid trip type." };
  }
  if (!Number.isFinite(travelers) || travelers < 1) {
    return { ok: false, error: "Guest trip has an invalid traveler count." };
  }

  const generatedInput = (input.packingItems ?? []).filter(
    (item) => !item.isCustom
  );
  const customInput = [
    ...(input.customItems ?? []),
    ...(input.packingItems ?? []).filter((item) => item.isCustom),
  ];

  const items = normalizePackingItemsForStorage(generatedInput);
  const customItems = normalizePackingItemsForStorage(customInput).map(
    (item) => ({
      ...item,
      isCustom: true as const,
    })
  );

  if (items.length === 0 && customItems.length === 0) {
    return {
      ok: false,
      error:
        "Your packing list wasn't ready yet. Keep your guest trip and try saving again in a moment.",
    };
  }

  // Idempotent: prior successful (or partial) claim for this fingerprint.
  if (claimKey) {
    const { data: existingClaim } = await supabase
      .from("guest_claims")
      .select("trip_id")
      .eq("user_id", user.id)
      .eq("claim_key", claimKey)
      .maybeSingle();

    if (existingClaim?.trip_id) {
      const tripId = String(existingClaim.trip_id);
      return finishClaimTransfer({
        supabase,
        userId: user.id,
        tripId,
        items,
        customItems,
        packingSource: input.packingSource ?? "template",
        skipCustomIfPresent: true,
      });
    }
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .insert({
      user_id: user.id,
      destination,
      start_date: startDate,
      end_date: endDate,
      trip_type: tripType,
      travelers,
    })
    .select("id")
    .single();

  if (tripError || !trip) {
    return {
      ok: false,
      error: tripError?.message ?? "Could not save guest trip.",
    };
  }

  if (claimKey) {
    const { error: claimInsertError } = await supabase
      .from("guest_claims")
      .insert({
        user_id: user.id,
        claim_key: claimKey,
        trip_id: trip.id,
      });

    if (claimInsertError) {
      // Race: another request won the unique (user_id, claim_key) slot.
      const { data: raced } = await supabase
        .from("guest_claims")
        .select("trip_id")
        .eq("user_id", user.id)
        .eq("claim_key", claimKey)
        .maybeSingle();

      if (raced?.trip_id) {
        // Best-effort cleanup of the duplicate trip we just inserted.
        await supabase.from("trips").delete().eq("id", trip.id).eq("user_id", user.id);
        return finishClaimTransfer({
          supabase,
          userId: user.id,
          tripId: String(raced.trip_id),
          items,
          customItems,
          packingSource: input.packingSource ?? "template",
          skipCustomIfPresent: true,
        });
      }
      // Ledger table may be missing in older envs — continue without idempotency.
    }
  }

  return finishClaimTransfer({
    supabase,
    userId: user.id,
    tripId: trip.id,
    items,
    customItems,
    packingSource: input.packingSource ?? "template",
    skipCustomIfPresent: false,
  });
}

type FinishParams = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  tripId: string;
  items: PackingItem[];
  customItems: PackingItem[];
  packingSource: "template" | "ai";
  /** On idempotent retry, avoid duplicating custom rows if any already exist. */
  skipCustomIfPresent: boolean;
};

async function finishClaimTransfer(
  params: FinishParams
): Promise<ClaimGuestTripResult> {
  const {
    supabase,
    userId,
    tripId,
    items,
    customItems,
    packingSource,
    skipCustomIfPresent,
  } = params;

  if (items.length > 0) {
    const { error: packingError } = await supabase.from("packing_lists").upsert(
      {
        trip_id: tripId,
        items: toPackingListPayload(items, packingSource),
      },
      { onConflict: "trip_id" }
    );

    if (packingError) {
      // Do not treat as success — client must keep guest storage for retry.
      return {
        ok: false,
        error:
          packingError.message ??
          "Trip saved but packing list failed. Your guest list is still here — try again.",
      };
    }
  }

  if (customItems.length > 0) {
    if (skipCustomIfPresent) {
      const { count } = await supabase
        .from("packing_custom_items")
        .select("id", { count: "exact", head: true })
        .eq("trip_id", tripId);

      if ((count ?? 0) > 0) {
        return { ok: true, tripId };
      }
    }

    const { error: customError } = await supabase
      .from("packing_custom_items")
      .insert(
        customItems.map((item) => ({
          trip_id: tripId,
          user_id: userId,
          name: item.name,
          category: item.category,
          notes: item.notes,
          packed: item.packed === true,
        }))
      );

    if (customError) {
      // Partial success: trip + packing transferred; custom items can be re-added.
      return {
        ok: true,
        tripId,
        warning:
          "Your trip was saved, but some custom packing items could not be transferred. You can add them again from the trip page.",
      };
    }
  }

  return { ok: true, tripId };
}

/** Server redirect helper after a successful claim (optional). */
export async function redirectToClaimedTrip(tripId: string) {
  redirect(`/dashboard/trips/${tripId}?created=1`);
}
