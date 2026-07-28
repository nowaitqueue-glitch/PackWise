"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "suitcase-scans";

export type DeleteTripResult =
  | { ok: true }
  | { ok: false; error: string };

type StorageListClient = {
  storage: {
    from: (bucket: string) => {
      list: (
        path?: string
      ) => Promise<{ data: { name: string }[] | null; error: unknown }>;
      remove: (paths: string[]) => Promise<{ error: unknown }>;
    };
  };
};

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    return null;
  }

  return createSupabaseJsClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Removes suitcase-scan objects under `{tripId}/{userId}/` for each user.
 * Prefer service-role so member-uploaded scans can be cleaned; fall back to
 * the caller's client (owner can only delete their own folder via RLS).
 */
async function removeSuitcaseScansForTrip(
  storageClient: StorageListClient,
  userIds: string[],
  tripId: string
) {
  for (const userId of userIds) {
    const folder = `${tripId}/${userId}`;
    const { data: files, error: listError } = await storageClient.storage
      .from(BUCKET)
      .list(folder);

    if (listError || !files?.length) {
      continue;
    }

    const paths = files
      .filter((file) => Boolean(file.name))
      .map((file) => `${folder}/${file.name}`);

    if (paths.length === 0) {
      continue;
    }

    await storageClient.storage.from(BUCKET).remove(paths);
  }
}

/**
 * Deletes a trip owned by the current user. Related DB rows cascade via FKs;
 * suitcase-scan objects in Storage are removed explicitly.
 */
export async function deleteTrip(tripId: string): Promise<DeleteTripResult> {
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

  // Double-check ownership beyond RLS (delete policy is already owner-only).
  if (trip.user_id !== user.id) {
    return { ok: false, error: "Only the trip owner can delete this trip." };
  }

  const storageUserIds = new Set<string>([trip.user_id]);

  const { data: members } = await supabase
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", tripId);

  for (const member of members ?? []) {
    if (member.user_id) {
      storageUserIds.add(member.user_id);
    }
  }

  const service = createServiceClient();
  await removeSuitcaseScansForTrip(
    service ?? supabase,
    Array.from(storageUserIds),
    tripId
  );

  const { error: deleteError } = await supabase
    .from("trips")
    .delete()
    .eq("id", tripId)
    .eq("user_id", user.id);

  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/trips/${tripId}`);

  return { ok: true };
}
