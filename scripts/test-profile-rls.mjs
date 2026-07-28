/**
 * Smoke-test: authenticated clients must NOT update profiles.scans_remaining.
 *
 * Usage: node scripts/test-profile-rls.mjs
 *
 * Requires .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, TEST_USER_JWT
 * Optional: TEST_USER_ID, SUPABASE_SERVICE_ROLE_KEY (cleanup if value changed)
 *
 * If JWT expired: node scripts/create-test-user.mjs --write-env
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TARGET = 9999;

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

function isRlsOrPermissionError(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "");
  return (
    code === "42501" ||
    code === "PGRST301" ||
    /permission denied|not allowed|rls|policy|row-level security|violates/i.test(
      msg
    )
  );
}

const env = loadEnv(resolve(process.cwd(), ".env.local"));
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const jwt = env.TEST_USER_JWT?.trim();
const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const envUserId = env.TEST_USER_ID?.trim();

if (!url || !anon || !jwt) {
  console.error(
    "FAIL: missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, or TEST_USER_JWT"
  );
  process.exit(1);
}

const userClient = createClient(url, anon, {
  global: { headers: { Authorization: `Bearer ${jwt}` } },
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
if (userErr || !userData?.user) {
  console.error(
    "FAIL: JWT invalid or expired — run: node scripts/create-test-user.mjs --write-env"
  );
  console.error(`  detail: ${userErr?.message || "no user"}`);
  process.exit(1);
}

const uid = envUserId || userData.user.id;
if (envUserId && envUserId !== userData.user.id) {
  console.error(
    "FAIL: TEST_USER_ID does not match JWT subject — refusing to run"
  );
  process.exit(1);
}

const { data: before, error: beforeErr } = await userClient
  .from("profiles")
  .select("id, scans_remaining")
  .eq("id", uid)
  .maybeSingle();

if (beforeErr) {
  console.error("FAIL: could not read own profile");
  console.error(`  code=${beforeErr.code || "?"} message=${beforeErr.message}`);
  process.exit(1);
}

const original = before?.scans_remaining ?? null;
console.log(
  `user=${uid.slice(0, 8)}… scans_remaining_before=${original ?? "null"}`
);

const { data: updated, error: updateErr } = await userClient
  .from("profiles")
  .update({ scans_remaining: TARGET })
  .eq("id", uid)
  .select("id, scans_remaining")
  .maybeSingle();

const { data: after } = await userClient
  .from("profiles")
  .select("scans_remaining")
  .eq("id", uid)
  .maybeSingle();

const afterValue = after?.scans_remaining ?? null;
const becameTarget = afterValue === TARGET;
const rejected = Boolean(updateErr) && isRlsOrPermissionError(updateErr);

if (becameTarget) {
  console.error(
    "FAIL / vulnerability still open: scans_remaining was set to 9999 via anon+JWT"
  );
  if (updateErr) {
    console.error(
      `  update_error (unexpected with success): code=${updateErr.code || "?"} message=${updateErr.message}`
    );
  } else {
    console.error(`  update_returned_scans=${updated?.scans_remaining}`);
  }

  if (serviceRole && original !== null && original !== TARGET) {
    const admin = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: resetErr } = await admin
      .from("profiles")
      .update({ scans_remaining: original })
      .eq("id", uid);
    if (resetErr) {
      console.error(
        `  cleanup FAILED — left at 9999: ${resetErr.message}`
      );
    } else {
      console.error(`  cleanup: restored scans_remaining to ${original}`);
    }
  } else if (!serviceRole) {
    console.error(
      "  cleanup skipped (no SUPABASE_SERVICE_ROLE_KEY) — reset scans_remaining manually"
    );
  }

  process.exit(2);
}

if (rejected || (!becameTarget && afterValue === original)) {
  console.log(
    "PASS: privileged scans_remaining update blocked — fix is working"
  );
  if (updateErr) {
    console.log(
      `  rejection: code=${updateErr.code || "?"} message=${updateErr.message}`
    );
  } else {
    console.log(
      `  soft-block: update returned no error but value unchanged (${afterValue})`
    );
  }
  process.exit(0);
}

console.error("FAIL: unexpected outcome");
console.error(
  `  update_error=${updateErr ? `${updateErr.code}: ${updateErr.message}` : "none"}`
);
console.error(`  scans_after=${afterValue} original=${original}`);
process.exit(2);
