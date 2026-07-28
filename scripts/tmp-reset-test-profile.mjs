/**
 * Reset test user privileged profile fields via service role (cleanup after RLS probes).
 * Does not print secrets.
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

const env = loadEnv(resolve(process.cwd(), ".env.local"));
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const uid = env.TEST_USER_ID?.trim();

if (!url || !serviceRole || !uid) {
  console.log(JSON.stringify({ ok: false, error: "missing_env" }));
  process.exit(1);
}

const admin = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: before } = await admin
  .from("profiles")
  .select("scans_remaining, is_pro")
  .eq("id", uid)
  .maybeSingle();

const { error } = await admin
  .from("profiles")
  .update({ scans_remaining: 3, is_pro: false })
  .eq("id", uid);

const { data: after } = await admin
  .from("profiles")
  .select("scans_remaining, is_pro")
  .eq("id", uid)
  .maybeSingle();

console.log(
  JSON.stringify({
    reset_ok: !error,
    before_scans: before?.scans_remaining,
    after_scans: after?.scans_remaining,
    after_is_pro: after?.is_pro,
    error: error?.message ?? null,
  })
);

process.exit(error ? 1 : 0);
