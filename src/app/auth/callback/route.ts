import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Resolve the public origin for post-auth redirects.
 * Prefer the forwarded host on Vercel/proxies so we don't bounce to an
 * internal URL that 404s.
 */
function resolveOrigin(request: NextRequest): string {
  const { origin } = new URL(request.url);
  const isLocal =
    origin.includes("localhost") || origin.includes("127.0.0.1");
  if (isLocal) return origin;

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return origin;
}

function safeNextPath(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return "/dashboard";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const origin = resolveOrigin(request);

  // Supports magic-link sign-in and password-recovery when redirectTo is
  // `/auth/callback?next=/reset-password` (alternative to landing on
  // `/reset-password?code=…` directly).
  if (code) {
    // Bind cookie writes to the redirect response (same pattern as
    // /api/test/login). Using cookies() from next/headers alone can drop
    // the session on redirect in the App Router.
    const response = NextResponse.redirect(`${origin}${next}`);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.redirect(`${origin}/login?error=auth`);
    }

    const supabase = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
  }

  if (next === "/reset-password") {
    return NextResponse.redirect(`${origin}/reset-password?error=invalid`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
