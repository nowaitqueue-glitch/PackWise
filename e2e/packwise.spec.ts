import { test, expect, type Locator, type Page } from "@playwright/test";
import { isPlaceholderSecret } from "../src/lib/env";

/** Local calendar date offset from today at midnight. */
function dateOffset(daysFromToday: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  return d;
}

/**
 * DayPicker (react-day-picker) aria-labels use date-fns `PPPP`
 * e.g. "Wednesday, July 29th, 2026" (plus optional "Today, " / ", selected").
 */
function dayButtonNamePattern(daysFromToday: number): RegExp {
  const d = dateOffset(daysFromToday);
  const month = d.toLocaleDateString("en-US", { month: "long" });
  const day = d.getDate();
  const year = d.getFullYear();
  return new RegExp(`${month} ${day}(?:st|nd|rd|th), ${year}`);
}

/** Matches `formatRangeLabel` in new-trip-form (short month + day, en dash). */
function expectedRangeLabel(startOffset: number, endOffset: number): RegExp {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const fromLabel = dateOffset(startOffset).toLocaleDateString(undefined, opts);
  const toLabel = dateOffset(endOffset).toLocaleDateString(undefined, opts);
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escape(fromLabel)}\\s*[–-]\\s*${escape(toLabel)}`);
}

async function clickCalendarDay(sheet: Locator, daysFromToday: number) {
  const d = dateOffset(daysFromToday);
  // Prefer the in-month grid so outside days in the adjacent month aren't matched.
  const monthName = d.toLocaleDateString("en-US", { month: "long" });
  await sheet
    .getByRole("grid", { name: monthName })
    .getByRole("button", { name: dayButtonNamePattern(daysFromToday) })
    .click();
}

async function selectTripDateRange(
  page: Page,
  startOffset: number,
  endOffset: number
) {
  const trigger = page.getByTestId("date-range-trigger");
  await expect(trigger).toContainText("Select dates");
  await trigger.click();

  // Scope to the date sheet — cookie consent also uses role="dialog".
  const sheet = page.getByRole("dialog").filter({
    has: page.getByRole("heading", { name: "Select Trip Dates" }),
  });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("grid").first()).toBeVisible();

  await clickCalendarDay(sheet, startOffset);
  await clickCalendarDay(sheet, endOffset);

  await page.getByTestId("date-range-done").click();
  await expect(sheet).toBeHidden();

  await expect(trigger).not.toContainText("Select dates");
  await expect(trigger).toContainText(expectedRangeLabel(startOffset, endOffset));
}

function hasE2ECredentials(): boolean {
  if (!isPlaceholderSecret(process.env.TEST_USER_JWT)) return true;

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

/** Cookie banner (z-[60]) can cover Create trip — dismiss if present. */
async function dismissCookieConsentIfVisible(
  page: Page,
  timeoutMs = 5_000
) {
  const accept = page.getByRole("button", {
    name: "Accept analytics cookies",
  });
  try {
    await accept.waitFor({ state: "visible", timeout: timeoutMs });
  } catch {
    return;
  }
  await accept.click();
  await expect(accept).toBeHidden({ timeout: 5_000 });
}

test.describe("PackWise packing flow", () => {
  test.beforeEach(() => {
    test.skip(
      !hasE2ECredentials(),
      "E2E needs a real TEST_USER_JWT (run: node scripts/create-test-user.mjs --write-env) or real SUPABASE_* + E2E_TEST_USER_EMAIL — placeholders (YOUR_*, your-*) are rejected"
    );
  });

  test("create Paris trip, packing list + progress", async ({ page, baseURL }) => {
    // Session comes from e2e/auth.setup.ts (TEST_USER_JWT cookies or /api/test/login).
    // Absolute origin keeps host aligned with storageState cookies (127.0.0.1).
    const origin = baseURL ?? "http://127.0.0.1:3333";
    await page.goto(`${origin}/dashboard`);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    expect(new URL(page.url()).hostname).toBe(new URL(origin).hostname);
    await dismissCookieConsentIfVisible(page);

    await page.goto("/dashboard/new-trip");
    await expect(page.getByTestId("new-trip-form")).toBeVisible();
    // Safety net if consent wasn't set yet (banner mounts after useEffect).
    await dismissCookieConsentIfVisible(page, 2_000);

    // Country is optional; city stays enabled for global or country-scoped search.
    await page.getByTestId("country-combobox").click();
    await page.getByTestId("country-combobox-search").fill("France");
    await page.getByTestId("country-option-FR").click();
    await expect(page.getByTestId("country-combobox")).toContainText(/France/i);

    // City Combobox (Command + Popover) — free-text commit on close.
    await page.getByTestId("city-combobox").click();
    await page.getByTestId("city-combobox-search").fill("Paris");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("city-combobox")).toContainText(/Paris/i);

    // Date range bottom sheet (DayPicker) — future dates so past days stay disabled.
    await selectTripDateRange(page, 7, 10);

    // Radix Select: open via labeled combobox, wait for listbox, then choose option.
    const tripType = page.getByRole("combobox", { name: "Trip type" });
    await tripType.click();
    await expect(page.getByRole("listbox")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("option", { name: "City Break" }).click();
    await expect(tripType).toHaveText(/City Break/i);

    await page.getByTestId("travelers-input").fill("1");
    await page.getByTestId("create-trip-submit").click();

    // Create redirects immediately; packing list auto-generates on trip detail.
    await expect(page).toHaveURL(/\/dashboard\/trips\/[^/]+/, {
      timeout: 30_000,
    });

    const tripUrl = page.url();
    const tripId = tripUrl.split("/").pop()?.split("?")[0]!;

    // Pending UI while client calls regeneratePackingList, then the real list.
    // Next can leave a hidden duplicate of the trip segment in the DOM during
    // the server-action redirect, so scope to .first() for strict mode.
    const generating = page.getByTestId("packing-list-generating").first();
    const packingList = page.getByTestId("packing-list").first();
    await expect(generating.or(packingList)).toBeVisible({
      timeout: 15_000,
    });
    await expect(packingList).toBeVisible({
      timeout: 60_000,
    });

    // Prefer template-generated items; if empty, seed via test API.
    const itemLocator = packingList.getByTestId("packing-item");
    const itemCount = await itemLocator.count();
    if (itemCount === 0) {
      const seed = await page.request.post("/api/test/seed-packing", {
        data: { tripId },
      });
      expect(
        seed.ok(),
        `seed-packing failed: ${seed.status()} ${await seed.text()}`
      ).toBeTruthy();
      await page.reload();
      await expect(packingList).toBeVisible();
    }

    await expect(itemLocator.first()).toBeVisible({ timeout: 60_000 });
    await expect(itemLocator).not.toHaveCount(0);

    const progressText = packingList.getByTestId("packing-progress-text");
    await expect(progressText).toBeVisible();
    const before = (await progressText.textContent()) ?? "";
    expect(before).toMatch(/0\/\d+ packed \(0%\)/);

    const firstCheckbox = packingList.getByTestId("packing-item-checkbox").first();
    await firstCheckbox.click();

    await expect(progressText).not.toHaveText(before, { timeout: 15_000 });
    await expect(progressText).toHaveText(/1\/\d+ packed \(\d+%\)/);

    const progressBar = packingList.getByTestId("packing-progress-bar");
    await expect(progressBar).toHaveAttribute("aria-valuenow", /[1-9]\d*/);
  });
});
