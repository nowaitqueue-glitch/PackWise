import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  AUTH_SERVICE_FAILURE_COOKIE,
  AUTH_SERVICE_FAILURE_HEADER,
} from "@/lib/auth-service-failure";

type SessionMiddlewareOptions = {
  /** Forwarded to Next so RSC/SSR see nonce + CSP on the request. */
  requestHeaders?: Headers;
  /** Applied to every response (including redirects). */
  responseHeaders?: Record<string, string>;
};

function applyResponseHeaders(
  response: NextResponse,
  responseHeaders?: Record<string, string>
) {
  if (!responseHeaders) return response;
  for (const [key, value] of Object.entries(responseHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

function nextWithHeaders(
  request: NextRequest,
  options?: SessionMiddlewareOptions
) {
  const response = options?.requestHeaders
    ? NextResponse.next({
        request: {
          headers: options.requestHeaders,
        },
      })
    : NextResponse.next({ request });
  return applyResponseHeaders(response, options?.responseHeaders);
}

/** Mark infra/auth outage so pages can show a banner instead of bouncing to login. */
export function markAuthServiceFailure(
  response: NextResponse,
  requestHeaders?: Headers
) {
  response.cookies.set(AUTH_SERVICE_FAILURE_COOKIE, "1", {
    path: "/",
    maxAge: 120,
    sameSite: "lax",
    httpOnly: false,
  });
  response.headers.set(AUTH_SERVICE_FAILURE_HEADER, "1");
  if (requestHeaders) {
    requestHeaders.set(AUTH_SERVICE_FAILURE_HEADER, "1");
  }
  return response;
}

function clearAuthServiceFailure(response: NextResponse) {
  response.cookies.set(AUTH_SERVICE_FAILURE_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    httpOnly: false,
  });
}

/** True when getUser failed because there is simply no session (still redirect). */
function isMissingSessionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name =
    "name" in error && typeof error.name === "string" ? error.name : "";
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  const status =
    "status" in error && typeof error.status === "number" ? error.status : null;

  if (name === "AuthSessionMissingError") return true;
  if (/auth session missing|session missing/i.test(message)) return true;
  if (status === 401 || status === 403) return true;
  if (/invalid.*(jwt|token|refresh)|not authenticated/i.test(message)) {
    return true;
  }
  return false;
}

function failClosedForAuthService(
  request: NextRequest,
  options?: SessionMiddlewareOptions
) {
  if (options?.requestHeaders) {
    options.requestHeaders.set(AUTH_SERVICE_FAILURE_HEADER, "1");
  }
  const response = nextWithHeaders(request, options);
  markAuthServiceFailure(response, options?.requestHeaders);
  return response;
}

export async function updateSession(
  request: NextRequest,
  options?: SessionMiddlewareOptions
) {
  let supabaseResponse = nextWithHeaders(request, options);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = nextWithHeaders(request, options);
          cookiesToSet.forEach(({ name, value, options: cookieOptions }) =>
            supabaseResponse.cookies.set(name, value, cookieOptions)
          );
        },
      },
    }
  );

  let user: { id: string } | null = null;
  try {
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();

    if (error && !isMissingSessionError(error)) {
      // Auth service / network failure — do NOT redirect to login.
      return failClosedForAuthService(request, options);
    }

    user = error ? null : authUser;
    clearAuthServiceFailure(supabaseResponse);
  } catch (error) {
    if (isMissingSessionError(error)) {
      user = null;
      clearAuthServiceFailure(supabaseResponse);
    } else {
      return failClosedForAuthService(request, options);
    }
  }

  const pathname = request.nextUrl.pathname;
  // Guest flows stay public: /guest/* is never under /dashboard, and
  // /dashboard/guest is explicitly allowlisted below for unauthenticated users.
  const isGuestDashboard =
    pathname === "/dashboard/guest" || pathname.startsWith("/dashboard/guest/");

  if (
    !user &&
    pathname.startsWith("/dashboard") &&
    !isGuestDashboard
  ) {
    const url = request.nextUrl.clone();
    const nextPath = `${pathname}${request.nextUrl.search}`;
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", nextPath);
    return applyResponseHeaders(
      NextResponse.redirect(url),
      options?.responseHeaders
    );
  }

  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    const next = request.nextUrl.searchParams.get("next");
    const safeNext =
      next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    url.pathname = safeNext;
    url.search = "";
    return applyResponseHeaders(
      NextResponse.redirect(url),
      options?.responseHeaders
    );
  }

  return supabaseResponse;
}
