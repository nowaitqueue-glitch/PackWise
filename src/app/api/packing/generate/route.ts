import { NextRequest, NextResponse } from "next/server";
import { generateAndStorePackingList } from "@/app/dashboard/packing-actions";
import { createBearerClient } from "@/lib/supabase/bearer";

/**
 * POST /api/packing/generate
 * Authorization: Bearer <Supabase user access token>
 * Body: { "tripId": "<uuid>" }
 *
 * Generates (or regenerates) a weather-aware tag-based packing list for a trip
 * owned by the JWT user.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json(
      { error: "Authorization Bearer token is required." },
      { status: 401 }
    );
  }

  const accessToken = authHeader.slice(7).trim();
  if (!accessToken) {
    return NextResponse.json(
      { error: "Authorization Bearer token is required." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON with tripId." },
      { status: 400 }
    );
  }

  const bodyObj =
    body && typeof body === "object" ? (body as Record<string, unknown>) : null;

  const tripId =
    bodyObj && typeof bodyObj.tripId === "string" ? bodyObj.tripId.trim() : "";

  if (!tripId) {
    return NextResponse.json(
      { error: "Body field tripId (string) is required." },
      { status: 400 }
    );
  }

  const supabase = createBearerClient(accessToken);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(accessToken);

  if (authError || !user) {
    return NextResponse.json(
      { error: "Invalid or expired access token." },
      { status: 401 }
    );
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select(
      "id, user_id, destination, start_date, end_date, trip_type, travelers"
    )
    .eq("id", tripId)
    .maybeSingle();

  if (tripError || !trip) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  if (trip.user_id !== user.id) {
    return NextResponse.json(
      { error: "Only the trip owner can generate the packing list." },
      { status: 403 }
    );
  }

  const result = await generateAndStorePackingList({
    tripId: trip.id,
    trip: {
      destination: trip.destination,
      startDate: trip.start_date,
      endDate: trip.end_date,
      tripType: trip.trip_type,
      travelers: trip.travelers,
    },
    supabase,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    tripId: trip.id,
    itemCount: result.items.length,
    items: result.items,
    source: result.source,
  });
}
