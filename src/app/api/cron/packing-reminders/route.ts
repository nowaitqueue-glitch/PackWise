import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { appOrigin } from "@/lib/stripe";
import { hasRealSecret } from "@/lib/env";
import {
  parsePackingItems,
  packingProgress,
} from "@/lib/packing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REMINDER_TYPE = "packing";

type CandidateTrip = {
  id: string;
  user_id: string;
  destination: string;
  start_date: string;
};

type ReminderResult = {
  tripId: string;
  userId: string;
  destination: string;
  startDate: string;
  email: string | null;
  status:
    | "sent"
    | "skipped_already_sent"
    | "skipped_fully_packed"
    | "skipped_no_email"
    | "skipped_opted_out"
    | "skipped_dry_run"
    | "failed_missing_resend_key"
    | "failed_email"
    | "failed_log";
  error?: string;
};

function isoDateUtc(daysFromToday: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  return d.toISOString().slice(0, 10);
}

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token === secret) {
      return true;
    }
  }

  const headerSecret = request.headers.get("x-cron-secret")?.trim();
  return headerSecret === secret;
}

function resendFromAddress(): string {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (from) return from;
  return "PackWise <onboarding@resend.dev>";
}

function isFullyPacked(itemsJson: unknown): boolean {
  const items = parsePackingItems(itemsJson);
  if (items.length === 0) {
    return false;
  }
  return packingProgress(items).percent >= 100;
}

async function claimReminder(
  supabase: SupabaseClient,
  params: {
    tripId: string;
    userId: string;
    reminderDate: string;
    meta?: Record<string, unknown>;
  }
): Promise<
  | { ok: true; id: string }
  | { ok: false; error: string; duplicate?: boolean }
> {
  const { data, error } = await supabase
    .from("reminder_log")
    .insert({
      trip_id: params.tripId,
      user_id: params.userId,
      reminder_type: REMINDER_TYPE,
      reminder_date: params.reminderDate,
      meta: params.meta ?? {},
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: error.message, duplicate: true };
    }
    return { ok: false, error: error.message };
  }

  if (!data?.id) {
    return { ok: false, error: "reminder_log insert returned no id." };
  }

  return { ok: true, id: data.id as string };
}

async function releaseClaim(
  supabase: SupabaseClient,
  claimId: string
): Promise<void> {
  const { error } = await supabase
    .from("reminder_log")
    .delete()
    .eq("id", claimId);
  if (error) {
    console.error(
      `[cron/packing-reminders] Failed to release claim ${claimId}:`,
      error.message
    );
  }
}

async function finalizeClaim(
  supabase: SupabaseClient,
  claimId: string,
  meta: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from("reminder_log")
    .update({ meta })
    .eq("id", claimId);
  if (error) {
    console.error(
      `[cron/packing-reminders] Failed to finalize claim ${claimId}:`,
      error.message
    );
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * GET /api/cron/packing-reminders
 *
 * Daily job: email owners of trips whose start_date is tomorrow (UTC)
 * (daily 09:00 UTC cron ~= within ~24 hours for date-only start_date),
 * whose packing list is not 100% packed, and who have
 * profiles.packing_reminder_email !== false (column default true).
 *
 * Idempotency: reminder_log unique (trip_id, reminder_type='packing', reminder_date=today UTC).
 *
 * Auth (Vercel cron pattern):
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Local dry-run (still requires auth; no claim / no Resend send):
 *   GET /api/cron/packing-reminders?dryRun=1
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET?.trim()) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 500 }
    );
  }

  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const dryRunParam = request.nextUrl.searchParams.get("dryRun");
  const dryRun =
    dryRunParam === "1" ||
    dryRunParam?.toLowerCase() === "true" ||
    dryRunParam?.toLowerCase() === "yes";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  const targetStartDate = isoDateUtc(1);
  const reminderDate = isoDateUtc(0);

  if (!supabaseUrl || !serviceRoleKey) {
    console.log(
      "[cron/packing-reminders] No SUPABASE_SERVICE_ROLE_KEY - skipped trip query.",
      { targetStartDate }
    );
    return NextResponse.json({
      ok: true,
      dryRun,
      targetStartDate,
      reminderDate,
      results: [] as ReminderResult[],
      note: "SUPABASE_SERVICE_ROLE_KEY missing; skipped trip query.",
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: trips, error: tripsError } = await supabase
    .from("trips")
    .select("id, user_id, destination, start_date")
    .eq("start_date", targetStartDate);

  if (tripsError) {
    console.error("[cron/packing-reminders] Query failed:", tripsError.message);
    return NextResponse.json(
      {
        error: "Failed to query departing trips.",
        detail: tripsError.message,
      },
      { status: 502 }
    );
  }

  const candidates = (trips ?? []) as CandidateTrip[];
  const results: ReminderResult[] = [];

  if (candidates.length === 0) {
    return NextResponse.json({
      ok: true,
      dryRun,
      targetStartDate,
      reminderDate,
      count: 0,
      sent: 0,
      results,
    });
  }
  const ownerIds = Array.from(new Set(candidates.map((t) => t.user_id)));
  const tripIds = candidates.map((t) => t.id);

  const [
    { data: profiles, error: profilesError },
    { data: packingLists, error: packingListsError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, packing_reminder_email")
      .in("id", ownerIds),
    supabase
      .from("packing_lists")
      .select("trip_id, items")
      .in("trip_id", tripIds),
  ]);

  if (profilesError) {
    console.error(
      "[cron/packing-reminders] Profiles query failed:",
      profilesError.message
    );
    return NextResponse.json(
      {
        error:
          "Failed to load packing reminder preferences (profiles.packing_reminder_email).",
        detail: profilesError.message,
        hint: "Apply migration 20260722180000_add_notification_prefs.sql",
      },
      { status: 502 }
    );
  }

  if (packingListsError) {
    console.error(
      "[cron/packing-reminders] Packing lists query failed:",
      packingListsError.message
    );
    return NextResponse.json(
      {
        error: "Failed to load packing lists.",
        detail: packingListsError.message,
      },
      { status: 502 }
    );
  }

  // Default true when no profile row yet (matches column default).
  const optedIn = new Set<string>();
  for (const profile of profiles ?? []) {
    if (profile.packing_reminder_email !== false) {
      optedIn.add(profile.id as string);
    }
  }
  for (const id of ownerIds) {
    const hasRow = (profiles ?? []).some((p) => p.id === id);
    if (!hasRow) optedIn.add(id);
  }

  const packingByTrip = new Map<string, unknown>();
  for (const row of packingLists ?? []) {
    packingByTrip.set(row.trip_id as string, row.items);
  }

  const resendKey = process.env.RESEND_API_KEY?.trim();
  const resendReady = hasRealSecret(resendKey);
  const resend = resendReady ? new Resend(resendKey) : null;
  const origin = appOrigin();

  if (!resendReady && !dryRun) {
    console.warn(
      "[cron/packing-reminders] RESEND_API_KEY is not configured; packing reminder emails will not be sent."
    );
  }

  for (const trip of candidates) {
    const base: Omit<ReminderResult, "status" | "email" | "error"> = {
      tripId: trip.id,
      userId: trip.user_id,
      destination: trip.destination,
      startDate: trip.start_date,
    };

    try {
      if (!optedIn.has(trip.user_id)) {
        results.push({ ...base, email: null, status: "skipped_opted_out" });
        continue;
      }

      if (isFullyPacked(packingByTrip.get(trip.id))) {
        results.push({ ...base, email: null, status: "skipped_fully_packed" });
        continue;
      }

      let email: string | null = null;
      try {
        const { data: userData, error: userError } =
          await supabase.auth.admin.getUserById(trip.user_id);
        if (userError) {
          console.error(
            `[cron/packing-reminders] getUserById failed for ${trip.user_id}:`,
            userError.message
          );
        } else {
          email = userData.user?.email?.trim() || null;
        }
      } catch (err) {
        console.error(
          `[cron/packing-reminders] getUserById threw for ${trip.user_id}:`,
          err
        );
      }

      if (!email) {
        results.push({ ...base, email: null, status: "skipped_no_email" });
        continue;
      }

      if (dryRun) {
        console.log(
          `[cron/packing-reminders] dryRun - would email ${email} for trip ${trip.id} (${trip.destination})`
        );
        results.push({
          ...base,
          email,
          status: "skipped_dry_run",
        });
        continue;
      }

      if (!resend) {
        console.warn(
          `[cron/packing-reminders] RESEND_API_KEY missing - skipped email to ${email} for trip ${trip.id}`
        );
        results.push({
          ...base,
          email,
          status: "failed_missing_resend_key",
          error: "RESEND_API_KEY is not configured.",
        });
        continue;
      }

      const claimed = await claimReminder(supabase, {
        tripId: trip.id,
        userId: trip.user_id,
        reminderDate,
        meta: { status: "pending", to: email },
      });

      if (!claimed.ok) {
        if (claimed.duplicate) {
          results.push({
            ...base,
            email,
            status: "skipped_already_sent",
          });
          continue;
        }
        console.error(
          `[cron/packing-reminders] Failed to claim reminder_log for ${trip.id}:`,
          claimed.error
        );
        results.push({
          ...base,
          email,
          status: "failed_log",
          error: claimed.error,
        });
        continue;
      }

      const tripUrl = `${origin}/dashboard/trips/${trip.id}`;
      const subject = `Packing reminder: ${trip.destination}`;
      const html = `
      <div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
        <p>Your trip to <strong>${escapeHtml(trip.destination)}</strong> starts on <strong>${escapeHtml(trip.start_date)}</strong>.</p>
        <p>Your packing list is not finished yet - open PackWise to check off the rest.</p>
        <p><a href="${escapeHtml(tripUrl)}">Open packing list</a></p>
        <p style="color:#666;font-size:12px;">You can turn off packing reminder emails in Settings.</p>
      </div>
    `.trim();

      try {
        const { data: sendData, error: sendError } = await resend.emails.send({
          from: resendFromAddress(),
          to: email,
          subject,
          html,
        });

        if (sendError) {
          console.error(
            `[cron/packing-reminders] Resend failed for trip ${trip.id}:`,
            sendError
          );
          await releaseClaim(supabase, claimed.id);
          results.push({
            ...base,
            email,
            status: "failed_email",
            error:
              typeof sendError === "object" &&
              sendError &&
              "message" in sendError
                ? String((sendError as { message: unknown }).message)
                : "Resend send failed.",
          });
          continue;
        }

        await finalizeClaim(supabase, claimed.id, {
          status: "sent",
          provider: "resend",
          messageId: sendData?.id ?? null,
          to: email,
        });

        console.log(
          `[cron/packing-reminders] Sent packing reminder for trip ${trip.id} to ${email}`
        );
        results.push({ ...base, email, status: "sent" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[cron/packing-reminders] Unexpected send error for ${trip.id}:`,
          message
        );
        await releaseClaim(supabase, claimed.id);
        results.push({
          ...base,
          email,
          status: "failed_email",
          error: message,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[cron/packing-reminders] Unhandled trip error for ${trip.id}:`,
        message
      );
      results.push({
        ...base,
        email: null,
        status: "failed_email",
        error: message,
      });
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;

  return NextResponse.json({
    ok: true,
    dryRun,
    targetStartDate,
    reminderDate,
    count: results.length,
    sent,
    results,
    resendConfigured: resendReady,
  });
}
