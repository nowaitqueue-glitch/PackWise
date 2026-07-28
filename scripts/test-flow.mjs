/**
 * PackWise end-to-end smoke test (create trip → packing generate → weather).
 *
 * Run (with `npm run dev` or `npm start` listening):
 *   node scripts/test-flow.mjs
 *   node scripts/test-flow.mjs --mock-apis
 *
 * Flags:
 *   --mock-apis  Skip real Open-Meteo `/api/weather`. Upserts a predefined
 *                packing list into Supabase `packing_lists` and uses a hardcoded
 *                weather response matching `WeatherForecastResult`. Logs both
 *                mock JSON payloads. (Packing generate always uses curated
 *                templates — no Gemini.)
 *
 * Auth bootstrap (recommended):
 *   node scripts/create-test-user.mjs --write-env
 *   → writes TEST_USER_JWT (+ ids) into `.env.local`
 *
 * Auth resolution (prefer token first):
 *   1) TEST_USER_JWT or SUPABASE_ACCESS_TOKEN — validated via getUser, then
 *      used as Bearer for REST + /api/packing/generate.
 *   2) SUPABASE_SERVICE_ROLE_KEY + TEST_USER_ID — mints a short-lived session
 *      via Admin generateLink + verifyOtp when no JWT is set.
 *
 * Env (see .env.local.example): loaded from project-root `.env.local`.
 *   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (required)
 *   TEST_USER_JWT | SUPABASE_ACCESS_TOKEN (preferred)
 *   SUPABASE_SERVICE_ROLE_KEY, TEST_USER_ID (optional fallback)
 *   TEST_BASE_URL (default http://localhost:3000)
 *   Weather + city search use Open-Meteo (no API key).
 */

import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";
import {
  isPlaceholderSecret,
} from "./lib/env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

dotenv.config({ path: path.join(root, ".env.local") });

const MOCK_APIS = process.argv.includes("--mock-apis");

const BASE_URL = (process.env.TEST_BASE_URL || "http://localhost:3000").replace(
  /\/$/,
  ""
);
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const TEST_USER_ID = process.env.TEST_USER_ID?.trim();
const TRIP_TYPE = "city break"; // matches public.trip_type enum

/** Realistic sample packing list for --mock-apis (Berlin city break). */
function buildMockPackingItems() {
  const defs = [
    {
      name: "Passport / ID",
      category: "Documents",
      notes: "Valid through travel dates; keep a digital copy",
    },
    {
      name: "Travel insurance card",
      category: "Documents",
      notes: "Policy number and emergency contacts",
    },
    {
      name: "Comfortable walking shoes",
      category: "Clothing",
      notes: "Broken-in pair for city sightseeing",
    },
    {
      name: "Light jacket",
      category: "Clothing",
      notes: "Layer for cool evenings and rain showers",
    },
    {
      name: "2–3 day outfits",
      category: "Clothing",
      notes: "Mix-and-match tops and bottoms",
    },
    {
      name: "Phone + charger",
      category: "Electronics",
      notes: "EU plug adapter if needed",
    },
    {
      name: "Portable power bank",
      category: "Electronics",
      notes: "For long metro / walking days",
    },
    {
      name: "Toothbrush & toothpaste",
      category: "Toiletries",
      notes: "Travel-sized containers",
    },
    {
      name: "Reusable water bottle",
      category: "Essentials",
      notes: "Fill after security / at hotel",
    },
    {
      name: "Umbrella or compact rain jacket",
      category: "Don't forget",
      notes: "Berlin weather can turn wet quickly",
    },
  ];

  return defs.map((item) => ({
    id: randomUUID(),
    name: item.name,
    category: item.category,
    notes: item.notes,
    packed: false,
  }));
}

/**
 * Hardcoded weather matching WeatherForecastResult / DailyForecast
 * (src/lib/weather.ts) — no Open-Meteo /api call.
 */
function buildMockWeather(destination, startDate, endDate) {
  const templates = [
    { condition: "Clouds", highTemp: 18, lowTemp: 11, rainChance: 0.35 },
    { condition: "Rain", highTemp: 15, lowTemp: 9, rainChance: 0.72 },
    { condition: "Clear", highTemp: 21, lowTemp: 12, rainChance: 0.1 },
    { condition: "Clouds", highTemp: 17, lowTemp: 10, rainChance: 0.4 },
    { condition: "Drizzle", highTemp: 14, lowTemp: 8, rainChance: 0.55 },
  ];

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const forecastHorizon = new Date(today);
  forecastHorizon.setUTCDate(forecastHorizon.getUTCDate() + 15);

  const days = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  let i = 0;
  while (cursor <= end) {
    const t = templates[i % templates.length];
    const projected = cursor > forecastHorizon;
    days.push({
      date: cursor.toISOString().slice(0, 10),
      condition: t.condition,
      highTemp: t.highTemp,
      lowTemp: t.lowTemp,
      rainChance: t.rainChance,
      icon: null,
      projected,
      ...(projected
        ? { message: "Seasonal climate average", source: "climate" }
        : {}),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    i += 1;
  }

  return {
    destination,
    locationName: `${destination}, DE`,
    days,
  };
}

function fail(message, detail) {
  console.error(`\n✖ ${message}`);
  if (detail !== undefined) {
    console.error(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
  }
  process.exit(1);
}

function logStep(n, title) {
  console.log(`\n[${n}] ${title}`);
}

function isoDateOffset(daysFromToday) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

function userClient(accessToken) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Mint a short-lived access token for TEST_USER_ID via Admin API.
 */
async function mintAccessTokenForUser(userId) {
  const admin = adminClient();
  const { data: userData, error: userError } =
    await admin.auth.admin.getUserById(userId);
  if (userError || !userData?.user?.email) {
    throw new Error(
      userError?.message ||
        "Could not load TEST_USER_ID email for session minting."
    );
  }

  const email = userData.user.email;
  console.log(`  Minting session for ${email} via Admin generateLink…`);

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
  if (linkError) {
    throw new Error(`generateLink failed: ${linkError.message}`);
  }

  const tokenHash =
    linkData?.properties?.hashed_token ?? linkData?.hashed_token;
  if (!tokenHash) {
    throw new Error(
      "generateLink did not return hashed_token; set TEST_USER_JWT manually."
    );
  }

  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: otpData, error: otpError } = await anon.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });
  if (otpError || !otpData?.session?.access_token) {
    throw new Error(
      otpError?.message ||
        "verifyOtp failed; paste a browser access_token into TEST_USER_JWT."
    );
  }

  return {
    accessToken: otpData.session.access_token,
    userId: otpData.session.user?.id ?? userId,
  };
}

async function resolveAuth() {
  // Prefer the shared token from create-test-user (--write-env).
  const jwt =
    process.env.TEST_USER_JWT?.trim() ||
    process.env.SUPABASE_ACCESS_TOKEN?.trim() ||
    "";

  if (jwt) {
    const supabase = userClient(jwt);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(jwt);
    if (error || !user) {
      throw new Error(
        error?.message ||
          "TEST_USER_JWT / SUPABASE_ACCESS_TOKEN is invalid. Re-run: node scripts/create-test-user.mjs --write-env"
      );
    }
    console.log(`  Auth mode: TEST_USER_JWT (sub=${user.id})`);
    return { accessToken: jwt, userId: user.id, mode: "jwt" };
  }

  if (SERVICE_ROLE_KEY && TEST_USER_ID) {
    console.log(
      `  Auth mode: service_role + TEST_USER_ID=${TEST_USER_ID} (minting JWT; prefer create-test-user --write-env)`
    );
    const minted = await mintAccessTokenForUser(TEST_USER_ID);
    return {
      accessToken: minted.accessToken,
      userId: minted.userId,
      mode: "service_role",
    };
  }

  throw new Error(
    "Set TEST_USER_JWT via `node scripts/create-test-user.mjs --write-env`, or SUPABASE_SERVICE_ROLE_KEY + TEST_USER_ID."
  );
}

async function createTestTrip(accessToken, userId) {
  const startDate = isoDateOffset(7);
  const endDate = isoDateOffset(9);
  const destination = "Berlin";

  const payload = {
    user_id: userId,
    destination,
    start_date: startDate,
    end_date: endDate,
    trip_type: TRIP_TYPE,
    travelers: 1,
  };

  console.log("  Inserting trip:", payload);

  // Prefer user JWT so RLS insert policy (auth.uid() = user_id) passes.
  // Service role also works if we still have the key and JWT mint failed mid-way —
  // here we always have a user token from resolveAuth.
  const supabase = userClient(accessToken);
  const { data, error } = await supabase
    .from("trips")
    .insert(payload)
    .select("id, destination, start_date, end_date, trip_type, travelers")
    .single();

  if (error || !data) {
    // Fallback: service role insert as TEST_USER_ID when RLS blocks.
    if (SERVICE_ROLE_KEY) {
      console.log("  User insert failed; retrying with service_role…");
      const admin = adminClient();
      const retry = await admin
        .from("trips")
        .insert(payload)
        .select("id, destination, start_date, end_date, trip_type, travelers")
        .single();
      if (retry.error || !retry.data) {
        throw new Error(
          retry.error?.message || error?.message || "Trip insert failed."
        );
      }
      return retry.data;
    }
    throw new Error(error?.message || "Trip insert failed.");
  }

  return data;
}

async function callPackingGenerate(accessToken, tripId) {
  const url = `${BASE_URL}/api/packing/generate`;
  console.log(`  POST ${url}`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tripId }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw Object.assign(new Error(`Packing generate HTTP ${res.status}`), {
      detail: json,
    });
  }
  return json;
}

/**
 * Upsert a predefined packing list into Supabase (no Gemini /api call).
 */
async function upsertMockPackingList(accessToken, tripId) {
  const items = buildMockPackingItems();
  console.log("  --mock-apis: upserting mock packing_lists (no Gemini call)");

  const supabase = userClient(accessToken);
  let { error } = await supabase.from("packing_lists").upsert(
    { trip_id: tripId, items },
    { onConflict: "trip_id" }
  );

  if (error && SERVICE_ROLE_KEY) {
    console.log("  User upsert failed; retrying with service_role…");
    const admin = adminClient();
    const retry = await admin.from("packing_lists").upsert(
      { trip_id: tripId, items },
      { onConflict: "trip_id" }
    );
    error = retry.error;
  }

  if (error) {
    throw Object.assign(new Error(`Mock packing upsert failed: ${error.message}`), {
      detail: error,
    });
  }

  return {
    ok: true,
    tripId,
    itemCount: items.length,
    items,
    mock: true,
  };
}

async function callWeather(destination, startDate, endDate) {
  const qs = new URLSearchParams({ destination, startDate, endDate });
  const url = `${BASE_URL}/api/weather?${qs}`;
  console.log(`  GET ${url}`);
  const res = await fetch(url);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw Object.assign(new Error(`Weather HTTP ${res.status}`), {
      detail: json,
    });
  }
  return json;
}

async function main() {
  console.log("PackWise test-flow");
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  --mock-apis: ${MOCK_APIS ? "yes" : "no"}`);

  if (!SUPABASE_URL || isPlaceholderSecret(SUPABASE_URL)) {
    fail(
      "Missing or placeholder NEXT_PUBLIC_SUPABASE_URL in .env.local"
    );
  }
  if (!ANON_KEY || isPlaceholderSecret(ANON_KEY)) {
    fail(
      "Missing or placeholder NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    );
  }

  // Weather + city search use Open-Meteo (no API key).
  if (MOCK_APIS) {
    console.log("  --mock-apis: skipping live /api/weather");
  }

  logStep(1, "Resolve auth");
  let auth;
  try {
    auth = await resolveAuth();
  } catch (err) {
    fail("Auth failed", err instanceof Error ? err.message : err);
  }

  logStep(2, "Create test trip (Berlin, city break)");
  let trip;
  try {
    trip = await createTestTrip(auth.accessToken, auth.userId);
    console.log("  Created trip id:", trip.id);
  } catch (err) {
    fail("Trip create failed", err instanceof Error ? err.message : err);
  }

  if (MOCK_APIS) {
    logStep(3, "Mock packing list (upsert packing_lists, skip Gemini)");
    try {
      const packing = await upsertMockPackingList(auth.accessToken, trip.id);
      console.log(`  OK — ${packing.itemCount} mock items upserted`);
      console.log("  Mock packing list:", JSON.stringify(packing.items, null, 2));
    } catch (err) {
      fail(
        err instanceof Error ? err.message : "Mock packing upsert failed",
        err?.detail ?? err
      );
    }
  } else {
    logStep(3, "Generate packing list via POST /api/packing/generate");
    try {
      const packing = await callPackingGenerate(auth.accessToken, trip.id);
      console.log(
        `  OK — ${packing.itemCount ?? packing.items?.length ?? "?"} items`
      );
      if (Array.isArray(packing.items)) {
        console.log(
          "  Sample:",
          packing.items
            .slice(0, 3)
            .map((i) => i.name)
            .join(", ")
        );
      }
    } catch (err) {
      fail(
        err instanceof Error ? err.message : "Packing generate failed",
        err?.detail ?? err
      );
    }
  }

  if (MOCK_APIS) {
    logStep(4, "Mock weather (skip Open-Meteo /api/weather)");
    const weather = buildMockWeather(
      trip.destination,
      trip.start_date,
      trip.end_date
    );
    console.log("  --mock-apis: using hardcoded weather response");
    console.log(
      "  OK — location:",
      weather.locationName ?? weather.location ?? "(unknown)"
    );
    console.log("  Days:", weather.days.length);
    console.log("  Mock weather:", JSON.stringify(weather, null, 2));
  } else {
    logStep(4, "Fetch weather via GET /api/weather");
    try {
      const weather = await callWeather(
        trip.destination,
        trip.start_date,
        trip.end_date
      );
      console.log(
        "  OK — location:",
        weather.locationName ?? weather.location ?? "(unknown)"
      );
      console.log(
        "  Days:",
        Array.isArray(weather.days) ? weather.days.length : 0
      );
      console.log("  Result:", JSON.stringify(weather, null, 2));
    } catch (err) {
      fail(
        err instanceof Error ? err.message : "Weather request failed",
        err?.detail ?? err
      );
    }
  }

  console.log("\n✔ test-flow completed successfully");
  console.log(`  Trip: ${trip.id} (${trip.destination}, ${trip.start_date} → ${trip.end_date})`);
}

main().catch((err) => {
  fail("Unexpected error", err instanceof Error ? err.stack : err);
});
