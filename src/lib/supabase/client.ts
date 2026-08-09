import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client (PKCE + cookie storage via @supabase/ssr).
 *
 * detectSessionInUrl is off: recovery (`/reset-password`) exchanges `?code=`
 * explicitly. Leaving detection on would race a one-time code. OAuth and
 * email confirmation use `/auth/callback` (server exchange).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    }
  );
}
