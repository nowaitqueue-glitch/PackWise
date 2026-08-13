/**
 * Smoke test: packing generate is kickoff-fast; packing_lists row appears shortly after.
 * Does not print secrets.
 *
 * Usage (dev server running):
 *   node scripts/test-async-packing.mjs
 *   TEST_BASE_URL=http://127.0.0.1:3002 node scripts/test-async-packing.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";
import { isPlaceholderSecret } from "./lib/env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env.local") });

const BASE_URL = (
  process.env.TEST_BASE_URL ||
  process.env.BASE_URL ||
  "http://127.0.0.1:3002"
).replace(/\/$/, "");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const JWT =
  process.env.TEST_USER_JWT?.trim() ||
  process.env.SUPABASE_ACCESS_TOKEN?.trim();

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

function isoDate(daysFromToday) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

async function main() {
  if (!SUPABASE_URL || isPlaceholderSecret(SUPABASE_URL)) {
    fail("NEXT_PUBLIC_SUPABASE_URL missing/placeholder");
  }
  if (!ANON_KEY || isPlaceholderSecret(ANON_KEY)) {
    fail("NEXT_PUBLIC_SUPABASE_ANON_KEY missing/placeholder");
  }
  if (!JWT || isPlaceholderSecret(JWT)) {
    fail("TEST_USER_JWT missing/placeholder — run: npm run test:user");
  }

  console.log("Async packing smoke");
  console.log("  Base URL:", BASE_URL);

  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${JWT}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(JWT);
  if (userError || !user) {
    fail("JWT invalid/expired — re-run create-test-user");
  }

  const startDate = isoDate(14);
  const endDate = isoDate(17);

  const insertStarted = Date.now();
  const { data: trip, error: insertError } = await supabase
    .from("trips")
    .insert({
      user_id: user.id,
      destination: "Lisbon, PT",
      start_date: startDate,
      end_date: endDate,
      trip_type: "city break",
      travelers: 1,
    })
    .select("id")
    .single();
  const insertMs = Date.now() - insertStarted;

  if (insertError || !trip) {
    fail(`Trip insert failed: ${insertError?.message ?? "no data"}`);
  }

  console.log(`  Trip insert: ${insertMs}ms (id=${trip.id})`);

  // API client path: fire-and-forget generate (trip create uses client regenerate instead).
  const kickoffStarted = Date.now();
  const generatePromise = fetch(`${BASE_URL}/api/packing/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${JWT}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tripId: trip.id }),
  }).catch((err) => err);
  const kickoffMs = Date.now() - kickoffStarted;
  console.log(`  Kickoff fetch dispatched: ${kickoffMs}ms`);

  // Poll packing_lists until items appear (what trip detail does).
  const pollStarted = Date.now();
  let itemCount = 0;
  let attempts = 0;
  const deadline = pollStarted + 45_000;

  while (Date.now() < deadline) {
    attempts += 1;
    const { data: packing } = await supabase
      .from("packing_lists")
      .select("items")
      .eq("trip_id", trip.id)
      .maybeSingle();

    const raw = packing?.items;
    const items = Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object" && Array.isArray(raw.items)
        ? raw.items
        : [];
    if (items.length > 0) {
      itemCount = items.length;
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  const pollMs = Date.now() - pollStarted;
  if (itemCount === 0) {
    fail(`Packing list never appeared after ${pollMs}ms (${attempts} polls)`);
  }

  console.log(
    `  Packing list appeared: ${pollMs}ms after kickoff (${itemCount} items, ${attempts} polls)`
  );

  // Drain generate response for status (not on critical path).
  try {
    const res = await generatePromise;
    if (res instanceof Error) {
      throw res;
    }
    const body = await res.json().catch(() => ({}));
    console.log(
      `  Generate HTTP ${res.status} (itemCount=${body.itemCount ?? "?"})`
    );
  } catch (err) {
    console.log(
      "  Generate response error (list already present):",
      err instanceof Error ? err.message : err
    );
  }

  // Cleanup test trip
  await supabase.from("trips").delete().eq("id", trip.id);
  console.log("  Cleaned up test trip");
  console.log("✔ async packing smoke OK");
}

main().catch((err) => {
  fail(err instanceof Error ? err.stack : String(err));
});
