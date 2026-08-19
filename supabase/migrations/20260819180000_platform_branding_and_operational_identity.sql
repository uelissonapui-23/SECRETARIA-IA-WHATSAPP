create table if not exists public.platform_branding (
  id smallint primary key default 1 check (id = 1),
  app_name text not null default 'evoria Secretaria IA',
  short_name text not null default 'evoria',
  full_logo_url text,
  menu_logo_url text,
  login_logo_url text,
  favicon_url text,
  app_icon_192_url text,
  app_icon_512_url text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
insert into public.platform_branding(id) values(1) on conflict(id) do nothing;
alter table public.platform_branding enable row level security;

create or replace function public.is_platform_master()
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_platform_admin(array['master']::text[]);
$$;
drop policy if exists "branding master manage" on public.platform_branding;
create policy "branding master manage" on public.platform_branding for all to authenticated using(public.is_platform_master()) with check(public.is_platform_master());
grant select,insert,update on public.platform_branding to authenticated;

create or replace function public.get_platform_branding()
returns table(app_name text,short_name text,full_logo_url text,menu_logo_url text,login_logo_url text,favicon_url text,app_icon_192_url text,app_icon_512_url text)
language sql stable security definer set search_path=public as $$ select b.app_name,b.short_name,b.full_logo_url,b.menu_logo_url,b.login_logo_url,b.favicon_url,b.app_icon_192_url,b.app_icon_512_url from public.platform_branding b where b.id=1 $$;
grant execute on function public.get_platform_branding() to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('platform-branding','platform-branding',true,5242880,array['image/png','image/jpeg','image/webp','image/svg+xml','image/x-icon'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "branding master upload" on storage.objects;
drop policy if exists "branding master update" on storage.objects;
drop policy if exists "branding master delete" on storage.objects;
create policy "branding master upload" on storage.objects for insert to authenticated with check(bucket_id='platform-branding' and public.is_platform_master());
create policy "branding master update" on storage.objects for update to authenticated using(bucket_id='platform-branding' and public.is_platform_master());
create policy "branding master delete" on storage.objects for delete to authenticated using(bucket_id='platform-branding' and public.is_platform_master());

alter table public.appointments add column if not exists person_name text;
alter table public.tasks add column if not exists person_name text;
alter table public.work_items add column if not exists person_name text;
alter table public.contacts add column if not exists current_person_name text;

create or replace function public.copy_suggestion_person_name()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.person_name is null and new.suggestion_id is not null then select nullif(extracted_data->>'person_name','') into new.person_name from public.ai_suggestions where id=new.suggestion_id; end if;
  return new;
end $$;
drop trigger if exists appointments_copy_person on public.appointments;
create trigger appointments_copy_person before insert or update of suggestion_id on public.appointments for each row execute function public.copy_suggestion_person_name();
drop trigger if exists tasks_copy_person on public.tasks;
create trigger tasks_copy_person before insert or update of suggestion_id on public.tasks for each row execute function public.copy_suggestion_person_name();
drop trigger if exists work_items_copy_person on public.work_items;
create trigger work_items_copy_person before insert or update of suggestion_id on public.work_items for each row execute function public.copy_suggestion_person_name();
