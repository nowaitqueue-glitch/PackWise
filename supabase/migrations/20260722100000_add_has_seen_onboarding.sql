-- One-time dashboard onboarding tour flag (per user).
alter table public.profiles
  add column if not exists has_seen_onboarding boolean not null default false;
