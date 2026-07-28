import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client authenticated via a user access token (Authorization Bearer).
 * Used by API routes that accept JWTs from scripts / non-cookie clients.
 */
export function createBearerClient(accessToken: string): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}
