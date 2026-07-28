import { test as setup, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { injectSupabaseAuthCookies } from "./supabase-session";
import { isPlaceholderSecret } from "../src/lib/env";

/**
 * Auth bootstrap for Playwright.
 * Prefer TEST_USER_JWT (+ optional TEST_USER_REFRESH_TOKEN) from `.env.local`
 * (written by `node scripts/create-test-user.mjs --write-env`).
 * Falls back to GET /api/test/login when no JWT is set.
 */
const authDir = path.join(__dirname, ".auth");
const authFile = path.join(authDir, "user.json");

function hasJwt(): boolean {
  return !isPlaceholderSecret(process.env.TEST_USER_JWT);
}

function hasTestLoginFallback(): boolean {
  const hasSupabase =
    !isPlaceholderSecret(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    !isPlaceholderSecret(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
    !isPlaceholderSecret(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasUser =
    !!process.env.E2E_TEST_USER_EMAIL?.trim() ||
    !isPlaceholderSecret(process.env.E2E_TEST_USER_ID) ||
    !isPlaceholderSecret(process.env.TEST_USER_ID);
  return hasSupabase && hasUser;
}

setup("authenticate", async ({ page, baseURL }) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const jwt = process.env.TEST_USER_JWT?.trim();
  const refresh = process.env.TEST_USER_REFRESH_TOKEN?.trim();

  setup.skip(
    !hasJwt() && !hasTestLoginFallback(),
    "E2E auth needs a real TEST_USER_JWT (from create-test-user --write-env) or real SUPABASE_* + E2E_TEST_USER_* for /api/test/login — placeholders (YOUR_*, your-*) are rejected"
  );

  fs.mkdirSync(authDir, { recursive: true });

  // Keep setup navigation on the same canonical origin as playwright.config (127.0.0.1).
  const origin = baseURL ?? "http://127.0.0.1:3333";

  if (hasJwt() && supabaseUrl && anonKey && !isPlaceholderSecret(supabaseUrl) && !isPlaceholderSecret(anonKey)) {
    await injectSupabaseAuthCookies(page, {
      accessToken: jwt!,
      refreshToken: refresh,
      supabaseUrl,
      anonKey,
      baseURL: origin,
    });
    await page.goto(`${origin}/dashboard`);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  } else {
    // Fallback: service-role magic-link mint via test route (Set-Cookie on this origin).
    await page.goto(`${origin}/api/test/login`);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  }

  expect(new URL(page.url()).hostname).toBe(new URL(origin).hostname);

  await page.context().storageState({ path: authFile });
});