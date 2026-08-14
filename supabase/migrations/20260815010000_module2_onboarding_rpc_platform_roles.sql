begin;

-- ============================================================
-- Módulo 2: onboarding transacional e base segura de plataforma
-- ============================================================
-- O onboarding deixa de depender de escrita direta do navegador nas
-- tabelas principais. As funções abaixo validam autenticação/permissão
-- no banco e preservam o isolamento multiempresa.

create or replace function public.onboarding_save_company(
  target_company_id uuid,
  company_name text,
  company_business_type text,
  company_phone text,
  company_city text,
  company_state text,
  company_timezone text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result_id uuid;
  clean_name text := nullif(btrim(company_name), '');
  clean_state text := upper(nullif(btrim(company_state), ''));
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  if clean_name is null then
    raise exception 'company_name_required';
  end if;
  if clean_state is not null and char_length(clean_state) > 2 then
    raise exception 'invalid_state';
  end if;

  if target_company_id is null then
    insert into public.companies(
      name, business_type, phone, city, state, timezone, created_by
    ) values (
      clean_name,
      nullif(btrim(company_business_type), ''),
      nullif(btrim(company_phone), ''),
      nullif(btrim(company_city), ''),
      clean_state,
      coalesce(nullif(btrim(company_timezone), ''), 'America/Manaus'),
      uid
    )
    returning id into result_id;
  else
    if not public.is_company_admin(target_company_id) then
      raise exception 'not_company_admin';
    end if;

    update public.companies
    set name = clean_name,
        business_type = nullif(btrim(company_business_type), ''),
        phone = nullif(btrim(company_phone), ''),
        city = nullif(btrim(company_city), ''),
        state = clean_state,
        timezone = coalesce(nullif(btrim(company_timezone), ''), timezone)
    where id = target_company_id
    returning id into result_id;

    if result_id is null then
      raise exception 'company_not_found';
    end if;
  end if;

  return result_id;
end;
$$;

create or replace function public.onboarding_save_schedule(
  target_company_id uuid,
  target_working_days smallint[],
  target_workday_start time,
  target_workday_end time
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_company_admin(target_company_id) then
    raise exception 'not_company_admin';
  end if;
  if target_working_days is null or cardinality(target_working_days) = 0 then
    raise exception 'working_days_required';
  end if;
  if exists (select 1 from unnest(target_working_days) d where d < 0 or d > 6) then
    raise exception 'invalid_working_day';
  end if;

  insert into public.company_settings(company_id, working_days, workday_start, workday_end)
  values (
    target_company_id,
    (select array_agg(distinct d order by d) from unnest(target_working_days) d),
    target_workday_start,
    target_workday_end
  )
  on conflict (company_id) do update
  set working_days = excluded.working_days,
      workday_start = excluded.workday_start,
      workday_end = excluded.workday_end;
end;
$$;

create or replace function public.onboarding_save_monitors(
  target_company_id uuid,
  target_monitor_appointments boolean,
  target_monitor_orders boolean,
  target_monitor_quotes boolean,
  target_monitor_payment_promises boolean,
  target_monitor_follow_ups boolean,
  target_monitor_awaiting_reply boolean,
  target_monitor_deadlines boolean,
  target_monitor_tasks boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_company_admin(target_company_id) then
    raise exception 'not_company_admin';
  end if;

  insert into public.company_settings(
    company_id,
    monitor_appointments,
    monitor_orders,
    monitor_quotes,
    monitor_payment_promises,
    monitor_follow_ups,
    monitor_awaiting_reply,
    monitor_deadlines,
    monitor_tasks
  ) values (
    target_company_id,
    target_monitor_appointments,
    target_monitor_orders,
    target_monitor_quotes,
    target_monitor_payment_promises,
    target_monitor_follow_ups,
    target_monitor_awaiting_reply,
    target_monitor_deadlines,
    target_monitor_tasks
  )
  on conflict (company_id) do update
  set monitor_appointments = excluded.monitor_appointments,
      monitor_orders = excluded.monitor_orders,
      monitor_quotes = excluded.monitor_quotes,
      monitor_payment_promises = excluded.monitor_payment_promises,
      monitor_follow_ups = excluded.monitor_follow_ups,
      monitor_awaiting_reply = excluded.monitor_awaiting_reply,
      monitor_deadlines = excluded.monitor_deadlines,
      monitor_tasks = excluded.monitor_tasks;
end;
$$;

create or replace function public.onboarding_complete(target_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_company_admin(target_company_id) then
    raise exception 'not_company_admin';
  end if;

  update public.companies
  set onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = target_company_id;

  if not found then
    raise exception 'company_not_found';
  end if;
end;
$$;

revoke all on function public.onboarding_save_company(uuid,text,text,text,text,text,text) from public, anon;
revoke all on function public.onboarding_save_schedule(uuid,smallint[],time,time) from public, anon;
revoke all on function public.onboarding_save_monitors(uuid,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) from public, anon;
revoke all on function public.onboarding_complete(uuid) from public, anon;

grant execute on function public.onboarding_save_company(uuid,text,text,text,text,text,text) to authenticated;
grant execute on function public.onboarding_save_schedule(uuid,smallint[],time,time) to authenticated;
grant execute on function public.onboarding_save_monitors(uuid,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;
grant execute on function public.onboarding_complete(uuid) to authenticated;

-- ============================================================
-- Base permanente para administração da plataforma
-- ============================================================
-- Há duas camadas de autorização independentes:
-- 1) company_members controla o que uma pessoa pode fazer numa empresa;
-- 2) platform_admins controla acesso administrativo ao SaaS.
-- Um owner de empresa NÃO se torna administrador da plataforma.

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('master','support','billing','viewer')),
  is_active boolean not null default true,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_user_controls (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','suspended','blocked')),
  reason text,
  effective_until timestamptz,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  target_company_id uuid references public.companies(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
alter table public.platform_user_controls enable row level security;
alter table public.platform_audit_logs enable row level security;

-- Nenhuma tabela administrativa é exposta diretamente à Data API do navegador.
revoke all on table public.platform_admins from anon, authenticated;
revoke all on table public.platform_user_controls from anon, authenticated;
revoke all on table public.platform_audit_logs from anon, authenticated;

create or replace function public.get_my_platform_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select pa.role
  from public.platform_admins pa
  where pa.user_id = auth.uid() and pa.is_active = true
  limit 1;
$$;

create or replace function public.is_platform_admin(required_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.platform_admins pa
    where pa.user_id = auth.uid()
      and pa.is_active = true
      and (required_roles is null or pa.role = any(required_roles))
  );
$$;

revoke all on function public.get_my_platform_role() from public, anon;
revoke all on function public.is_platform_admin(text[]) from public, anon;
grant execute on function public.get_my_platform_role() to authenticated;
grant execute on function public.is_platform_admin(text[]) to authenticated;

commit;
