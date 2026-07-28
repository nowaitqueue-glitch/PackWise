import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const FREE_MONTHLY_SCANS = 3;

export type UserProfile = {
  id: string;
  scans_remaining: number;
  scans_month: string;
  is_pro: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

export type ScanQuota = {
  isPro: boolean;
  scansRemaining: number;
  scansMonth: string;
  canScan: boolean;
};

type ScanQuotaRpcRow = {
  id?: string;
  scans_remaining?: number;
  scans_month?: string;
  is_pro?: boolean;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
};

type ConsumeScanCreditRpc = {
  ok?: boolean;
  error?: string;
  scans_remaining?: number;
  is_pro?: boolean;
};

/** Current UTC calendar month as YYYY-MM. */
export function currentScansMonth(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Env override for local testing — forces Pro for everyone when true.
 * Does not grant Pro merely because GEMINI_API_KEY is set.
 */
export function envForcesProAccess(): boolean {
  return process.env.PACKWISE_PRO?.trim() === "true";
}

/**
 * Sync stub: PACKWISE_PRO=true only.
 * Prefer `userHasProAccessForUser(userId)` when a user id is available.
 */
export function userHasProAccess(): boolean {
  return envForcesProAccess();
}

function profileFromQuotaRpc(data: unknown): UserProfile | null {
  if (!data || typeof data !== "object") {
    return null;
  }
  const row = data as ScanQuotaRpcRow;
  if (typeof row.id !== "string") {
    return null;
  }
  return {
    id: row.id,
    scans_remaining:
      typeof row.scans_remaining === "number"
        ? row.scans_remaining
        : FREE_MONTHLY_SCANS,
    scans_month:
      typeof row.scans_month === "string"
        ? row.scans_month
        : currentScansMonth(),
    is_pro: row.is_pro === true,
    stripe_customer_id:
      typeof row.stripe_customer_id === "string"
        ? row.stripe_customer_id
        : null,
    stripe_subscription_id:
      typeof row.stripe_subscription_id === "string"
        ? row.stripe_subscription_id
        : null,
  };
}

/**
 * Loads the signed-in user's profile. Prefer signup trigger for creation;
 * falls back to ensure_scan_quota RPC (SECURITY DEFINER) if the row is missing.
 * Clients can no longer INSERT into profiles.
 */
export async function getOrCreateProfile(
  userId: string,
  supabaseClient?: SupabaseClient
): Promise<UserProfile | null> {
  const supabase = supabaseClient ?? (await createClient());

  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select(
      "id, scans_remaining, scans_month, is_pro, stripe_customer_id, stripe_subscription_id"
    )
    .eq("id", userId)
    .maybeSingle();

  if (selectError) {
    console.error("profiles select failed:", selectError.message);
    return null;
  }

  if (existing) {
    return existing as UserProfile;
  }

  // No client INSERT — ensure_scan_quota creates a free-tier row if needed.
  const { data: ensured, error: rpcError } = await supabase.rpc(
    "ensure_scan_quota"
  );

  if (rpcError) {
    console.error("ensure_scan_quota failed:", rpcError.message);
    return null;
  }

  return profileFromQuotaRpc(ensured);
}

/**
 * Pro when PACKWISE_PRO=true, or profile.is_pro / active Stripe subscription id.
 */
export async function userHasProAccessForUser(
  userId: string,
  supabaseClient?: SupabaseClient
): Promise<boolean> {
  if (envForcesProAccess()) {
    return true;
  }

  const profile = await getOrCreateProfile(userId, supabaseClient);
  if (!profile) {
    return false;
  }

  return profile.is_pro === true || Boolean(profile.stripe_subscription_id);
}

/**
 * Ensures monthly free-tier quota is reset (via ensure_scan_quota RPC), then
 * returns current scan allowance. Direct profiles UPDATE of scans_* is blocked.
 */
export async function getScanQuota(
  userId: string,
  supabaseClient?: SupabaseClient
): Promise<ScanQuota> {
  const supabase = supabaseClient ?? (await createClient());
  const isPro = await userHasProAccessForUser(userId, supabase);

  if (isPro) {
    return {
      isPro: true,
      scansRemaining: FREE_MONTHLY_SCANS,
      scansMonth: currentScansMonth(),
      canScan: true,
    };
  }

  const { data, error } = await supabase.rpc("ensure_scan_quota");

  if (error) {
    console.error("ensure_scan_quota failed:", error.message);
    const fallback = await getOrCreateProfile(userId, supabase);
    if (!fallback) {
      return {
        isPro: false,
        scansRemaining: 0,
        scansMonth: currentScansMonth(),
        canScan: false,
      };
    }
    return {
      isPro: false,
      scansRemaining: fallback.scans_remaining,
      scansMonth: fallback.scans_month,
      canScan: fallback.scans_remaining > 0,
    };
  }

  const profile = profileFromQuotaRpc(data);
  if (!profile) {
    return {
      isPro: false,
      scansRemaining: 0,
      scansMonth: currentScansMonth(),
      canScan: false,
    };
  }

  return {
    isPro: false,
    scansRemaining: profile.scans_remaining,
    scansMonth: profile.scans_month,
    canScan: profile.scans_remaining > 0,
  };
}

/**
 * Decrements free-tier scans_remaining after a successful scan via
 * consume_scan_credit SECURITY DEFINER RPC. No-op for Pro users.
 */
export async function consumeScanCredit(
  userId: string,
  supabaseClient?: SupabaseClient
): Promise<{ ok: true; scansRemaining: number } | { ok: false; error: string }> {
  const supabase = supabaseClient ?? (await createClient());

  if (await userHasProAccessForUser(userId, supabase)) {
    return { ok: true, scansRemaining: FREE_MONTHLY_SCANS };
  }

  const { data, error } = await supabase.rpc("consume_scan_credit");

  if (error) {
    return { ok: false, error: error.message };
  }

  const payload = (data ?? {}) as ConsumeScanCreditRpc;
  if (payload.ok !== true) {
    return {
      ok: false,
      error:
        typeof payload.error === "string"
          ? payload.error
          : "No suitcase scans remaining this month.",
    };
  }

  const remaining =
    typeof payload.scans_remaining === "number"
      ? payload.scans_remaining
      : 0;

  return { ok: true, scansRemaining: remaining };
}
