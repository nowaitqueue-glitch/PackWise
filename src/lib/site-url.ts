/**
 * Canonical site origin for metadata, sitemap, and robots.
 * Prefers NEXT_PUBLIC_APP_URL (same as Checkout / auth redirects).
 */
export function getSiteUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.VERCEL_URL?.trim();

  if (fromEnv) {
    if (fromEnv.startsWith("http://") || fromEnv.startsWith("https://")) {
      return fromEnv.replace(/\/$/, "");
    }
    return `https://${fromEnv.replace(/\/$/, "")}`;
  }

  // README / Plausible example production host when env is unset at build time.
  return "https://packwise.app";
}