-- Harden profiles: clients cannot self-grant Pro / rewrite scan quotas or Stripe ids.
--
-- Postgres RLS cannot restrict UPDATE to specific columns. The standard pattern is a
-- BEFORE UPDATE trigger that restores NEW.forbidden := OLD.forbidden for non-service_role.
-- User-editable columns remain writable under the existing UPDATE policy (auth.uid() = id):
--   display_name, avatar_url, settings, has_seen_onboarding,
--   packing_reminder_email, push_notifications.
--
-- Scan quota mutations go through SECURITY DEFINER RPCs (consume_scan_credit,
-- ensure_scan_quota). Those RPCs set a transaction-local config flag so the
-- protect trigger allows intentional quota writes (auth.role() stays authenticated).

-- ---------------------------------------------------------------------------
-- Optional profile fields (user-editable)
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists display_name text;

alter table public.profiles
  add column if not exists avatar_url text;

alter table public.profiles
  add column if not exists settings jsonb not null default '{}'::jsonb;

comment on column public.profiles.display_name is
  'Optional display name; writable by the profile owner.';
comment on column public.profiles.avatar_url is
  'Optional avatar URL; writable by the profile owner.';
comment on column public.profiles.settings is
  'Optional JSON settings bag; writable by the profile owner.';

-- Ensure is_pro defaults to false for any insert path that omits the column.
alter table public.profiles
  alter column is_pro set default false;

-- ---------------------------------------------------------------------------
-- Signup trigger: always create a free-tier profile (idempotent)
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    scans_remaining,
    scans_month,
    is_pro,
    stripe_customer_id,
    stripe_subscription_id
  )
  values (
    new.id,
    3,
    to_char(timezone('utc', now()), 'YYYY-MM'),
    false,
    null,
    null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- BEFORE INSERT: force free-tier defaults for non-service_role (defense-in-depth)
-- ---------------------------------------------------------------------------

create or replace function public.protect_profile_insert_sensitive_fields()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    new.is_pro := false;
    new.stripe_customer_id := null;
    new.stripe_subscription_id := null;
    -- Cap self-insert quota attempts even if INSERT privileges are restored later.
    new.scans_remaining := least(greatest(coalesce(new.scans_remaining, 3), 0), 3);
    new.scans_month := coalesce(
      nullif(trim(new.scans_month), ''),
      to_char(timezone('utc', now()), 'YYYY-MM')
    );
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_protect_insert_sensitive on public.profiles;
create trigger profiles_protect_insert_sensitive
  before insert on public.profiles
  for each row
  execute function public.protect_profile_insert_sensitive_fields();

-- ---------------------------------------------------------------------------
-- BEFORE UPDATE: pin quota / Pro / Stripe for non-service_role
-- ---------------------------------------------------------------------------

create or replace function public.protect_profile_billing_fields()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and coalesce(auth.role(), '') is distinct from 'service_role'
     and coalesce(
       nullif(current_setting('packwise.bypass_profile_protect', true), ''),
       ''
     ) is distinct from 'on' then
    -- Billing / entitlement
    new.is_pro := old.is_pro;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
    -- Scan quota (must use consume_scan_credit / ensure_scan_quota RPCs)
    new.scans_remaining := old.scans_remaining;
    new.scans_month := old.scans_month;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_protect_billing on public.profiles;
create trigger profiles_protect_billing
  before update on public.profiles
  for each row
  execute function public.protect_profile_billing_fields();

-- ---------------------------------------------------------------------------
-- RLS: keep self SELECT/UPDATE; drop client INSERT (signup trigger + service_role)
-- ---------------------------------------------------------------------------

drop policy if exists "Users can insert their own profile" on public.profiles;

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

revoke all on table public.profiles from anon;
revoke insert on table public.profiles from authenticated;
grant select, update on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER RPCs for scan quota (intentional bypass of column pin)
-- ---------------------------------------------------------------------------

create or replace function public.ensure_scan_quota()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_month text := to_char(timezone('utc', now()), 'YYYY-MM');
  v_row public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Allow this RPC (and nested updates) to change scans_* despite the pin trigger.
  perform set_config('packwise.bypass_profile_protect', 'on', true);

  select * into v_row
  from public.profiles
  where id = v_uid
  for update;

  if not found then
    -- Signup trigger should have created the row; create as last resort.
    -- Runs as definer (bypasses RLS); INSERT trigger still forces free-tier defaults
    -- when auth.role() is authenticated.
    insert into public.profiles (
      id, scans_remaining, scans_month, is_pro
    ) values (
      v_uid, 3, v_month, false
    )
    on conflict (id) do nothing;

    select * into v_row
    from public.profiles
    where id = v_uid
    for update;

    if not found then
      raise exception 'Profile not found';
    end if;
  end if;

  if v_row.scans_month is distinct from v_month then
    update public.profiles
    set
      scans_remaining = 3,
      scans_month = v_month,
      updated_at = now()
    where id = v_uid
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'scans_remaining', v_row.scans_remaining,
    'scans_month', v_row.scans_month,
    'is_pro', v_row.is_pro,
    'stripe_customer_id', v_row.stripe_customer_id,
    'stripe_subscription_id', v_row.stripe_subscription_id
  );
end;
$$;

create or replace function public.consume_scan_credit()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_month text := to_char(timezone('utc', now()), 'YYYY-MM');
  v_row public.profiles%rowtype;
  v_next integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  perform set_config('packwise.bypass_profile_protect', 'on', true);

  -- Locks row, resets month when needed
  perform public.ensure_scan_quota();

  select * into v_row
  from public.profiles
  where id = v_uid
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Profile not found');
  end if;

  -- Pro / active subscription: no decrement
  if v_row.is_pro is true or v_row.stripe_subscription_id is not null then
    return jsonb_build_object(
      'ok', true,
      'scans_remaining', v_row.scans_remaining,
      'is_pro', true
    );
  end if;

  if v_row.scans_remaining <= 0 then
    return jsonb_build_object(
      'ok', false,
      'error', 'No suitcase scans remaining this month.',
      'scans_remaining', 0
    );
  end if;

  v_next := v_row.scans_remaining - 1;

  update public.profiles
  set
    scans_remaining = v_next,
    scans_month = coalesce(nullif(v_row.scans_month, ''), v_month),
    updated_at = now()
  where id = v_uid
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'scans_remaining', v_row.scans_remaining,
    'is_pro', false
  );
end;
$$;

revoke all on function public.ensure_scan_quota() from public;
revoke all on function public.consume_scan_credit() from public;
grant execute on function public.ensure_scan_quota() to authenticated;
grant execute on function public.consume_scan_credit() to authenticated;
