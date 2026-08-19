alter table public.contacts
  add column if not exists shared_number_confirmed boolean not null default false;

grant select, update on table public.contacts to authenticated;
