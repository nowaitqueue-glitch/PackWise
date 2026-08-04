/**
 * Browser-facing CSP.
 *
 * script-src uses a per-request nonce + 'strict-dynamic' so Next.js hydration
 * scripts can run without 'unsafe-inline'. Host allowlists remain as CSP2
 * fallbacks (ignored under strict-dynamic in CSP3 browsers).
 *
 * Tradeoff: nonce CSP requires dynamic rendering (middleware sets a fresh
 * nonce each request). That is intentional - static HTML cannot carry a
 * request-bound nonce.
 */
export function buildContentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";

  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // Next.js webpack HMR / React debug need eval in development only.
    ...(isDev ? ["'unsafe-eval'"] : []),
    "https://js.stripe.com",
    "https://plausible.io",
  ];

  const connectSrc = [
    "'self'",
    "https://api.open-meteo.com",
    "https://geocoding-api.open-meteo.com",
    "https://generativelanguage.googleapis.com",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://api.stripe.com",
    "https://plausible.io",
  ];

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    // Tailwind / Radix / next-themes still rely on inline styles.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    `connect-src ${connectSrc.join(" ")}`,
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com",
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://checkout.stripe.com",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ];

  return directives.join("; ");
}