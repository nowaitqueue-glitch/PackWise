"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isTripType } from "@/lib/trips";
import { generateAndStorePackingList } from "@/app/dashboard/packing-actions";
import { isValidCountryCode } from "@/lib/countries";
import {
  composeDestination,
  validateCity,
} from "@/lib/trip-destination";
import { invalidateTripWeatherCache } from "@/lib/trip-weather-cache";

export type CreateTripState = {
  error: string | null;
};

type ParsedTripFields =
  | {
      ok: true;
      destination: string;
      startDate: string;
      endDate: string;
      tripType: string;
      travelers: number;
    }
  | { ok: false; error: string };

function parseTripFormData(formData: FormData): ParsedTripFields {
  const city = String(formData.get("city") ?? "").trim();
  const countryCode = String(
    formData.get("countryCode") ?? formData.get("country") ?? ""
  )
    .trim()
    .toUpperCase();
  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDate = String(formData.get("end_date") ?? "").trim();
  const tripType = String(formData.get("trip_type") ?? "").trim();
  const travelersRaw = String(formData.get("travelers") ?? "").trim();
  const travelers = Number.parseInt(travelersRaw, 10);

  const cityError = validateCity(city);
  if (cityError) {
    return { ok: false, error: cityError };
  }

  if (countryCode && !isValidCountryCode(countryCode)) {
    return { ok: false, error: "Please select a valid country." };
  }

  const destination = composeDestination(city, countryCode);

  if (!destination) {
    return { ok: false, error: "Destination is required." };
  }

  if (!startDate || !endDate) {
    return { ok: false, error: "Start and end dates are required." };
  }

  if (endDate < startDate) {
    return { ok: false, error: "End date must be on or after the start date." };
  }

  if (!isTripType(tripType)) {
    return { ok: false, error: "Please select a valid trip type." };
  }

  if (!Number.isFinite(travelers) || travelers < 1) {
    return { ok: false, error: "Number of travelers must be at least 1." };
  }

  return {
    ok: true,
    destination,
    startDate,
    endDate,
    tripType,
    travelers,
  };
}

export async function createTrip(
  _prevState: CreateTripState,
  formData: FormData
): Promise<CreateTripState> {
  const parsed = parseTripFormData(formData);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const { destination, startDate, endDate, tripType, travelers } = parsed;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
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

  if (error || !data) {
    return { error: error?.message ?? "Could not create trip." };
  }

  // Packing is generated on the trip detail page via the same
  // regeneratePackingList action as the manual Generate button (avoids a
  // fragile internal HTTP kickoff that often fails after redirect).
  redirect(`/dashboard/trips/${data.id}?created=1`);
}

/**
 * Updates an owned trip. Regenerates packing when essentials change;
 * invalidates weather cache when destination or dates change.
 * Expects `tripId` in the form body (same fields as create).
 */
export async function updateTrip(
  _prevState: CreateTripState,
  formData: FormData
): Promise<CreateTripState> {
  const tripId = String(formData.get("tripId") ?? "").trim();
  if (!tripId) {
    return { error: "Trip id is required." };
  }

  const parsed = parseTripFormData(formData);
  if (!parsed.ok) {
    return { error: parsed.error };
  }

  const { destination, startDate, endDate, tripType, travelers } = parsed;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: existing, error: fetchError } = await supabase
    .from("trips")
    .select("id, user_id, destination, start_date, end_date, trip_type, travelers")
    .eq("id", tripId)
    .maybeSingle();

  if (fetchError || !existing) {
    return { error: fetchError?.message ?? "Trip not found." };
  }

  if (existing.user_id !== user.id) {
    return { error: "Only the trip owner can edit this trip." };
  }

  const destinationChanged = existing.destination !== destination;
  const datesChanged =
    existing.start_date !== startDate || existing.end_date !== endDate;
  const essentialsChanged =
    destinationChanged ||
    datesChanged ||
    existing.trip_type !== tripType ||
    existing.travelers !== travelers;

  const { error: updateError } = await supabase
    .from("trips")
    .update({
      destination,
      start_date: startDate,
      end_date: endDate,
      trip_type: tripType,
      travelers,
    })
    .eq("id", tripId)
    .eq("user_id", user.id);

  if (updateError) {
    return { error: updateError.message };
  }

  if (destinationChanged || datesChanged) {
    await invalidateTripWeatherCache(supabase, tripId);
  }

  if (essentialsChanged) {
    await generateAndStorePackingList({
      tripId,
      trip: {
        destination,
        startDate,
        endDate,
        tripType,
        travelers,
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/trips/${tripId}`);
  revalidatePath(`/dashboard/trips/${tripId}/edit`);
  redirect(`/dashboard/trips/${tripId}?updated=1`);
}
