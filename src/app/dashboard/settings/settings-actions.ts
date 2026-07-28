"use server";

import { createClient } from "@/lib/supabase/server";

export type SettingsActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type DownloadMyDataResult =
  | {
      ok: true;
      data: {
        exportedAt: string;
        email: string | null;
        profile: Record<string, unknown> | null;
        trips: Record<string, unknown>[];
        packingLists: Record<string, unknown>[];
      };
    }
  | { ok: false; error: string };

export async function updateNotificationPrefs(input: {
  packingReminderEmail?: boolean;
  pushNotifications?: boolean;
}): Promise<SettingsActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const patch: Record<string, boolean> = {};
  if (typeof input.packingReminderEmail === "boolean") {
    patch.packing_reminder_email = input.packingReminderEmail;
  }
  if (typeof input.pushNotifications === "boolean") {
    patch.push_notifications = input.pushNotifications;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!updated) {
    // Clients cannot INSERT profiles; ensure signup row exists via RPC, then patch prefs.
    const { error: ensureError } = await supabase.rpc("ensure_scan_quota");
    if (ensureError) {
      return { ok: false, error: ensureError.message };
    }

    const { error: retryError } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", user.id);

    if (retryError) {
      return { ok: false, error: retryError.message };
    }
  }

  return { ok: true };
}

export async function downloadMyData(): Promise<DownloadMyDataResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "You must be signed in." };
  }

  const [{ data: profile }, { data: trips, error: tripsError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, is_pro, packing_reminder_email, push_notifications, has_seen_onboarding, created_at, updated_at"
        )
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("trips")
        .select(
          "id, destination, start_date, end_date, trip_type, travelers, created_at"
        )
        .eq("user_id", user.id)
        .order("start_date", { ascending: true }),
    ]);

  if (tripsError) {
    return { ok: false, error: tripsError.message };
  }

  const tripIds = (trips ?? []).map((t) => t.id as string);
  let packingLists: Record<string, unknown>[] = [];

  if (tripIds.length > 0) {
    const { data: lists, error: listsError } = await supabase
      .from("packing_lists")
      .select("id, trip_id, items, created_at, updated_at")
      .in("trip_id", tripIds);

    if (listsError) {
      return { ok: false, error: listsError.message };
    }
    packingLists = (lists ?? []) as Record<string, unknown>[];
  }

  return {
    ok: true,
    data: {
      exportedAt: new Date().toISOString(),
      email: user.email ?? null,
      profile: (profile as Record<string, unknown> | null) ?? null,
      trips: (trips ?? []) as Record<string, unknown>[],
      packingLists,
    },
  };
}
