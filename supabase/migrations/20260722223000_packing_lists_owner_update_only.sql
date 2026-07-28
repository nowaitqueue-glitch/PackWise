-- Restrict packing_lists UPDATE to trip owners only.
-- Members retain SELECT via can_access_trip; they can no longer modify items/checkoffs.

drop policy if exists "Users can update packing lists for accessible trips"
  on public.packing_lists;
drop policy if exists "Owners can update packing lists"
  on public.packing_lists;

create policy "Owners can update packing lists"
  on public.packing_lists
  for update
  to authenticated
  using (public.is_trip_owner(trip_id))
  with check (public.is_trip_owner(trip_id));
