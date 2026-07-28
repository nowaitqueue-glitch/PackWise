-- Fix authenticated access to trips (and related tables).
-- Newer Supabase projects no longer auto-GRANT table privileges to the
-- Data API roles; RLS policies alone are not enough. Without these grants,
-- INSERT/SELECT/UPDATE/DELETE fail for authenticated JWTs while
-- service_role (which bypasses RLS and has broader privileges) still works.

-- ---------------------------------------------------------------------------
-- Table / type privileges for Data API roles
-- ---------------------------------------------------------------------------

grant usage on type public.trip_type to authenticated;

grant select, insert, update, delete on table public.trips to authenticated;
grant select, insert, update, delete on table public.packing_lists to authenticated;
grant select, insert, delete on table public.trip_members to authenticated;
grant select, insert, delete on table public.trip_invites to authenticated;

-- anon has no trip access (login required)
revoke all on table public.trips from anon;
revoke all on table public.packing_lists from anon;
revoke all on table public.trip_members from anon;
revoke all on table public.trip_invites from anon;

-- ---------------------------------------------------------------------------
-- Reaffirm trips RLS: owners mutate; owners + members select
-- ---------------------------------------------------------------------------

drop policy if exists "Users can insert their own trips" on public.trips;
drop policy if exists "Users can update their own trips" on public.trips;
drop policy if exists "Users can delete their own trips" on public.trips;
drop policy if exists "Users can select their own trips" on public.trips;
drop policy if exists "Users can select owned or shared trips" on public.trips;

create policy "Users can select owned or shared trips"
  on public.trips
  for select
  to authenticated
  using (public.can_access_trip(id));

create policy "Users can insert their own trips"
  on public.trips
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own trips"
  on public.trips
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own trips"
  on public.trips
  for delete
  to authenticated
  using (auth.uid() = user_id);
