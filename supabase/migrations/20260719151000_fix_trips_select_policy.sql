-- Fix trips SELECT policy for INSERT...RETURNING.
-- can_access_trip() -> is_trip_owner() re-queries public.trips. During
-- INSERT ... RETURNING, that nested read can fail the SELECT policy even
-- though the new row is owned by auth.uid(), which PostgREST surfaces as
-- "new row violates row-level security policy".
-- Owner check must use the row's user_id directly; membership stays via
-- security-definer is_trip_member().

drop policy if exists "Users can select owned or shared trips" on public.trips;

create policy "Users can select owned or shared trips"
  on public.trips
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_trip_member(id)
  );
