-- Notification preferences on profiles (settings hub).
alter table public.profiles
  add column if not exists packing_reminder_email boolean not null default true;

alter table public.profiles
  add column if not exists push_notifications boolean not null default true;

comment on column public.profiles.packing_reminder_email is
  'When true, user may receive packing reminder emails for upcoming trips.';

comment on column public.profiles.push_notifications is
  'When true, user prefers browser push notifications (permission still required).';
