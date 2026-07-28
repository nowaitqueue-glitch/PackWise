-- Private storage bucket for "Scan My Suitcase" photos.
-- Object path: {user_id}/{trip_id}/{uuid}.{ext}
-- Access: authenticated users who can_access_trip(trip_id).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'suitcase-scans',
  'suitcase-scans',
  false,
  10485760, -- 10 MiB
  array[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Helper: trip id from object path {user_id}/{trip_id}/{filename}
create or replace function public.suitcase_scan_trip_id(object_name text)
returns uuid
language sql
immutable
as $$
  select nullif(split_part(object_name, '/', 2), '')::uuid;
$$;

revoke all on function public.suitcase_scan_trip_id(text) from public;
grant execute on function public.suitcase_scan_trip_id(text) to authenticated;

create policy "Trip members can upload suitcase scans"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'suitcase-scans'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.can_access_trip(public.suitcase_scan_trip_id(name))
  );

create policy "Trip members can read suitcase scans"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'suitcase-scans'
    and public.can_access_trip(public.suitcase_scan_trip_id(name))
  );

create policy "Uploaders can update own suitcase scans"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'suitcase-scans'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.can_access_trip(public.suitcase_scan_trip_id(name))
  )
  with check (
    bucket_id = 'suitcase-scans'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.can_access_trip(public.suitcase_scan_trip_id(name))
  );

create policy "Uploaders can delete own suitcase scans"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'suitcase-scans'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
