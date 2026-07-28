"use server";

import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "suitcase-scans";
const CONFIRM_WORD = "DELETE";

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; error: string };

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

type StorageClient = {
  storage: {
    from: (bucket: string) => {
      list: (
        path?: string,
        options?: { limit?: number; offset?: number }
      ) => Promise<{ data: { name: string; id?: string | null }[] | null; error: unknown }>;
      remove: (paths: string[]) => Promise<{ error: unknown }>;
    };
  };
};

/**
 * Removes suitcase-scan objects under `{tripId}/{userId}/` for the given trips.
 */
async function removeUserSuitcaseScans(
  storageClient: StorageClient,
  userId: string,
  tripIds: string[]
) {
  for (const tripId of tripIds) {
    const folder = `${tripId}/${userId}`;
    const { data: files } = await storageClient.storage
      .from(BUCKET)
      .list(folder);

    if (!files?.length) continue;

    const paths = files
      .filter((file) => Boolean(file.name))
      .map((file) => `${folder}/${file.name}`);

    if (paths.length > 0) {
      await storageClient.storage.from(BUCKET).remove(paths);
    }
  }
}

/**
 * For trips the user owns, also remove member-uploaded scans under
 * `{tripId}/{uploaderId}/…`.
 */
async function removeSuitcaseScansForOwnedTrips(
  storageClient: StorageClient,
  ownerId: string,
  tripIds: string[],
  memberUserIdsByTrip: Map<string, string[]>
) {
  for (const tripId of tripIds) {
    const userIds = new Set<string>([ownerId]);
    for (const memberId of memberUserIdsByTrip.get(tripId) ?? []) {
      userIds.add(memberId);
    }

    for (const uid of Array.from(userIds)) {
      const folder = `${tripId}/${uid}`;
      const { data: files } = await storageClient.storage
        .from(BUCKET)
        .list(folder);

      if (!files?.length) continue;

      const paths = files
        .filter((file) => Boolean(file.name))
        .map((file) => `${folder}/${file.name}`);

      if (paths.length > 0) {
        await storageClient.storage.from(BUCKET).remove(paths);
      }
    }
  }
}

/**
 * Permanently deletes the signed-in user's account and associated data.
 * Service role is required for auth.admin.deleteUser and thorough storage cleanup.
 */
export async function deleteAccount(
  confirmation: string
): Promise<DeleteAccountResult> {
  if (confirmation.trim() !== CONFIRM_WORD) {
    return {
      ok: false,
      error: `Type ${CONFIRM_WORD} to confirm account deletion.`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const service = createServiceClient();
  if (!service) {
    return {
      ok: false,
      error: "Account deletion is temporarily unavailable. Please try again later.",
    };
  }

  const userId = user.id;

  // Owned trips (packing_lists, trip_weather, invites, members cascade on trip delete /
  // user delete). Collect ids first so we can clean Storage.
  const { data: ownedTrips, error: tripsError } = await service
    .from("trips")
    .select("id")
    .eq("user_id", userId);

  if (tripsError) {
    return { ok: false, error: tripsError.message };
  }

  const tripIds = (ownedTrips ?? []).map((t) => t.id as string);
  const memberUserIdsByTrip = new Map<string, string[]>();

  if (tripIds.length > 0) {
    const { data: members } = await service
      .from("trip_members")
      .select("trip_id, user_id")
      .in("trip_id", tripIds);

    for (const row of members ?? []) {
      const tripId = row.trip_id as string;
      const memberId = row.user_id as string;
      const list = memberUserIdsByTrip.get(tripId) ?? [];
      list.push(memberId);
      memberUserIdsByTrip.set(tripId, list);
    }
  }

  // Trips this user belongs to (for cleaning their own `{tripId}/{userId}/` scans).
  const { data: memberships } = await service
    .from("trip_members")
    .select("trip_id")
    .eq("user_id", userId);

  const userScanTripIds = new Set<string>(tripIds);
  for (const row of memberships ?? []) {
    if (row.trip_id) {
      userScanTripIds.add(row.trip_id as string);
    }
  }

  await removeUserSuitcaseScans(service, userId, Array.from(userScanTripIds));
  await removeSuitcaseScansForOwnedTrips(
    service,
    userId,
    tripIds,
    memberUserIdsByTrip
  );

  // Explicit DB cleanup before auth delete (storage already done).
  // FKs: trips.user_id → auth.users ON DELETE CASCADE also covers packing_lists,
  // trip_weather, trip_members, trip_invites, and profiles — but we delete owned
  // trips first so member-uploaded storage paths above stay consistent.
  if (tripIds.length > 0) {
    const { error: deleteTripsError } = await service
      .from("trips")
      .delete()
      .eq("user_id", userId);

    if (deleteTripsError) {
      return { ok: false, error: deleteTripsError.message };
    }
  }

  // Memberships / invites created by this user on others' trips.
  await service.from("trip_members").delete().eq("user_id", userId);
  await service.from("trip_invites").delete().eq("created_by", userId);
  await service.from("profiles").delete().eq("id", userId);

  const { error: deleteUserError } = await service.auth.admin.deleteUser(userId);
  if (deleteUserError) {
    return { ok: false, error: deleteUserError.message };
  }

  // Clear the caller's session cookies (user row is already gone).
  await supabase.auth.signOut();

  return { ok: true };
}
