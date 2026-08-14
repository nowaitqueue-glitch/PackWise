import { test, expect, type Locator, type Page } from "@playwright/test";
import { isPlaceholderSecret } from "../src/lib/env";

/** Local calendar date offset from today at midnight. */
function dateOffset(daysFromToday: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  return d;
}

function dayButtonNamePattern(daysFromToday: number): RegExp {
  const d = dateOffset(daysFromToday);
  const month = d.toLocaleDateString("en-US", { month: "long" });
  const day = d.getDate();
  const year = d.getFullYear();
  return new RegExp(`${month} ${day}(?:st|nd|rd|th), ${year}`);
}

function expectedRangeLabel(startOffset: number, endOffset: number): RegExp {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const fromLabel = dateOffset(startOffset).toLocaleDateString(undefined, opts);
  const toLabel = dateOffset(endOffset).toLocaleDateString(undefined, opts);
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escape(fromLabel)}\\s*[–-]\\s*${escape(toLabel)}`);
}

async function clickCalendarDay(sheet: Locator, daysFromToday: number) {
  const d = dateOffset(daysFromToday);
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

async function ensurePackingListReady(page: Page, tripId: string) {
  const generating = page.getByTestId("packing-list-generating").first();
  const packingList = page.getByTestId("packing-list").first();
  await expect(generating.or(packingList)).toBeVisible({ timeout: 15_000 });
  await expect(packingList).toBeVisible({ timeout: 60_000 });

  const itemLocator = packingList.getByTestId("packing-item");
  if ((await itemLocator.count()) === 0) {
    const seed = await page.request.post("/api/test/seed-packing", {
      data: { tripId },
    });
    expect(
      seed.ok(),
      `seed-packing failed: ${seed.status()} ${await seed.text()}`
    ).toBeTruthy();
    await page.reload();
    await expect(packingList).toBeVisible({ timeout: 60_000 });
  }

  await expect(itemLocator.first()).toBeVisible({ timeout: 60_000 });
  return packingList;
}

async function createAuthTripWithPacking(page: Page, baseURL?: string) {
  const origin = baseURL ?? "http://127.0.0.1:3333";
  await page.goto(`${origin}/dashboard`);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  await dismissCookieConsentIfVisible(page);

  await page.goto("/dashboard/new-trip");
  await expect(page.getByTestId("new-trip-form")).toBeVisible();
  await dismissCookieConsentIfVisible(page, 2_000);

  await page.getByTestId("country-combobox").click();
  await page.getByTestId("country-combobox-search").fill("France");
  await page.getByTestId("country-option-FR").click();

  await page.getByTestId("city-combobox").click();
  await page.getByTestId("city-combobox-search").fill("Lyon");
  await page.keyboard.press("Escape");

  await selectTripDateRange(page, 14, 17);

  const tripType = page.getByRole("combobox", { name: "Trip type" });
  await tripType.click();
  await expect(page.getByRole("listbox")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("option", { name: "City Break" }).click();

  await page.getByTestId("travelers-input").fill("1");
  await page.getByTestId("create-trip-submit").click();

  await expect(page).toHaveURL(/\/dashboard\/trips\/[^/]+/, {
    timeout: 30_000,
  });

  const tripUrl = page.url();
  const tripId = tripUrl.split("/").pop()?.split("?")[0]!;
  const packingList = await ensurePackingListReady(page, tripId);
  return { packingList, tripId };
}

test.describe("Packing delete / undo / batch (auth)", () => {
  test.beforeEach(() => {
    test.skip(
      !hasE2ECredentials(),
      "E2E needs a real TEST_USER_JWT (run: node scripts/create-test-user.mjs --write-env) or real SUPABASE_* + E2E_TEST_USER_EMAIL"
    );
  });

  test("single item delete then Undo", async ({ page, baseURL }) => {
    const { packingList } = await createAuthTripWithPacking(page, baseURL);
    const items = packingList.getByTestId("packing-item");
    const beforeCount = await items.count();
    expect(beforeCount).toBeGreaterThan(0);

    const firstName =
      (await items.first().locator("label").first().innerText()).split("\n")[0] ??
      "";

    await items.first().getByTestId("packing-item-remove").click();
    await expect(page.getByTestId("pill-banner-action")).toBeVisible({
      timeout: 10_000,
    });
    await expect(items).toHaveCount(beforeCount - 1, { timeout: 10_000 });

    await page.getByTestId("pill-banner-action").click();
    await expect(items).toHaveCount(beforeCount, { timeout: 15_000 });
    if (firstName.trim()) {
      await expect(packingList).toContainText(firstName.trim().slice(0, 24));
    }
  });

  test("batch delete removes selected items", async ({ page, baseURL }) => {
    const { packingList } = await createAuthTripWithPacking(page, baseURL);
    const items = packingList.getByTestId("packing-item");
    const beforeCount = await items.count();
    expect(beforeCount).toBeGreaterThanOrEqual(2);

    await packingList.getByTestId("packing-select-toggle").click();
    await items.nth(0).getByTestId("packing-item-select").click();
    await items.nth(1).getByTestId("packing-item-select").click();

    const batchBar = page.getByTestId("packing-batch-bar");
    await expect(batchBar).toBeVisible({ timeout: 10_000 });
    await batchBar.getByTestId("packing-batch-delete").click();
    await page.getByTestId("packing-batch-delete-confirm").click();

    await expect(items).toHaveCount(beforeCount - 2, { timeout: 20_000 });
    await expect(page.getByText(/items removed|Item removed/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("Packing delete / undo / batch (guest)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("guest single delete, Undo, and batch delete", async ({
    page,
    baseURL,
  }) => {
    const origin = baseURL ?? "http://127.0.0.1:3333";
    await page.goto(`${origin}/dashboard/guest`);
    await dismissCookieConsentIfVisible(page);

    const demo = page.getByRole("button", { name: /demo trip/i });
    await expect(demo).toBeVisible({ timeout: 15_000 });
    await demo.click();

    const packingList = page.getByTestId("guest-packing-list");
    await expect(packingList).toBeVisible({ timeout: 60_000 });

    const items = packingList.getByTestId("packing-item");
    await expect(items.first()).toBeVisible({ timeout: 60_000 });
    const beforeCount = await items.count();
    expect(beforeCount).toBeGreaterThanOrEqual(2);

    await items.first().getByTestId("packing-item-remove").click();
    await expect(page.getByTestId("pill-banner-action")).toBeVisible({
      timeout: 10_000,
    });
    await expect(items).toHaveCount(beforeCount - 1, { timeout: 10_000 });

    await page.getByTestId("pill-banner-action").click();
    await expect(items).toHaveCount(beforeCount, { timeout: 10_000 });

    await packingList.getByTestId("packing-select-toggle").click();
    await items.nth(0).getByTestId("packing-item-select").click();
    await items.nth(1).getByTestId("packing-item-select").click();
    const batchBar = page.getByTestId("packing-batch-bar");
    await expect(batchBar).toBeVisible({ timeout: 10_000 });
    await batchBar.getByTestId("packing-batch-delete").click();
    await page.getByTestId("packing-batch-delete-confirm").click();
    await expect(items).toHaveCount(beforeCount - 2, { timeout: 15_000 });
  });
});