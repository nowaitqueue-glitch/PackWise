/**
 * Simple sliding-window rate limiter.
 * In-memory buckets are per-process (fine for single-instance / local).
 * Guest weather also stamps an httpOnly cookie so abuse across server
 * instances still hits a per-browser ceiling when cookies persist.
 */

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number };

type RateBucket = { count: number; resetAt: number };

const buckets = new Map<string, RateBucket>();

export function checkMemoryRateLimit(
  key: string,
  max: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  if (bucket.count >= max) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count += 1;
  return { allowed: true };
}

/** Parse a compact cookie counter: `count:resetAtMs`. */
export function parseCookieRateStamp(
  raw: string | undefined,
  max: number,
  windowMs: number
): { allowed: boolean; nextValue: string; retryAfterSec: number } {
  const now = Date.now();
  let count = 0;
  let resetAt = now + windowMs;

  if (raw) {
    const [countPart, resetPart] = raw.split(":");
    const parsedCount = Number.parseInt(countPart ?? "", 10);
    const parsedReset = Number.parseInt(resetPart ?? "", 10);
    if (
      Number.isFinite(parsedCount) &&
      Number.isFinite(parsedReset) &&
      parsedReset > now
    ) {
      count = parsedCount;
      resetAt = parsedReset;
    }
  }

  if (count >= max) {
    return {
      allowed: false,
      nextValue: `${count}:${resetAt}`,
      retryAfterSec: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    };
  }

  count += 1;
  return {
    allowed: true,
    nextValue: `${count}:${resetAt}`,
    retryAfterSec: 0,
  };
}