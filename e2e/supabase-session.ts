/**
 * Build @supabase/ssr auth cookies from an access (+ refresh) token.
 * Cookie name: sb-<project-ref>-auth-token (chunked when large).
 */
import {
  createChunks,
  stringToBase64URL,
} from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

const BASE64_PREFIX = "base64-";

export function supabaseProjectRef(supabaseUrl: string): string {
  const host = new URL(supabaseUrl).hostname;
  return host.split(".")[0] ?? host;
}

export function authCookieName(supabaseUrl: string): string {
  return `sb-${supabaseProjectRef(supabaseUrl)}-auth-token`;
}

/**
 * Host-only cookie origins for e2e. Always include both 127.0.0.1 and localhost
 * so a storageState still authenticates if something resolves the other loopback name.
 */
export function authCookieUrls(baseURL: string): string[] {
  const url = new URL(baseURL);
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  const protocol = url.protocol;
  const hosts = new Set<string>([url.hostname, "127.0.0.1", "localhost"]);
  return [...hosts].map((host) => `${protocol}//${host}:${port}`);
}

export async function buildSessionFromJwt(
  accessToken: string,
  refreshToken: string | undefined,
  supabaseUrl: string,
  anonKey: string
) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const {
    data: { user },
    error,
  } = await client.auth.getUser(accessToken);

  if (error || !user) {
    throw new Error(
      error?.message || "TEST_USER_JWT is invalid (getUser failed)."
    );
  }

  // Decode exp from JWT payload when possible.
  let expiresAt: number | undefined;
  try {
    const payloadPart = accessToken.split(".")[1];
    if (payloadPart) {
      const json = Buffer.from(
        payloadPart.replace(/-/g, "+").replace(/_/g, "/"),
        "base64"
      ).toString("utf8");
      const payload = JSON.parse(json) as { exp?: number };
      if (typeof payload.exp === "number") expiresAt = payload.exp;
    }
  } catch {
    // ignore — expires_at optional for cookie shape
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresIn =
    expiresAt && expiresAt > now ? expiresAt - now : 60 * 60;

  return {
    access_token: accessToken,
    refresh_token: refreshToken || "",
    expires_in: expiresIn,
    expires_at: expiresAt ?? now + expiresIn,
    token_type: "bearer" as const,
    user,
  };
}

export function sessionToAuthCookies(
  session: object,
  cookieName: string
): { name: string; value: string }[] {
  const json = JSON.stringify(session);
  const encoded = BASE64_PREFIX + stringToBase64URL(json);
  return createChunks(cookieName, encoded);
}

/**
 * Inject Supabase SSR auth cookies into the Playwright browser context.
 */
export async function injectSupabaseAuthCookies(
  page: Page,
  opts: {
    accessToken: string;
    refreshToken?: string;
    supabaseUrl: string;
    anonKey: string;
    baseURL: string;
  }
): Promise<void> {
  const session = await buildSessionFromJwt(
    opts.accessToken,
    opts.refreshToken,
    opts.supabaseUrl,
    opts.anonKey
  );
  const name = authCookieName(opts.supabaseUrl);
  const chunks = sessionToAuthCookies(session, name);
  const secure = opts.baseURL.startsWith("https:");
  // Prefer `url` (host-only) over `domain` — IP Domain= cookies are unreliable
  // in Chromium, and dual loopback URLs cover localhost vs 127.0.0.1 mismatch.
  const urls = authCookieUrls(opts.baseURL);

  await page.context().addCookies(
    urls.flatMap((url) =>
      chunks.map((chunk) => ({
        name: chunk.name,
        value: chunk.value,
        url,
        httpOnly: false,
        secure,
        sameSite: "Lax" as const,
      }))
    )
  );
}
