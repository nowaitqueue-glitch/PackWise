-- Idempotent guest to account trip claim ledger.
-- Unique (user_id, claim_key) prevents duplicate trips on retry / Strict Mode.

create table if not exists public.guest_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  claim_key text not null,
  trip_id uuid not null references public.trips (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint guest_claims_claim_key_nonempty check (char_length(trim(claim_key)) > 0),
  constraint guest_claims_user_claim_key_unique unique (user_id, claim_key)
);

create index if not exists guest_claims_user_id_idx on public.guest_claims (user_id);
create index if not exists guest_claims_trip_id_idx on public.guest_claims (trip_id);

alter table public.guest_claims enable row level security;

drop policy if exists "Users can select their own guest claims" on public.guest_claims;
create policy "Users can select their own guest claims"
  on public.guest_claims
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own guest claims" on public.guest_claims;
create policy "Users can insert their own guest claims"
  on public.guest_claims
  for insert
  to authenticated
  with check (auth.uid() = user_id);

revoke all on table public.guest_claims from anon;
grant select, insert on table public.guest_claims to authenticated;
grant all on table public.guest_claims to service_role;
