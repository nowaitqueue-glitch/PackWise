-- Lock profile columns: authenticated clients cannot change quota / Pro / Stripe fields.
--
-- Builds on 20260722210000_harden_profiles_sensitive_columns.sql (trigger + RPCs).
-- Postgres RLS has no native per-column UPDATE list, so this migration:
--   1) Recreates the own-row UPDATE policy (idempotent DROP + CREATE)
--   2) Revokes table-level UPDATE and grants UPDATE only on user-editable columns
--      (display_name, avatar_url, settings, has_seen_onboarding, notification prefs)
--   3) Hardens the BEFORE UPDATE trigger to RAISE if scans_remaining / scans_month /
--      is_pro would change (unless service_role or packwise.bypass_profile_protect
--      for consume_scan_credit / ensure_scan_quota RPCs)
-- Stripe customer/subscription ids remain pinned for non-service_role / non-RPC paths.
-- Service role (Stripe webhook) retains full UPDATE and bypasses the protect trigger.
--
-- Note: avoid SELECT-from-profiles inside WITH CHECK (RLS recursion hazard).
-- Column grants + RAISE trigger are the supported pattern here.
-- Filename keeps 20260723000000 so it runs after harden / suitcase RLS migrations.

-- ---------------------------------------------------------------------------
-- RLS: authenticated users may update only their own profile row
-- ---------------------------------------------------------------------------

drop policy if exists "Users can update their own profile" on public.profiles;

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Column privileges: clients may only SET safe profile fields
-- (attempts to SET scans_remaining / scans_month / is_pro fail with permission denied)
-- ---------------------------------------------------------------------------

revoke update on table public.profiles from authenticated;

grant update (
  display_name,
  avatar_url,
  settings,
  has_seen_onboarding,
  packing_reminder_email,
  push_notifications
) on table public.profiles to authenticated;

grant select on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

-- ---------------------------------------------------------------------------
-- Trigger: reject quota/Pro mutations; pin Stripe ids
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
    if new.is_pro is distinct from old.is_pro
       or new.scans_remaining is distinct from old.scans_remaining
       or new.scans_month is distinct from old.scans_month then
      raise exception
        'Updating scans_remaining, scans_month, or is_pro is not allowed'
        using errcode = '42501';
    end if;

    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
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
