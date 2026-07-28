import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isTestLoginEnabled } from "@test/utils/e2e";

/**
 * Dev/e2e-only: mint a Supabase session for the configured test user and
 * set auth cookies the same way @supabase/ssr does, then redirect to /dashboard.
 *
 * Prefers TEST_USER_JWT (+ TEST_USER_REFRESH_TOKEN) from env when set
 * (from `node scripts/create-test-user.mjs --write-env`). Falls back to
 * service-role generateLink + verifyOtp.
 *
 * Hard-gated to NODE_ENV=development; also requires ENABLE_TEST_LOGIN=true
 * (or E2E_TEST_MODE=true), plus JWT tokens or SUPABASE_SERVICE_ROLE_KEY +
 * E2E_TEST_USER_*.
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse("Not found", { status: 404 });
  }

  if (!isTestLoginEnabled()) {
    return NextResponse.json(
      { error: "Test login is disabled. Set ENABLE_TEST_LOGIN=true." },
      { status: 404 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      {
        error:
          "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      },
      { status: 500 }
    );
  }

  const { origin } = new URL(request.url);
  const nextParam = request.nextUrl.searchParams.get("next");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/dashboard";

  const response = NextResponse.redirect(`${origin}${next}`);

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

  const envJwt = process.env.TEST_USER_JWT?.trim();
  const envRefresh = process.env.TEST_USER_REFRESH_TOKEN?.trim();

  // Prefer shared token from create-test-user when both halves are present.
  if (envJwt && envRefresh) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: envJwt,
      refresh_token: envRefresh,
    });
    if (!sessionError) {
      return response;
    }
    // Fall through to magic-link mint if the stored JWT is expired/invalid.
    console.warn(
      `[test/login] setSession from TEST_USER_JWT failed (${sessionError.message}); falling back to generateLink`
    );
  }

  if (!serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          "Missing SUPABASE_SERVICE_ROLE_KEY (needed when TEST_USER_JWT/REFRESH are absent or invalid).",
      },
      { status: 500 }
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let email =
    process.env.E2E_TEST_USER_EMAIL?.trim() ||
    process.env.TEST_USER_EMAIL?.trim() ||
    "";

  const userId =
    process.env.E2E_TEST_USER_ID?.trim() ||
    process.env.TEST_USER_ID?.trim() ||
    "";

  if (!email && userId) {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error || !data?.user?.email) {
      return NextResponse.json(
        {
          error:
            error?.message ||
            "Could not resolve E2E_TEST_USER_ID / TEST_USER_ID to an email.",
        },
        { status: 500 }
      );
    }
    email = data.user.email;
  }

  if (!email) {
    return NextResponse.json(
      {
        error:
          "Set TEST_USER_JWT + TEST_USER_REFRESH_TOKEN, or E2E_TEST_USER_EMAIL (or E2E_TEST_USER_ID / TEST_USER_ID) for test login.",
      },
      { status: 500 }
    );
  }

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

  if (linkError) {
    return NextResponse.json(
      { error: `generateLink failed: ${linkError.message}` },
      { status: 500 }
    );
  }

  const tokenHash =
    linkData?.properties?.hashed_token ??
    (linkData as { hashed_token?: string } | null)?.hashed_token;

  if (!tokenHash) {
    return NextResponse.json(
      { error: "generateLink did not return hashed_token." },
      { status: 500 }
    );
  }

  const { error: otpError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });

  if (otpError) {
    return NextResponse.json(
      { error: `verifyOtp failed: ${otpError.message}` },
      { status: 500 }
    );
  }

  return response;
}
