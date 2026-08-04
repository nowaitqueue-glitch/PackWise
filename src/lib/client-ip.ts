/**
 * Resolve the caller IP for rate limiting.
 *
 * In production, prefer platform-set x-real-ip (Vercel) over client-spoofable
 * x-forwarded-for. Outside production, fall back to the first XFF hop for
 * local/proxy testing, then localhost.
 */
export function getClientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp && process.env.NODE_ENV === "production") return realIp.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  return "127.0.0.1";
}
