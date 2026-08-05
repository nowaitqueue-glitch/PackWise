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
 * Non-CSP security headers.
 *
 * Content-Security-Policy is set in `src/middleware.ts` with a per-request
 * nonce so Next.js can hydrate under `script-src ... 'strict-dynamic'`.
 * Do NOT also emit CSP here — browsers enforce every CSP header, and a
 * nonce-less policy would block framework scripts again.
 */
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
      value: "camera=(self), microphone=(), geolocation=(self), interest-cohort=()",
    },
  ];
}

/** @type {import('next').NextConfig} */
// Future: wrap with @sentry/nextjs (withSentryConfig) once error reporting
// graduates from console-only reportError in src/lib/error-reporting.ts.
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
