-- Defense-in-depth: explicitly revoke all table privileges from anon.
-- Authenticated / service_role grants are intentionally left unchanged.

revoke all on table public.profiles from anon;
revoke all on table public.trips from anon;
revoke all on table public.packing_lists from anon;
revoke all on table public.trip_weather from anon;
revoke all on table public.trip_members from anon;
revoke all on table public.trip_invites from anon;
