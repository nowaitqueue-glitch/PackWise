-- Idempotent packing (and future) reminder delivery log.
-- Cron uses service_role; clients have no access.
-- Preference column used by Settings + cron: profiles.packing_reminder_email
-- (not reminder_email — that name was never added).

create table if not exists public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reminder_type text not null,
  reminder_date date not null,
  sent_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb,
  constraint reminder_log_type_nonempty check (char_length(trim(reminder_type)) > 0)
);

create unique index if not exists reminder_log_trip_type_date_uidx
  on public.reminder_log (trip_id, reminder_type, reminder_date);

create index if not exists reminder_log_user_id_idx on public.reminder_log (user_id);
create index if not exists reminder_log_sent_at_idx on public.reminder_log (sent_at desc);

comment on table public.reminder_log is
  'Delivery log for scheduled reminders; unique per trip/type/date for idempotency.';

alter table public.reminder_log enable row level security;

-- No policies for authenticated/anon — service_role bypasses RLS.
revoke all on table public.reminder_log from anon;
revoke all on table public.reminder_log from authenticated;
grant all on table public.reminder_log to service_role;
