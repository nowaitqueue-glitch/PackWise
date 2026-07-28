import { NextRequest, NextResponse } from "next/server";

/**
 * Legacy path — packing reminders live at /api/cron/packing-reminders.
 * Keep this stub so old bookmarks / scripts get a clear redirect.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/api/cron/packing-reminders";
  return NextResponse.redirect(url, 307);
}
