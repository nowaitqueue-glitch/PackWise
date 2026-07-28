import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/dashboard";

  // Supports magic-link sign-in and password-recovery when redirectTo is
  // `/auth/callback?next=/reset-password` (alternative to landing on
  // `/reset-password?code=…` directly).
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  if (next === "/reset-password") {
    return NextResponse.redirect(`${origin}/reset-password?error=invalid`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
