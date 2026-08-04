import { test, expect, type Page } from "@playwright/test";

/** Brand logo link: accessible name from img alt "PackWise home". */
function brandLogoLink(page: Page) {
  return page.getByRole("link", { name: "PackWise home" });
}

test.describe("BrandLogo context-aware home links", () => {
  test("landing logo links to /", async ({ page, baseURL }) => {
    const origin = baseURL ?? "http://127.0.0.1:3333";
    await page.goto(`${origin}/`);
    await expect(brandLogoLink(page)).toHaveAttribute("href", "/");
    await brandLogoLink(page).click();
    await expect(page).toHaveURL(/\/(?:\?.*)?$/);
  });

  test("login logo links to /", async ({ browser, baseURL }) => {
    // Fresh context so storageState auth does not bounce /login → dashboard.
    const origin = baseURL ?? "http://127.0.0.1:3333";
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    try {
      await page.goto(`${origin}/login`);
      await expect(brandLogoLink(page)).toHaveAttribute("href", "/");
      await brandLogoLink(page).click();
      await expect(page).toHaveURL(new RegExp(`^${origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?$`));
    } finally {
      await context.close();
    }
  });

  test("privacy and terms logos link to /", async ({ browser, baseURL }) => {
    const origin = baseURL ?? "http://127.0.0.1:3333";
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    try {
      for (const path of ["/privacy", "/terms"] as const) {
        await page.goto(`${origin}${path}`);
        await expect(brandLogoLink(page)).toHaveAttribute("href", "/");
        await brandLogoLink(page).click();
        await expect(page).toHaveURL(
          new RegExp(`^${origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?$`)
        );
      }
    } finally {
      await context.close();
    }
  });

  test("dashboard logo links to /dashboard", async ({ page, baseURL }) => {
    const origin = baseURL ?? "http://127.0.0.1:3333";
    await page.goto(`${origin}/dashboard`);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    await expect(brandLogoLink(page)).toHaveAttribute("href", "/dashboard");
    await page.goto(`${origin}/dashboard/settings`);
    await expect(page).toHaveURL(/\/dashboard\/settings/);
    await brandLogoLink(page).click();
    await expect(page).toHaveURL(/\/dashboard\/?$/);
  });

  test("guest header logo links to /dashboard/guest", async ({
    browser,
    baseURL,
  }) => {
    const origin = baseURL ?? "http://127.0.0.1:3333";
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    try {
      await page.goto(`${origin}/guest`);
      await expect(brandLogoLink(page)).toHaveAttribute(
        "href",
        "/dashboard/guest"
      );
      await brandLogoLink(page).click();
      await expect(page).toHaveURL(/\/dashboard\/guest/);
    } finally {
      await context.close();
    }
  });
});