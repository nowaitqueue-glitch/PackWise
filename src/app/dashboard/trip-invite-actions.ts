"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ADD_MEMBER_BY_EMAIL_SUCCESS,
  type AddMemberByEmailResult,
  type CreateInviteResult,
} from "@/lib/trip-invite";

type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

function newInviteToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/**
 * Resolve an auth user id by email using the Auth Admin API (service role).
 *
 * supabase-js 2.110.7 has no getUserByEmail, and its listUsers helper only
 * forwards page/perPage (not filter). GoTrue's GET /auth/v1/admin/users still
 * accepts `filter`, so we call that with the service role key and then match
 * the email exactly (case-insensitive).
 */
async function findAuthUserIdByEmail(
  email: string
): Promise<{ userId: string | null } | { error: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!baseUrl || !serviceKey) {
    return { error: "Server configuration error." };
  }

  const url = new URL(`${baseUrl}/auth/v1/admin/users`);
  url.searchParams.set("page", "1");
  url.searchParams.set("per_page", "50");
  url.searchParams.set("filter", email);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    console.error(
      "[addTripMemberByEmail] admin user lookup failed",
      res.status
    );
    return { error: "Could not process that invite right now." };
  }

  const body = (await res.json()) as {
    users?: Array<{ id: string; email?: string | null }>;
  };

  const match = (body.users ?? []).find(
    (user) => user.email?.trim().toLowerCase() === email
  );

  return { userId: match?.id ?? null };
}

async function requireTripOwner(tripId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null as null, error: "You must be signed in." };
  }

  const { data: trip, error } = await supabase
    .from("trips")
    .select("id, user_id")
    .eq("id", tripId)
    .maybeSingle();

  if (error || !trip) {
    return { supabase, user, error: "Trip not found." };
  }

  if (trip.user_id !== user.id) {
    return { supabase, user, error: "Only the trip owner can invite others." };
  }

  return { supabase, user, error: null as null, trip };
}

/**
 * Creates a shareable invite token for a trip (owner only).
 */
export async function createTripInvite(
  tripId: string
): Promise<CreateInviteResult> {
  const result = await requireTripOwner(tripId);
  if (result.error || !result.user) {
    return { ok: false, error: result.error ?? "You must be signed in." };
  }

  const token = newInviteToken();
  const { error } = await result.supabase.from("trip_invites").insert({
    trip_id: tripId,
    token,
    created_by: result.user.id,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    token,
    path: `/dashboard/trips/join/${token}`,
  };
}

/**
 * Adds an existing PackWise user by email.
 *
 * Always returns the same generic success whether or not the email is
 * registered, so the client cannot enumerate accounts. Existence is checked
 * server-side with the Auth Admin API (service role). Invite-by-link tokens
 * remain available via createTripInvite.
 */
export async function addTripMemberByEmail(params: {
  tripId: string;
  email: string;
}): Promise<AddMemberByEmailResult> {
  const email = params.email.trim().toLowerCase();
  if (!email || !email.includes("@") || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const result = await requireTripOwner(params.tripId);
  if (result.error || !result.user || !result.trip) {
    return { ok: false, error: result.error ?? "You must be signed in." };
  }

  const lookup = await findAuthUserIdByEmail(email);
  if ("error" in lookup) {
    return { ok: false, error: lookup.error };
  }

  if (!lookup.userId) {
    console.info(
      "[addTripMemberByEmail] invited email is not registered; returning generic success",
      { tripId: params.tripId, email }
    );
    return { ok: true, message: ADD_MEMBER_BY_EMAIL_SUCCESS };
  }

  // Owner already has access — same generic success (no enumeration signal).
  if (lookup.userId === result.trip.user_id) {
    return { ok: true, message: ADD_MEMBER_BY_EMAIL_SUCCESS };
  }

  const { error: insertError } = await result.supabase
    .from("trip_members")
    .upsert(
      {
        trip_id: params.tripId,
        user_id: lookup.userId,
        role: "member",
      },
      { onConflict: "trip_id,user_id", ignoreDuplicates: true }
    );

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  revalidatePath(`/dashboard/trips/${params.tripId}`);
  return { ok: true, message: ADD_MEMBER_BY_EMAIL_SUCCESS };
}

/**
 * Redeems an invite token: adds the current user as a trip member, then
 * redirects to the trip detail page.
 */
export async function joinTripByToken(token: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/dashboard/trips/join/${token}`)}`
    );
  }

  const { data: tripId, error } = await supabase.rpc(
    "join_trip_by_invite_token",
    { p_token: token }
  );

  if (error || !tripId) {
    return {
      ok: false,
      error:
        error?.message ??
        "Could not join this trip. The invite may be invalid or expired.",
    };
  }

  revalidatePath(`/dashboard/trips/${tripId}`);
  redirect(`/dashboard/trips/${tripId}`);
}
