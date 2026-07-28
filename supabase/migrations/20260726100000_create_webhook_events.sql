-- Idempotency ledger for Stripe webhooks (service role only).
-- Unique stripe_event_id prevents double-crediting on retries/replays.

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  processed_at timestamptz not null default now()
);

alter table public.webhook_events enable row level security;

-- No policies for anon/authenticated: RLS denies them.
-- Service role bypasses RLS; grant table privileges explicitly.
revoke all on table public.webhook_events from anon;
revoke all on table public.webhook_events from authenticated;
grant all on table public.webhook_events to service_role;