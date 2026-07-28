import path from "node:path";
import { fileURLToPath } from "node:url";
import withPWAInit from "@ducanh2912/next-pwa";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  fallbacks: {
    document: "/dashboard",
  },
});

/**
 * Browser-facing CSP allowlist derived from app usage:
 * - Supabase Auth / REST / Storage (client + SSR)
 * - Plausible analytics script
 * - Stripe Checkout redirect / optional Stripe.js
 * - Open-Meteo (server-proxied today; allowlisted for connect-src)
 * - Gemini is server-only (no browser connect)
 * - next/font self-hosts Google fonts (no fonts.googleapis.com at runtime)
 * - Suitcase Snap uses camera + blob: previews
 */
function buildContentSecurityPolicy() {
  const isDev = process.env.NODE_ENV !== "production";

  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    // Next.js webpack HMR / some tooling need eval in development only.
    ...(isDev ? ["'unsafe-eval'"] : []),
    "https://plausible.io",
    "https://js.stripe.com",
  ];

  const connectSrc = [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://plausible.io",
    "https://api.stripe.com",
    "https://api.open-meteo.com",
    "https://geocoding-api.open-meteo.com",
  ];

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "font-src 'self' data:",
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

function securityHeaders() {
  return [
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "X-XSS-Protection",
      value: "1; mode=block",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(self), microphone=(), geolocation=()",
    },
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy(),
    },
  ];
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep root-level test helpers out of serverless traces.
  // App Router still compiles `src/app/api/test/*`; those handlers hard-404
  // when NODE_ENV !== "development".
  experimental: {
    outputFileTracingExcludes: {
      "*": ["./test/**/*"],
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(),
      },
      // Keep authenticated app surfaces out of search indexes.
      {
        source: "/dashboard/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
      {
        source: "/dashboard",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
    ];
  },
  webpack: (config, { dev, webpack }) => {
    if (!dev) {
      // Swap e2e helpers for a production stub (never enable test login).
      // Do NOT match `src/app/api/test` (route handlers stay compiled but dead).
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /(?:^|[\\/])test[\\/]utils[\\/]e2e(?:\.(?:ts|js|mjs|cjs))?$/,
          path.join(__dirname, "test", "utils", "e2e.stub.ts")
        )
      );
    }
    return config;
  },
};

export default withPWA(nextConfig);
