"use server";

import { createClient } from "@/lib/supabase/server";

export type MarkOnboardingSeenResult =
  | { ok: true }
  | { ok: false; error: string };

/** Persist that the current user finished or skipped the dashboard tour. */
export async function markOnboardingSeen(): Promise<MarkOnboardingSeenResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ has_seen_onboarding: true })
    .eq("id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
