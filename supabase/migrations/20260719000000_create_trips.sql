-- Trips table for PackWise packing lists
create type public.trip_type as enum (
  'business',
  'leisure',
  'beach',
  'hiking',
  'skiing',
  'city break',
  'other'
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  destination text not null,
  start_date date not null,
  end_date date not null,
  trip_type public.trip_type not null,
  travelers integer not null check (travelers >= 1),
  created_at timestamptz not null default now(),
  constraint trips_end_date_gte_start_date check (end_date >= start_date)
);

create index trips_user_id_idx on public.trips (user_id);

alter table public.trips enable row level security;

create policy "Users can select their own trips"
  on public.trips
  for select
  to authenticated
  using (auth.uid() = user_id);

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
