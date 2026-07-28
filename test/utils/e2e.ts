/**
 * Guards for Playwright / local e2e helpers.
 * Only enable when explicitly opted in during local development —
 * never leave these on in production or preview deployments.
 */
export function isTestLoginEnabled(): boolean {
  if (process.env.NODE_ENV !== "development") {
    return false;
  }
  return (
    process.env.ENABLE_TEST_LOGIN === "true" ||
    process.env.E2E_TEST_MODE === "true"
  );
}
