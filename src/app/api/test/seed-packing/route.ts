import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isTestLoginEnabled } from "@test/utils/e2e";
import { normalizePackingItemsForStorage, toPackingListPayload } from "@/lib/packing";

/**
 * Dev/e2e-only: upsert a minimal packing list for a trip when AI generation
 * is unavailable or slow. Requires an authenticated session (test login)
 * and trip ownership.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse("Not found", { status: 404 });
  }

  if (!isTestLoginEnabled()) {
    return NextResponse.json(
      { error: "Test seed is disabled. Set ENABLE_TEST_LOGIN=true." },
      { status: 404 }
    );
  }

  let body: { tripId?: string };
  try {
    body = (await request.json()) as { tripId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const tripId = body.tripId?.trim();
  if (!tripId) {
    return NextResponse.json({ error: "tripId is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("id, user_id")
    .eq("id", tripId)
    .maybeSingle();

  if (tripError || !trip) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  if (trip.user_id !== user.id) {
    return NextResponse.json(
      { error: "Only the trip owner can seed the packing list." },
      { status: 403 }
    );
  }

  const items = normalizePackingItemsForStorage([
    {
      name: "Passport",
      category: "Documents",
      notes: "E2E seeded item",
      packed: false,
    },
    {
      name: "Comfortable walking shoes",
      category: "Clothing",
      notes: "E2E seeded item",
      packed: false,
    },
    {
      name: "Phone charger",
      category: "Electronics",
      notes: "E2E seeded item",
      packed: false,
    },
  ]);

  const { error } = await supabase.from("packing_lists").upsert(
    {
      trip_id: tripId,
      items: toPackingListPayload(items, "template"),
    },
    { onConflict: "trip_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, itemCount: items.length });
}
