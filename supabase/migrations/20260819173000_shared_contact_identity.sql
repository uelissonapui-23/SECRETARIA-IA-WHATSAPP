alter table public.contacts
  add column if not exists profile_name text,
  add column if not exists identified_names text[] not null default '{}',
  add column if not exists shared_number_suspected boolean not null default false,
  add column if not exists identity_alert text;

grant select, insert, update on table public.contacts to service_role;
