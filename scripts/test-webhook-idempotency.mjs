/**
 * Local idempotency check for Stripe webhook claim + scan_pack credits (audit S3).
 *
 * Mirrors src/app/api/stripe/webhook/route.ts:
 *   claimWebhookEvent -> unique stripe_event_id; 23505 = already processed
 *   then addScanPackCredits only when claimed
 *
 * Usage: node scripts/test-webhook-idempotency.mjs
 *
 * Requires .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TEST_USER_ID
 * Requires migration webhook_events applied (npx supabase db push --linked)
 *
 * Stripe CLI / STRIPE_* not required. Tests the DB claim path the webhook uses.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SCAN_PACK_CREDIT_AMOUNT = 10;

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

/** Same key rule as stripeWebhookIdempotencyKey in the webhook route. */
function stripeWebhookIdempotencyKey(event) {
  const fromRequest =
    typeof event?.request?.idempotency_key === "string"
      ? event.request.idempotency_key.trim()
      : "";
  if (fromRequest) return fromRequest;
  return event.id;
}

async function claimWebhookEvent(admin, stripeEventId) {
  const { error } = await admin.from("webhook_events").insert({
    stripe_event_id: stripeEventId,
  });
  if (!error) return "claimed";
  if (error.code === "23505") return "duplicate";
  throw new Error(`webhook_events insert failed: ${error.message}`);
}

async function addScanPackCredits(admin, userId) {
  const { data: row, error: selectError } = await admin
    .from("profiles")
    .select("scans_remaining")
    .eq("id", userId)
    .maybeSingle();
  if (selectError) {
    throw new Error(`scan pack select failed: ${selectError.message}`);
  }
  const current =
    typeof row?.scans_remaining === "number" ? row.scans_remaining : 0;
  const next = current + SCAN_PACK_CREDIT_AMOUNT;
  const { error } = await admin.from("profiles").upsert(
    {
      id: userId,
      scans_remaining: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) {
    throw new Error(`scan pack credit failed: ${error.message}`);
  }
  return next;
}

async function readScans(admin, userId) {
  const { data, error } = await admin
    .from("profiles")
    .select("scans_remaining")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return typeof data?.scans_remaining === "number" ? data.scans_remaining : 0;
}

const env = loadEnv(resolve(process.cwd(), ".env.local"));
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const userId = env.TEST_USER_ID?.trim();
const hasStripe = Boolean(env.STRIPE_SECRET_KEY?.trim());

if (!url || !serviceRole || !userId) {
  console.error(
    "FAIL: need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TEST_USER_ID"
  );
  process.exit(1);
}

if (!hasStripe) {
  console.log(
    "NOTE: STRIPE_* unset / Stripe CLI not used — testing claim + credit path via service role."
  );
}

const admin = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

{
  const keyFromRequest = stripeWebhookIdempotencyKey({
    id: "evt_fallback",
    request: { idempotency_key: "idem_abc" },
  });
  const keyFromId = stripeWebhookIdempotencyKey({
    id: "evt_fallback",
    request: { idempotency_key: null },
  });
  if (keyFromRequest !== "idem_abc" || keyFromId !== "evt_fallback") {
    console.error("FAIL: idempotency key selection", {
      keyFromRequest,
      keyFromId,
    });
    process.exit(1);
  }
  console.log("PASS: key prefers request.idempotency_key, else event.id");
}

const fakeEvent = {
  id: `evt_idempotency_test_${Date.now()}`,
  request: { idempotency_key: null },
};
const key = stripeWebhookIdempotencyKey(fakeEvent);
console.log(`idempotency key (fallback event.id): ${key}`);

const before = await readScans(admin, userId);
console.log(`scans_remaining before: ${before}`);

try {
  const firstClaim = await claimWebhookEvent(admin, key);
  if (firstClaim !== "claimed") {
    throw new Error(`expected first claim=claimed, got ${firstClaim}`);
  }
  await addScanPackCredits(admin, userId);
  const afterFirst = await readScans(admin, userId);

  const secondClaim = await claimWebhookEvent(admin, key);
  if (secondClaim !== "duplicate") {
    throw new Error(`expected second claim=duplicate, got ${secondClaim}`);
  }
  const afterSecond = await readScans(admin, userId);

  const expected = before + SCAN_PACK_CREDIT_AMOUNT;
  if (afterFirst !== expected) {
    throw new Error(
      `after first credit expected ${expected}, got ${afterFirst}`
    );
  }
  if (afterSecond !== afterFirst) {
    throw new Error(
      `duplicate must not change scans: was ${afterFirst}, now ${afterSecond}`
    );
  }

  const race = await Promise.all([
    claimWebhookEvent(admin, key),
    claimWebhookEvent(admin, key),
  ]);
  if (!race.every((r) => r === "duplicate")) {
    throw new Error(`race claims should both be duplicate, got ${race}`);
  }

  console.log(
    "PASS: first claim credited once; duplicate claim is no-op (200 path)."
  );
  console.log(`  firstClaim=${firstClaim} secondClaim=${secondClaim}`);
  console.log(
    `  scans: ${before} -> ${afterFirst} -> ${afterSecond} (unchanged)`
  );
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    /relation .*webhook_events.* does not exist|Could not find the table/i.test(
      msg
    )
  ) {
    console.error(
      "FAIL: webhook_events table missing — apply migration:\n  npx supabase db push --linked"
    );
  } else {
    console.error(`FAIL: ${msg}`);
  }
  process.exitCode = 1;
} finally {
  await admin
    .from("profiles")
    .update({
      scans_remaining: before,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  await admin.from("webhook_events").delete().eq("stripe_event_id", key);
}
