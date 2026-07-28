-- Shared trips: members, invite tokens, and RLS helpers
-- Tables must exist before SQL-language functions that reference them.

-- ---------------------------------------------------------------------------
-- trip_members
-- ---------------------------------------------------------------------------

create table if not exists public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('member')),
  created_at timestamptz not null default now(),
  unique (trip_id, user_id)
);

create index if not exists trip_members_trip_id_idx on public.trip_members (trip_id);
create index if not exists trip_members_user_id_idx on public.trip_members (user_id);

alter table public.trip_members enable row level security;

-- ---------------------------------------------------------------------------
-- trip_invites
-- ---------------------------------------------------------------------------

create table if not exists public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  token text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists trip_invites_trip_id_idx on public.trip_invites (trip_id);
create index if not exists trip_invites_token_idx on public.trip_invites (token);

alter table public.trip_invites enable row level security;

-- ---------------------------------------------------------------------------
-- Helper functions (security definer to avoid RLS recursion)
-- ---------------------------------------------------------------------------

create or replace function public.is_trip_owner(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trips
    where id = p_trip_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_trip_member(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trip_members
    where trip_id = p_trip_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.can_access_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_trip_owner(p_trip_id) or public.is_trip_member(p_trip_id);
$$;

revoke all on function public.is_trip_owner(uuid) from public;
revoke all on function public.is_trip_member(uuid) from public;
revoke all on function public.can_access_trip(uuid) from public;
grant execute on function public.is_trip_owner(uuid) to authenticated;
grant execute on function public.is_trip_member(uuid) to authenticated;
grant execute on function public.can_access_trip(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- trip_members RLS
-- ---------------------------------------------------------------------------

drop policy if exists "Members can select trip_members for accessible trips"
  on public.trip_members;
drop policy if exists "Owners can insert trip_members"
  on public.trip_members;
drop policy if exists "Owners can delete trip_members"
  on public.trip_members;
drop policy if exists "Members can leave a trip"
  on public.trip_members;

create policy "Members can select trip_members for accessible trips"
  on public.trip_members
  for select
  to authenticated
  using (public.can_access_trip(trip_id));

create policy "Owners can insert trip_members"
  on public.trip_members
  for insert
  to authenticated
  with check (public.is_trip_owner(trip_id));

create policy "Owners can delete trip_members"
  on public.trip_members
  for delete
  to authenticated
  using (public.is_trip_owner(trip_id));

create policy "Members can leave a trip"
  on public.trip_members
  for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- trip_invites RLS
-- ---------------------------------------------------------------------------

drop policy if exists "Owners can select trip invites"
  on public.trip_invites;
drop policy if exists "Owners can insert trip invites"
  on public.trip_invites;
drop policy if exists "Owners can delete trip invites"
  on public.trip_invites;

create policy "Owners can select trip invites"
  on public.trip_invites
  for select
  to authenticated
  using (public.is_trip_owner(trip_id));

create policy "Owners can insert trip invites"
  on public.trip_invites
  for insert
  to authenticated
  with check (
    public.is_trip_owner(trip_id)
    and created_by = auth.uid()
  );

create policy "Owners can delete trip invites"
  on public.trip_invites
  for delete
  to authenticated
  using (public.is_trip_owner(trip_id));

-- ---------------------------------------------------------------------------
-- Join / email helpers (security definer — bypasses invite SELECT for redeemers)
-- ---------------------------------------------------------------------------

create or replace function public.join_trip_by_invite_token(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.trip_invites%rowtype;
  v_uid uuid := auth.uid();
  v_owner_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into v_invite
  from public.trip_invites
  where token = p_token;

  if not found then
    raise exception 'Invalid invite token';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'Invite has expired';
  end if;

  select user_id into v_owner_id
  from public.trips
  where id = v_invite.trip_id;

  if v_owner_id is null then
    raise exception 'Trip not found';
  end if;

  -- Owner already has access; no membership row needed
  if v_owner_id = v_uid then
    return v_invite.trip_id;
  end if;

  insert into public.trip_members (trip_id, user_id, role)
  values (v_invite.trip_id, v_uid, 'member')
  on conflict (trip_id, user_id) do nothing;

  return v_invite.trip_id;
end;
$$;

create or replace function public.add_trip_member_by_email(
  p_trip_id uuid,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_target_id uuid;
  v_email text := lower(trim(p_email));
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_trip_owner(p_trip_id) then
    raise exception 'Only the trip owner can add members';
  end if;

  if v_email = '' or v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_email');
  end if;

  select id
  into v_target_id
  from auth.users
  where lower(email) = v_email
  limit 1;

  if v_target_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_target_id = (
    select user_id from public.trips where id = p_trip_id
  ) then
    return jsonb_build_object('ok', false, 'reason', 'is_owner');
  end if;

  insert into public.trip_members (trip_id, user_id, role)
  values (p_trip_id, v_target_id, 'member')
  on conflict (trip_id, user_id) do nothing;

  return jsonb_build_object('ok', true, 'user_id', v_target_id);
end;
$$;

revoke all on function public.join_trip_by_invite_token(text) from public;
revoke all on function public.add_trip_member_by_email(uuid, text) from public;
grant execute on function public.join_trip_by_invite_token(text) to authenticated;
grant execute on function public.add_trip_member_by_email(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Update trips RLS: owner OR member can select
-- ---------------------------------------------------------------------------

drop policy if exists "Users can select their own trips" on public.trips;
drop policy if exists "Users can select owned or shared trips" on public.trips;

create policy "Users can select owned or shared trips"
  on public.trips
  for select
  to authenticated
  using (public.can_access_trip(id));

-- Insert / update / delete remain owner-only (existing policies)

-- ---------------------------------------------------------------------------
-- Update packing_lists RLS: members can select + update (checkoffs)
-- ---------------------------------------------------------------------------

drop policy if exists "Users can select packing lists for their own trips"
  on public.packing_lists;
drop policy if exists "Users can update packing lists for their own trips"
  on public.packing_lists;
drop policy if exists "Users can insert packing lists for their own trips"
  on public.packing_lists;
drop policy if exists "Users can delete packing lists for their own trips"
  on public.packing_lists;
drop policy if exists "Users can select packing lists for accessible trips"
  on public.packing_lists;
drop policy if exists "Owners can insert packing lists"
  on public.packing_lists;
drop policy if exists "Users can update packing lists for accessible trips"
  on public.packing_lists;
drop policy if exists "Owners can delete packing lists"
  on public.packing_lists;

create policy "Users can select packing lists for accessible trips"
  on public.packing_lists
  for select
  to authenticated
  using (public.can_access_trip(trip_id));

create policy "Owners can insert packing lists"
  on public.packing_lists
  for insert
  to authenticated
  with check (public.is_trip_owner(trip_id));

create policy "Users can update packing lists for accessible trips"
  on public.packing_lists
  for update
  to authenticated
  using (public.can_access_trip(trip_id))
  with check (public.can_access_trip(trip_id));

create policy "Owners can delete packing lists"
  on public.packing_lists
  for delete
  to authenticated
  using (public.is_trip_owner(trip_id));
