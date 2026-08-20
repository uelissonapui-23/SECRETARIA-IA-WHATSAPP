begin;

create table if not exists public.contact_people (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  aliases text[] not null default '{}',
  source text not null default 'manual' check (source in ('profile','message','manual','confirmed')),
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(contact_id,name)
);
create index if not exists contact_people_company_contact_idx on public.contact_people(company_id,contact_id,is_active);

alter table public.contact_people enable row level security;
drop policy if exists "contact people member manage" on public.contact_people;
create policy "contact people member manage" on public.contact_people for all
using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
grant select,insert,update,delete on public.contact_people to authenticated;

alter table public.appointments add column if not exists person_id uuid references public.contact_people(id) on delete set null;
alter table public.tasks add column if not exists person_id uuid references public.contact_people(id) on delete set null;
alter table public.work_items add column if not exists person_id uuid references public.contact_people(id) on delete set null;
alter table public.operational_memories add column if not exists person_id uuid references public.contact_people(id) on delete set null;

insert into public.contact_people(company_id,contact_id,name,source,is_primary)
select c.company_id,c.id,n.name,'confirmed',lower(n.name)=lower(coalesce(c.name,''))
from public.contacts c cross join lateral unnest(coalesce(c.identified_names,'{}'::text[])) n(name)
where length(trim(n.name))>=2
on conflict do nothing;

insert into public.contact_people(company_id,contact_id,name,source,is_primary)
select c.company_id,c.id,c.name,'profile',true from public.contacts c
where c.name is not null and length(trim(c.name))>=2
on conflict do nothing;

create or replace function public.copy_suggestion_person_name()
returns trigger language plpgsql security definer set search_path=public as $$
declare selected_name text;
begin
  if new.person_name is null and new.suggestion_id is not null then
    select nullif(extracted_data->>'person_name','') into selected_name from public.ai_suggestions where id=new.suggestion_id;
    new.person_name:=selected_name;
  else selected_name:=new.person_name;
  end if;
  if new.person_id is null and new.contact_id is not null and selected_name is not null then
    select id into new.person_id from public.contact_people
    where contact_id=new.contact_id and is_active and lower(name)=lower(selected_name) limit 1;
  end if;
  return new;
end $$;

drop trigger if exists appointments_copy_person on public.appointments;
create trigger appointments_copy_person before insert or update of suggestion_id,person_name,person_id on public.appointments for each row execute function public.copy_suggestion_person_name();
drop trigger if exists tasks_copy_person on public.tasks;
create trigger tasks_copy_person before insert or update of suggestion_id,person_name,person_id on public.tasks for each row execute function public.copy_suggestion_person_name();
drop trigger if exists work_items_copy_person on public.work_items;
create trigger work_items_copy_person before insert or update of suggestion_id,person_name,person_id on public.work_items for each row execute function public.copy_suggestion_person_name();

commit;
