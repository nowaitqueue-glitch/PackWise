/**
 * Smoke-test custom packing items: create -> toggle packed -> delete.
 *
 * Usage: node scripts/test-custom-packing-items.mjs
 *
 * Requires .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, TEST_USER_JWT
 * Optional: TEST_USER_ID
 *
 * If JWT expired: node scripts/create-test-user.mjs --write-env
 *
 * Does not print secrets. Leaves no trip/custom rows behind on success.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

function fail(step, detail) {
  console.error(`FAIL [${step}]: ${detail}`);
  process.exit(1);
}

function ok(step, detail) {
  console.log(`OK   [${step}]: ${detail}`);
}

const env = loadEnv(resolve(process.cwd(), ".env.local"));
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const jwt = env.TEST_USER_JWT?.trim();
const envUserId = env.TEST_USER_ID?.trim();

if (!url || !anon || !jwt) {
  fail(
    "env",
    "missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, or TEST_USER_JWT"
  );
}

const userClient = createClient(url, anon, {
  global: { headers: { Authorization: `Bearer ${jwt}` } },
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
if (userErr || !userData?.user) {
  fail(
    "auth",
    `JWT invalid or expired — run: node scripts/create-test-user.mjs --write-env (${userErr?.message || "no user"})`
  );
}

const uid = envUserId || userData.user.id;
ok("auth", `signed in as ${uid.slice(0, 8)}…`);

const start = new Date();
start.setUTCDate(start.getUTCDate() + 14);
const end = new Date(start);
end.setUTCDate(end.getUTCDate() + 3);
const startDate = start.toISOString().slice(0, 10);
const endDate = end.toISOString().slice(0, 10);

const { data: trip, error: tripErr } = await userClient
  .from("trips")
  .insert({
    user_id: uid,
    destination: "Custom Items Test City",
    start_date: startDate,
    end_date: endDate,
    trip_type: "city break",
    travelers: 1,
  })
  .select("id")
  .single();

if (tripErr || !trip) {
  fail("create-trip", tripErr?.message || "no trip row");
}

const tripId = trip.id;
ok("create-trip", tripId.slice(0, 8) + "…");

let customItemId = null;

try {
  const { data: created, error: createErr } = await userClient
    .from("packing_custom_items")
    .insert({
      trip_id: tripId,
      user_id: uid,
      name: "Travel pillow",
      category: "Comfort",
      notes: "Inflatable",
      packed: false,
    })
    .select("id, name, packed, category")
    .single();

  if (createErr || !created) {
    fail(
      "create-custom",
      createErr?.message ||
        "insert failed — apply migration 20260726110000_create_packing_custom_items if missing"
    );
  }

  customItemId = created.id;
  ok("create-custom", `${created.name} (${created.category})`);

  const { data: toggled, error: toggleErr } = await userClient
    .from("packing_custom_items")
    .update({ packed: true })
    .eq("id", customItemId)
    .eq("trip_id", tripId)
    .select("id, packed")
    .single();

  if (toggleErr || !toggled || toggled.packed !== true) {
    fail("toggle-packed", toggleErr?.message || "packed was not true");
  }
  ok("toggle-packed", "packed=true");

  const { data: listed, error: listErr } = await userClient
    .from("packing_custom_items")
    .select("id, name, packed")
    .eq("trip_id", tripId);

  if (listErr) {
    fail("select", listErr.message);
  }
  if (!listed?.some((row) => row.id === customItemId && row.packed === true)) {
    fail("select", "created item missing or not packed");
  }
  ok("select", `${listed.length} custom item(s) for trip`);

  const { data: deleted, error: deleteErr } = await userClient
    .from("packing_custom_items")
    .delete()
    .eq("id", customItemId)
    .eq("trip_id", tripId)
    .select("id")
    .maybeSingle();

  if (deleteErr || !deleted) {
    fail("delete", deleteErr?.message || "no deleted row returned");
  }
  customItemId = null;
  ok("delete", "custom item removed");

  const { count, error: countErr } = await userClient
    .from("packing_custom_items")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", tripId);

  if (countErr) {
    fail("verify-empty", countErr.message);
  }
  if ((count ?? 0) !== 0) {
    fail("verify-empty", `expected 0 rows, got ${count}`);
  }
  ok("verify-empty", "no leftover custom items");
} finally {
  if (customItemId) {
    await userClient
      .from("packing_custom_items")
      .delete()
      .eq("id", customItemId);
  }
  const { error: cleanupErr } = await userClient
    .from("trips")
    .delete()
    .eq("id", tripId);
  if (cleanupErr) {
    console.warn(`WARN [cleanup-trip]: ${cleanupErr.message}`);
  } else {
    ok("cleanup-trip", "test trip deleted");
  }
}

console.log("PASS: custom packing items create / toggle / delete");
