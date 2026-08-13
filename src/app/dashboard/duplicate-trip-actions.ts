"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type DuplicateTripResult =
  | { ok: true; tripId: string }
  | { ok: false; error: string };

/**
 * Copies an accessible trip (owned or shared) into a new trip owned by the
 * current user. Dates and other fields are copied as-is; packing list is
 * generated on the trip detail page (same path as create-trip).
 */
export async function duplicateTrip(
  tripId: string
): Promise<DuplicateTripResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: source, error: fetchError } = await supabase
    .from("trips")
    .select("destination, start_date, end_date, trip_type, travelers")
    .eq("id", tripId)
    .maybeSingle();

  if (fetchError || !source) {
    return {
      error: fetchError?.message ?? "Trip not found or you do not have access.",
      ok: false,
    };
  }

  const { data: created, error: insertError } = await supabase
    .from("trips")
    .insert({
      user_id: user.id,
      destination: source.destination,
      start_date: source.start_date,
      end_date: source.end_date,
      trip_type: source.trip_type,
      travelers: source.travelers,
    })
    .select("id")
    .single();

  if (insertError || !created) {
    return {
      error: insertError?.message ?? "Could not duplicate trip.",
      ok: false,
    };
  }

  // Packing auto-generates on trip detail via regeneratePackingList.
  revalidatePath("/dashboard");
  redirect(`/dashboard/trips/${created.id}?duplicated=1`);
}
