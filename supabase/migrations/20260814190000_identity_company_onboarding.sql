begin;

alter table public.profiles
  add column if not exists phone text,
  add column if not exists avatar_url text,
  add column if not exists locale text not null default 'pt-BR';

alter table public.companies
  add column if not exists slug text,
  add column if not exists description text,
  add column if not exists phone text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists onboarding_completed_at timestamptz;

create unique index if not exists companies_slug_unique_idx on public.companies(slug) where slug is not null;

create table if not exists public.company_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  working_days smallint[] not null default array[1,2,3,4,5],
  workday_start time not null default '08:00',
  workday_end time not null default '18:00',
  monitor_appointments boolean not null default true,
  monitor_orders boolean not null default true,
  monitor_quotes boolean not null default true,
  monitor_payment_promises boolean not null default true,
  monitor_follow_ups boolean not null default true,
  monitor_awaiting_reply boolean not null default true,
  monitor_deadlines boolean not null default true,
  monitor_tasks boolean not null default true,
  default_reminder_minutes integer not null default 60 check (default_reminder_minutes between 0 and 10080),
  ai_mode text not null default 'observe' check (ai_mode in ('observe')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_company_id uuid references public.companies(id) on delete set null,
  notifications_enabled boolean not null default true,
  daily_summary_enabled boolean not null default true,
  daily_summary_time time not null default '07:30',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.company_settings(company_id)
select id from public.companies
on conflict (company_id) do nothing;

insert into public.user_preferences(user_id)
select id from auth.users
on conflict (user_id) do nothing;

update public.user_preferences up
set current_company_id = candidate.company_id
from (
  select distinct on (cm.user_id) cm.user_id, cm.company_id
  from public.company_members cm
  order by cm.user_id, cm.created_at asc
) candidate
where up.user_id = candidate.user_id and up.current_company_id is null;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_updated_at();

drop trigger if exists companies_touch_updated_at on public.companies;
create trigger companies_touch_updated_at before update on public.companies for each row execute function public.touch_updated_at();

drop trigger if exists company_settings_touch_updated_at on public.company_settings;
create trigger company_settings_touch_updated_at before update on public.company_settings for each row execute function public.touch_updated_at();

drop trigger if exists user_preferences_touch_updated_at on public.user_preferences;
create trigger user_preferences_touch_updated_at before update on public.user_preferences for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name',''),
    nullif(new.raw_user_meta_data->>'phone','')
  )
  on conflict (id) do update set
    display_name = case when excluded.display_name <> '' then excluded.display_name else public.profiles.display_name end,
    phone = coalesce(excluded.phone, public.profiles.phone);

  insert into public.user_preferences(user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create or replace function public.handle_new_company()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.company_members(company_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (company_id, user_id) do update set role = 'owner';

  insert into public.company_settings(company_id) values (new.id) on conflict do nothing;

  insert into public.user_preferences(user_id, current_company_id)
  values (new.created_by, new.id)
  on conflict (user_id) do update set current_company_id = coalesce(public.user_preferences.current_company_id, excluded.current_company_id);

  return new;
end;
$$;

create or replace function public.company_role_for(target_company_id uuid)
returns public.company_role language sql stable security definer set search_path = public as $$
  select cm.role
  from public.company_members cm
  where cm.company_id = target_company_id and cm.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_company_admin(target_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.company_role_for(target_company_id) in ('owner','admin'), false);
$$;

alter table public.company_settings enable row level security;
alter table public.user_preferences enable row level security;

-- Restringe edição da empresa a proprietário/administrador.
drop policy if exists "companies members update" on public.companies;
create policy "companies admin update" on public.companies
for update using (public.is_company_admin(id))
with check (public.is_company_admin(id));

-- Corrige a política inicial para impedir que qualquer membro convide/eleve outro membro.
drop policy if exists "company members owner insert" on public.company_members;
create policy "company members admin insert" on public.company_members
for insert with check (public.is_company_admin(company_id));

create policy "company members admin update" on public.company_members
for update using (public.is_company_admin(company_id))
with check (public.is_company_admin(company_id));

create policy "company members admin delete" on public.company_members
for delete using (public.is_company_admin(company_id) and user_id <> auth.uid());

create policy "company settings member read" on public.company_settings
for select using (public.is_company_member(company_id));

create policy "company settings admin write" on public.company_settings
for all using (public.is_company_admin(company_id))
with check (public.is_company_admin(company_id));

create policy "user preferences own read" on public.user_preferences
for select using (user_id = auth.uid());

create policy "user preferences own insert" on public.user_preferences
for insert with check (
  user_id = auth.uid()
  and (current_company_id is null or public.is_company_member(current_company_id))
);

create policy "user preferences own update" on public.user_preferences
for update using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (current_company_id is null or public.is_company_member(current_company_id))
);

-- Um membro pode escolher como empresa atual apenas uma empresa à qual pertence.
create or replace function public.set_current_company(target_company_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_company_member(target_company_id) then
    raise exception 'not_company_member';
  end if;

  insert into public.user_preferences(user_id, current_company_id)
  values (auth.uid(), target_company_id)
  on conflict (user_id) do update set current_company_id = excluded.current_company_id;
end;
$$;

grant execute on function public.set_current_company(uuid) to authenticated;

commit;
