/**
 * Profile RLS / privilege smoke test (no secrets printed).
 *
 * Usage: node scripts/tmp-test-profile-rls.mjs
 *
 * Requires .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, TEST_USER_JWT
 * Optional for service-role check:
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function errPayload(error) {
  if (!error) return null;
  return {
    message: error.message,
    code: error.code,
    details: error.details ?? null,
  };
}

const env = loadEnv(resolve(process.cwd(), ".env.local"));
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const jwt = env.TEST_USER_JWT?.trim();
const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !anon || !jwt) {
  console.log(JSON.stringify({ ok: false, error: "missing_url_anon_or_jwt" }));
  process.exit(1);
}

const userClient = createClient(url, anon, {
  global: { headers: { Authorization: `Bearer ${jwt}` } },
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
if (userErr || !userData?.user) {
  console.log(
    JSON.stringify({
      ok: false,
      error: "jwt_invalid",
      message: userErr?.message || "no user",
    })
  );
  process.exit(1);
}

const uid = userData.user.id;

const { data: before, error: beforeErr } = await userClient
  .from("profiles")
  .select("id, scans_remaining, scans_month, is_pro")
  .eq("id", uid)
  .maybeSingle();

if (beforeErr) {
  console.log(
    JSON.stringify({
      ok: false,
      step: "select_before",
      ...errPayload(beforeErr),
    })
  );
  process.exit(1);
}

const { data: badData, error: badErr } = await userClient
  .from("profiles")
  .update({ scans_remaining: 999 })
  .eq("id", uid)
  .select("id, scans_remaining")
  .maybeSingle();

const { data: afterBad } = await userClient
  .from("profiles")
  .select("scans_remaining, is_pro")
  .eq("id", uid)
  .maybeSingle();

const { data: proTry, error: proErr } = await userClient
  .from("profiles")
  .update({ is_pro: true })
  .eq("id", uid)
  .select("id, is_pro")
  .maybeSingle();

const { data: afterPro } = await userClient
  .from("profiles")
  .select("is_pro")
  .eq("id", uid)
  .maybeSingle();

/** Probe safe columns in preference order. */
const safeCandidates = [
  {
    kind: "packing_reminder_email",
    patch: { packing_reminder_email: true },
    select: "id, packing_reminder_email",
  },
  {
    kind: "push_notifications",
    patch: { push_notifications: true },
    select: "id, push_notifications",
  },
  {
    kind: "has_seen_onboarding",
    patch: { has_seen_onboarding: true },
    select: "id, has_seen_onboarding",
  },
  {
    kind: "display_name",
    patch: { display_name: "PackWise Test" },
    select: "id, display_name",
  },
];

let allowed = null;
for (const candidate of safeCandidates) {
  const { data, error } = await userClient
    .from("profiles")
    .update(candidate.patch)
    .eq("id", uid)
    .select(candidate.select)
    .maybeSingle();

  if (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    /does not exist|schema cache/i.test(error?.message || "")
  ) {
    continue;
  }

  allowed = {
    kind: candidate.kind,
    error: errPayload(error),
    returned: data,
  };
  break;
}

if (!allowed) {
  allowed = {
    kind: "none_available",
    error: {
      message:
        "No safe profile columns available yet (later migrations not applied).",
      code: "migration_pending",
    },
    returned: null,
  };
}

let serviceRoleResult = null;
if (serviceRole) {
  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const original = before?.scans_remaining ?? 0;
  const { error: srvErr } = await admin
    .from("profiles")
    .update({ scans_remaining: original })
    .eq("id", uid);
  serviceRoleResult = {
    can_write_privileged: !srvErr,
    error: errPayload(srvErr),
  };
} else {
  serviceRoleResult = { skipped: true, reason: "no_service_role_key" };
}

const scansUnchanged =
  afterBad?.scans_remaining !== 999 &&
  afterBad?.scans_remaining === before?.scans_remaining;
const scansBlocked = Boolean(badErr) || scansUnchanged;
const proBlocked =
  Boolean(proErr) || afterPro?.is_pro === before?.is_pro;

console.log(
  JSON.stringify(
    {
      ok: true,
      user_id_prefix: uid.slice(0, 8),
      before_scans: before?.scans_remaining,
      before_is_pro: before?.is_pro,
      scans_blocked: scansBlocked,
      scans_rejected_with_error: Boolean(badErr),
      is_pro_blocked: proBlocked,
      allowed_update_ok: Boolean(allowed && !allowed.error),
      blocked_update: {
        error: errPayload(badErr),
        returned: badData,
        scans_after: afterBad?.scans_remaining,
      },
      allowed_update: allowed,
      blocked_is_pro: {
        error: errPayload(proErr),
        returned: proTry,
        is_pro_after: afterPro?.is_pro,
      },
      service_role: serviceRoleResult,
    },
    null,
    2
  )
);

const failed =
  !scansBlocked ||
  !proBlocked ||
  (allowed.kind !== "none_available" && allowed.error);

process.exit(failed ? 2 : 0);
