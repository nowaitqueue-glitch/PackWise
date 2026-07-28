-- Custom packing items per trip (separate from packing_lists.items JSONB).
-- SELECT: anyone who can access the trip (owner + members).
-- INSERT / UPDATE / DELETE: trip owner only (members are view-only).

create table public.packing_custom_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category text not null,
  notes text not null default '',
  packed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint packing_custom_items_name_not_empty
    check (char_length(trim(name)) > 0),
  constraint packing_custom_items_category_not_empty
    check (char_length(trim(category)) > 0)
);

create index packing_custom_items_trip_id_idx
  on public.packing_custom_items (trip_id);

create index packing_custom_items_user_id_idx
  on public.packing_custom_items (user_id);

create or replace function public.set_packing_custom_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger packing_custom_items_set_updated_at
  before update on public.packing_custom_items
  for each row
  execute function public.set_packing_custom_items_updated_at();

alter table public.packing_custom_items enable row level security;

revoke all on table public.packing_custom_items from anon;
grant select, insert, update, delete on table public.packing_custom_items
  to authenticated;

create policy "Users can select custom packing items for accessible trips"
  on public.packing_custom_items
  for select
  to authenticated
  using (public.can_access_trip(trip_id));

create policy "Owners can insert custom packing items"
  on public.packing_custom_items
  for insert
  to authenticated
  with check (
    public.is_trip_owner(trip_id)
    and user_id = auth.uid()
  );

create policy "Owners can update custom packing items"
  on public.packing_custom_items
  for update
  to authenticated
  using (public.is_trip_owner(trip_id))
  with check (
    public.is_trip_owner(trip_id)
    and user_id = auth.uid()
  );

create policy "Owners can delete custom packing items"
  on public.packing_custom_items
  for delete
  to authenticated
  using (public.is_trip_owner(trip_id));
