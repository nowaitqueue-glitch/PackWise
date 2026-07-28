-- Profiles for scan quotas and Pro status (auth.users is not freely writable).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  scans_remaining integer not null default 3
    check (scans_remaining >= 0),
  -- YYYY-MM of the last monthly scan quota reset
  scans_month text not null default to_char(timezone('utc', now()), 'YYYY-MM'),
  is_pro boolean not null default false,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_is_pro_idx on public.profiles (is_pro)
  where is_pro = true;

alter table public.profiles enable row level security;

create policy "Users can select their own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Allow self-insert for edge cases (e.g. users created before this migration
-- whose trigger backfill missed). Signup trigger remains the primary path.
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, scans_remaining, scans_month, is_pro)
  values (
    new.id,
    3,
    to_char(timezone('utc', now()), 'YYYY-MM'),
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row
  execute function public.handle_new_user_profile();

-- Backfill profiles for existing auth users
insert into public.profiles (id, scans_remaining, scans_month, is_pro)
select
  id,
  3,
  to_char(timezone('utc', now()), 'YYYY-MM'),
  false
from auth.users
on conflict (id) do nothing;

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

-- Prevent clients from self-granting Pro / rewriting Stripe ids.
-- Service-role (Stripe webhook) can update billing fields; authenticated users cannot.
create or replace function public.protect_profile_billing_fields()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and coalesce(auth.role(), '') is distinct from 'service_role' then
    new.is_pro := old.is_pro;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_protect_billing
  before update on public.profiles
  for each row
  execute function public.protect_profile_billing_fields();
