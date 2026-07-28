/**
 * Create (or look up) a PackWise test auth user and mint a session JWT.
 *
 * Run:
 *   node scripts/create-test-user.mjs
 *   node scripts/create-test-user.mjs --write-env
 *
 * Requires in `.env.local`:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional overrides:
 *   E2E_TEST_USER_EMAIL (default: test@packwise.com)
 *   E2E_TEST_USER_PASSWORD (default: test123)
 *
 * With `--write-env`, upserts these keys in `.env.local` (other lines untouched):
 *   TEST_USER_JWT, TEST_USER_REFRESH_TOKEN, TEST_USER_ID,
 *   E2E_TEST_USER_EMAIL, E2E_TEST_USER_ID
 *
 * Do not commit secrets.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { isPlaceholderSecret } from "./lib/env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env.local");

dotenv.config({ path: envPath });

const WRITE_ENV = process.argv.includes("--write-env");
const PRINT_TOKEN = process.argv.includes("--print-token");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const EMAIL =
  process.env.E2E_TEST_USER_EMAIL?.trim() || "test@packwise.com";
const PASSWORD =
  process.env.E2E_TEST_USER_PASSWORD?.trim() || "test123";

/** Keys managed by this script when --write-env is set. */
const ENV_KEYS = [
  "TEST_USER_JWT",
  "TEST_USER_REFRESH_TOKEN",
  "TEST_USER_ID",
  "E2E_TEST_USER_EMAIL",
  "E2E_TEST_USER_ID",
];

function fail(message, detail) {
  console.error(`\n✖ ${message}`);
  if (detail !== undefined) {
    console.error(
      typeof detail === "string" ? detail : JSON.stringify(detail, null, 2)
    );
  }
  process.exit(1);
}

function redactToken(token) {
  if (!token || token.length < 20) return "(missing)";
  return `${token.slice(0, 12)}…${token.slice(-6)} (${token.length} chars)`;
}

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function anonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function isAlreadyRegisteredError(error) {
  const msg = (error?.message || "").toLowerCase();
  return (
    msg.includes("already been registered") ||
    msg.includes("already registered") ||
    msg.includes("user already exists") ||
    error?.status === 422 ||
    error?.code === "email_exists"
  );
}

/**
 * Find an auth user by email via Admin listUsers (paginated).
 */
async function findUserByEmail(admin, email) {
  const target = email.toLowerCase();
  const perPage = 200;
  let page = 1;

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`listUsers failed: ${error.message}`);
    }

    const users = data?.users ?? [];
    const match = users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match;

    if (users.length < perPage) return null;
    page += 1;
  }
}

async function ensureUser(admin) {
  console.log(`Ensuring user ${EMAIL}…`);
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });

  if (!error && data?.user?.id) {
    console.log("  Created new user.");
    return data.user;
  }

  if (error && isAlreadyRegisteredError(error)) {
    console.log("  User already exists; looking up by email…");
    const existing = await findUserByEmail(admin, EMAIL);
    if (!existing?.id) {
      fail(
        `User appears registered but could not be found by email: ${EMAIL}`,
        error.message
      );
    }
    // Ensure password matches defaults used by tests (idempotent update).
    const { data: updated, error: updateError } =
      await admin.auth.admin.updateUserById(existing.id, {
        password: PASSWORD,
        email_confirm: true,
      });
    if (updateError) {
      console.warn(
        `  Warning: could not refresh password/confirm: ${updateError.message}`
      );
      return existing;
    }
    console.log("  Password / email_confirm refreshed.");
    return updated?.user ?? existing;
  }

  fail("createUser failed", error?.message || error);
}

/**
 * Prefer password sign-in; fall back to Admin magic-link + verifyOtp.
 */
async function mintSession(admin) {
  console.log("Minting session…");

  const anon = anonClient();
  const passwordAttempt = await anon.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });

  if (passwordAttempt.data?.session?.access_token) {
    console.log("  Session via signInWithPassword.");
    return passwordAttempt.data.session;
  }

  console.warn(
    `  signInWithPassword failed (${passwordAttempt.error?.message || "no session"}); trying Admin generateLink…`
  );

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: EMAIL,
    });
  if (linkError) {
    fail(
      "generateLink failed — could not mint ACCESS_TOKEN",
      linkError.message
    );
  }

  const tokenHash =
    linkData?.properties?.hashed_token ?? linkData?.hashed_token;
  if (!tokenHash) {
    fail(
      "generateLink did not return hashed_token — could not mint ACCESS_TOKEN"
    );
  }

  const otpAttempt = await anon.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });

  if (otpAttempt.error || !otpAttempt.data?.session?.access_token) {
    fail(
      "verifyOtp failed — could not mint ACCESS_TOKEN",
      otpAttempt.error?.message || "No session returned"
    );
  }

  console.log("  Session via Admin generateLink + verifyOtp.");
  return otpAttempt.data.session;
}

/**
 * Upsert KEY=value lines in `.env.local` without clobbering other secrets.
 * Replaces an existing line for each key (quoted or unquoted); appends if missing.
 */
function upsertEnvLocal(updates) {
  let content = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf8")
    : "";

  // Normalize to \n for editing; restore trailing newline at end.
  const hadTrailingNewline = content.length === 0 || content.endsWith("\n");
  const lines = content.length ? content.replace(/\r\n/g, "\n").split("\n") : [];

  // Drop trailing empty line from split so we can re-add cleanly.
  if (lines.length && lines[lines.length - 1] === "") {
    lines.pop();
  }

  const keysUpdated = new Set();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || line.trimStart().startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match) continue;
    const key = match[1];
    if (key in updates) {
      lines[i] = `${key}=${updates[key]}`;
      keysUpdated.add(key);
    }
  }

  const missing = Object.keys(updates).filter((k) => !keysUpdated.has(k));
  if (missing.length) {
    if (lines.length && lines[lines.length - 1] !== "") {
      lines.push("");
    }
    lines.push("# Test auth (from scripts/create-test-user.mjs — do not commit)");
    for (const key of missing) {
      lines.push(`${key}=${updates[key]}`);
    }
  }

  let next = lines.join("\n");
  if (hadTrailingNewline || next.length) next += "\n";
  fs.writeFileSync(envPath, next, "utf8");
}

function looksLikePlaceholder(value) {
  return isPlaceholderSecret(value);
}

async function main() {
  if (!SUPABASE_URL) {
    fail("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
  }
  if (looksLikePlaceholder(SUPABASE_URL)) {
    fail(
      "NEXT_PUBLIC_SUPABASE_URL still looks like a placeholder (your-project-ref). Set your real Project URL from Supabase → Settings → API."
    );
  }
  if (!SERVICE_ROLE_KEY) {
    fail("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  if (looksLikePlaceholder(SERVICE_ROLE_KEY) || SERVICE_ROLE_KEY.length < 40) {
    fail(
      "SUPABASE_SERVICE_ROLE_KEY looks missing or placeholder. Paste the service_role secret from Supabase → Settings → API."
    );
  }
  if (!ANON_KEY) {
    fail(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (needed for session minting)"
    );
  }
  if (looksLikePlaceholder(ANON_KEY)) {
    fail(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY still looks like a placeholder. Set the anon key from Supabase → Settings → API."
    );
  }

  const admin = adminClient();
  const user = await ensureUser(admin);
  const session = await mintSession(admin);

  const accessToken = session.access_token;
  const refreshToken = session.refresh_token || "";

  if (WRITE_ENV) {
    upsertEnvLocal({
      TEST_USER_JWT: accessToken,
      TEST_USER_REFRESH_TOKEN: refreshToken,
      TEST_USER_ID: user.id,
      E2E_TEST_USER_EMAIL: EMAIL,
      E2E_TEST_USER_ID: user.id,
    });
    console.log(`\n✔ Updated ${path.relative(root, envPath)} keys:`);
    for (const key of ENV_KEYS) {
      console.log(`  ${key}`);
    }
  }

  console.log("\n--- Test user ready ---");
  console.log(`EMAIL=${EMAIL}`);
  console.log(`USER_ID=${user.id}`);
  if (PRINT_TOKEN || !WRITE_ENV) {
    console.log(`ACCESS_TOKEN=${accessToken}`);
    if (refreshToken) {
      console.log(`REFRESH_TOKEN=${refreshToken}`);
    }
  } else {
    console.log(`ACCESS_TOKEN=${redactToken(accessToken)}`);
    if (refreshToken) {
      console.log(`REFRESH_TOKEN=${redactToken(refreshToken)}`);
    }
    console.log("(full tokens written to .env.local; pass --print-token to echo)");
  }

  if (!WRITE_ENV) {
    console.log("\nSuggested .env.local entries (or re-run with --write-env):");
    console.log(`  E2E_TEST_USER_EMAIL=${EMAIL}`);
    console.log(`  TEST_USER_ID=${user.id}`);
    console.log(`  E2E_TEST_USER_ID=${user.id}`);
    console.log("  TEST_USER_JWT=<ACCESS_TOKEN above>");
    console.log("  TEST_USER_REFRESH_TOKEN=<REFRESH_TOKEN above>");
  }

  console.log("");
}

main().catch((err) => {
  fail(err?.message || String(err), err?.stack);
});
