import { type NextRequest, NextResponse } from "next/server";
import { AUTH_SERVICE_FAILURE_HEADER } from "@/lib/auth-service-failure";
import { buildContentSecurityPolicy } from "@/lib/csp";
import { reportError } from "@/lib/error-reporting";
import {
  markAuthServiceFailure,
  updateSession,
} from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildContentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next extracts `'nonce-…'` from the request CSP during SSR and stamps
  // framework / hydration scripts automatically.
  requestHeaders.set("Content-Security-Policy", csp);

  const responseHeaders = {
    "Content-Security-Policy": csp,
  };

  try {
    return await updateSession(request, {
      requestHeaders,
      responseHeaders,
    });
  } catch (error) {
    reportError(error, { middleware: true });
    // Allow the request to continue — infra failure must not bounce to login.
    requestHeaders.set(AUTH_SERVICE_FAILURE_HEADER, "1");
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    response.headers.set("Content-Security-Policy", csp);
    markAuthServiceFailure(response, requestHeaders);
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets, images, and PWA files.
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|sw\\.js|workbox-.*\\.js|swe-worker-.*\\.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
