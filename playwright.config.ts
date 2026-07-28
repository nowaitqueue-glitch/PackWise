import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import dotenv from "dotenv";

// Load .env.local so webServer / tests see Supabase + e2e credentials locally.
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

/**
 * Dedicated e2e port avoids clashing with a manual `npm run dev` on :3000.
 * Always use 127.0.0.1 (never localhost): on Windows `localhost` can resolve to
 * ::1 while Next binds IPv4, and auth cookies are host-specific — mixing
 * localhost vs 127.0.0.1 drops the session between setup and packing tests.
 */
const port = process.env.PLAYWRIGHT_PORT ?? "3333";
const E2E_HOST = "127.0.0.1";

function canonicalBaseURL(raw: string | undefined): string {
  if (!raw?.trim()) return `http://${E2E_HOST}:${port}`;
  try {
    const url = new URL(raw.trim());
    url.hostname = E2E_HOST;
    if (!url.port) url.port = port;
    return url.origin;
  } catch {
    return `http://${E2E_HOST}:${port}`;
  }
}

const baseURL = canonicalBaseURL(process.env.PLAYWRIGHT_BASE_URL);

const authFile = path.join(__dirname, "e2e", ".auth", "user.json");

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 180_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        baseURL,
        storageState: authFile,
      },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
  ],
  webServer: {
    command: `npx next dev --hostname ${E2E_HOST} --port ${port}`,
    url: baseURL,
    // Reuse locally; baseURL is always canonicalized to 127.0.0.1 so cookies match.
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      ENABLE_TEST_LOGIN: "true",
    },
  },
});
