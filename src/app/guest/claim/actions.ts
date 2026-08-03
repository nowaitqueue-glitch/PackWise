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
  packingSource?: "template" | "ai";
};

export type ClaimGuestTripResult =
  | { ok: true; tripId: string }
  | { ok: false; error: string };

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

  const items = normalizePackingItemsForStorage(input.packingItems ?? []);
  const { error: packingError } = await supabase.from("packing_lists").upsert(
    {
      trip_id: trip.id,
      items: toPackingListPayload(items, input.packingSource ?? "template"),
    },
    { onConflict: "trip_id" }
  );

  if (packingError) {
    return {
      ok: false,
      error: packingError.message ?? "Trip saved but packing list failed.",
    };
  }

  return { ok: true, tripId: trip.id };
}

/** Server redirect helper after a successful claim (optional). */
export async function redirectToClaimedTrip(tripId: string) {
  redirect(`/dashboard/trips/${tripId}?created=1`);
}
