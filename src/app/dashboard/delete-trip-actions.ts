"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "suitcase-scans";

export type DeleteTripResult =
  | { ok: true }
  | { ok: false; error: string };

export type DeleteTripsResult = {
  ok: boolean;
  deletedIds: string[];
  failedIds: string[];
  error?: string;
};

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

type AuthedSupabase = Awaited<ReturnType<typeof createClient>>;

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

async function deleteOwnedTrip(
  supabase: AuthedSupabase,
  userId: string,
  tripId: string
): Promise<DeleteTripResult> {
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, user_id")
    .eq("id", tripId)
    .maybeSingle();

  if (tripError || !trip) {
    return { ok: false, error: "Trip not found." };
  }

  // Double-check ownership beyond RLS (delete policy is already owner-only).
  if (trip.user_id !== userId) {
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
    .eq("user_id", userId);

  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  return { ok: true };
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

  const result = await deleteOwnedTrip(supabase, user.id, tripId);
  if (!result.ok) {
    return result;
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/trips/${tripId}`);

  return { ok: true };
}

/**
 * Batch-deletes trips owned by the current user. Non-owned / missing ids are
 * reported in `failedIds` without aborting the rest.
 */
export async function deleteTrips(
  tripIds: string[]
): Promise<DeleteTripsResult> {
  const uniqueIds = Array.from(new Set(tripIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return { ok: true, deletedIds: [], failedIds: [] };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      deletedIds: [],
      failedIds: uniqueIds,
      error: "You must be signed in.",
    };
  }

  const deletedIds: string[] = [];
  const failedIds: string[] = [];
  let firstError: string | undefined;

  for (const tripId of uniqueIds) {
    const result = await deleteOwnedTrip(supabase, user.id, tripId);
    if (result.ok) {
      deletedIds.push(tripId);
      revalidatePath(`/dashboard/trips/${tripId}`);
    } else {
      failedIds.push(tripId);
      firstError ??= result.error;
    }
  }

  if (deletedIds.length > 0) {
    revalidatePath("/dashboard");
  }

  return {
    ok: failedIds.length === 0,
    deletedIds,
    failedIds,
    error: firstError,
  };
}