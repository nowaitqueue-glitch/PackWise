/**
 * Edge-safe error reporting. Currently logs to the console;
 * swap the body for Sentry (or similar) when ready.
 */
export function reportError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  console.error("[PackWise Error]", error, context);
  // Future: send to Sentry or other service
}

/**
 * Thin wrapper for server actions / async handlers.
 * Reports the error, then rethrows so callers keep existing control flow.
 */
export async function withErrorReporting<T>(
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    reportError(error, context);
    throw error;
  }
}
