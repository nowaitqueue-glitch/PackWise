-- Suitcase scans: switch object path to {trip_id}/{user_id}/{filename}
-- and tighten RLS so SELECT/UPDATE/DELETE are own user_id folder only.
-- INSERT still requires can_access_trip(trip_id) and path user_id = auth.uid().
--
-- Caveat: existing objects under the old layout {user_id}/{trip_id}/… will no
-- longer match these policies and will not be readable via RLS until re-uploaded
-- or migrated.

-- Trip id is now the first path segment
create or replace function public.suitcase_scan_trip_id(object_name text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(object_name, '/', 1), '')::uuid;
$$;

revoke all on function public.suitcase_scan_trip_id(text) from public;
grant execute on function public.suitcase_scan_trip_id(text) to authenticated;

-- Uploader id is the second path segment
create or replace function public.suitcase_scan_user_id(object_name text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(object_name, '/', 2), '')::uuid;
$$;

revoke all on function public.suitcase_scan_user_id(text) from public;
grant execute on function public.suitcase_scan_user_id(text) to authenticated;

drop policy if exists "Trip members can upload suitcase scans" on storage.objects;
drop policy if exists "Trip members can read suitcase scans" on storage.objects;
drop policy if exists "Uploaders can update own suitcase scans" on storage.objects;
drop policy if exists "Uploaders can delete own suitcase scans" on storage.objects;

create policy "Users can upload own suitcase scans"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'suitcase-scans'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.can_access_trip(public.suitcase_scan_trip_id(name))
  );

-- Own uploads only — trip members cannot read each others' suitcase photos
create policy "Users can read own suitcase scans"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'suitcase-scans'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "Users can update own suitcase scans"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'suitcase-scans'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'suitcase-scans'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.can_access_trip(public.suitcase_scan_trip_id(name))
  );

create policy "Users can delete own suitcase scans"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'suitcase-scans'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
