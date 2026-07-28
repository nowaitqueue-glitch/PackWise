-- Cached first-day weather summaries for dashboard trip cards.
-- One row per trip; refreshed when older than ~1 hour (app-side TTL).

create table public.trip_weather (
  trip_id uuid primary key references public.trips (id) on delete cascade,
  fetched_at timestamptz not null default now(),
  forecast_json jsonb not null
);

create index trip_weather_fetched_at_idx on public.trip_weather (fetched_at);

comment on table public.trip_weather is
  'Cached OpenWeatherMap first-day forecast for trips starting within ~5 days.';
comment on column public.trip_weather.forecast_json is
  'DailyForecast shape: { date, condition, highTemp, lowTemp, rainChance }.';

alter table public.trip_weather enable row level security;

-- Owners and members can read cached weather for trips they can access.
create policy "Users can select trip weather for accessible trips"
  on public.trip_weather
  for select
  to authenticated
  using (public.can_access_trip(trip_id));

-- Accessible users may refresh the cache (dashboard RSC upsert).
create policy "Users can insert trip weather for accessible trips"
  on public.trip_weather
  for insert
  to authenticated
  with check (public.can_access_trip(trip_id));

create policy "Users can update trip weather for accessible trips"
  on public.trip_weather
  for update
  to authenticated
  using (public.can_access_trip(trip_id))
  with check (public.can_access_trip(trip_id));

grant select, insert, update on table public.trip_weather to authenticated;
revoke all on table public.trip_weather from anon;
