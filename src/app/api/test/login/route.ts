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
 * email + password via signInWithPassword (no magic link).
 *
 * Hard-gated to NODE_ENV=development; also requires ENABLE_TEST_LOGIN=true
 * (or E2E_TEST_MODE=true). Credentials default to test@packwise.com /
 * Test1234! when E2E_TEST_USER_* are unset.
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
    // Fall through to password sign-in if the stored JWT is expired/invalid.
    console.warn(
      `[test/login] setSession from TEST_USER_JWT failed (${sessionError.message}); falling back to signInWithPassword`
    );
  }

  let email =
    process.env.E2E_TEST_USER_EMAIL?.trim() ||
    process.env.TEST_USER_EMAIL?.trim() ||
    "";

  const password =
    process.env.E2E_TEST_USER_PASSWORD?.trim() || "Test1234!";

  const userId =
    process.env.E2E_TEST_USER_ID?.trim() ||
    process.env.TEST_USER_ID?.trim() ||
    "";

  if (!email && userId) {
    if (!serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Missing SUPABASE_SERVICE_ROLE_KEY (needed to resolve E2E_TEST_USER_ID / TEST_USER_ID to an email).",
        },
        { status: 500 }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
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
    email = "test@packwise.com";
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return NextResponse.json(
      {
        error: `signInWithPassword failed: ${signInError.message}. Run: node scripts/create-test-user.mjs --write-env`,
      },
      { status: 500 }
    );
  }

  return response;
}
