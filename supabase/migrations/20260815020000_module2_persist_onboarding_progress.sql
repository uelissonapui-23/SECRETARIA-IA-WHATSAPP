begin;

-- O progresso do onboarding precisa ser persistente. O AppGuard pode desmontar
-- e remontar o wizard sempre que o CompanyProvider recarrega; sem este estado,
-- uma empresa incompleta sempre voltava para a etapa 2.
alter table public.companies
  add column if not exists onboarding_step smallint not null default 1
  check (onboarding_step between 1 and 4);

-- Empresas que já foram criadas antes desta migration necessariamente concluíram
-- a primeira etapa. Empresas finalizadas permanecem marcadas na etapa 4.
update public.companies
set onboarding_step = case
  when onboarding_completed_at is not null then 4
  else greatest(onboarding_step, 2)
end;

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
  if uid is null then raise exception 'not_authenticated'; end if;
  if clean_name is null then raise exception 'company_name_required'; end if;
  if clean_state is not null and char_length(clean_state) > 2 then raise exception 'invalid_state'; end if;

  if target_company_id is null then
    insert into public.companies(
      name, business_type, phone, city, state, timezone, created_by, onboarding_step
    ) values (
      clean_name,
      nullif(btrim(company_business_type), ''),
      nullif(btrim(company_phone), ''),
      nullif(btrim(company_city), ''),
      clean_state,
      coalesce(nullif(btrim(company_timezone), ''), 'America/Manaus'),
      uid,
      2
    ) returning id into result_id;
  else
    if not public.is_company_admin(target_company_id) then raise exception 'not_company_admin'; end if;

    update public.companies
    set name = clean_name,
        business_type = nullif(btrim(company_business_type), ''),
        phone = nullif(btrim(company_phone), ''),
        city = nullif(btrim(company_city), ''),
        state = clean_state,
        timezone = coalesce(nullif(btrim(company_timezone), ''), timezone),
        onboarding_step = greatest(onboarding_step, 2)
    where id = target_company_id
    returning id into result_id;

    if result_id is null then raise exception 'company_not_found'; end if;
  end if;

  return result_id;
end;
$$;

create or replace function public.onboarding_save_schedule_v2(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target_company_id uuid;
  target_working_days smallint[];
  target_workday_start time;
  target_workday_end time;
  result jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if payload is null or jsonb_typeof(payload) <> 'object' then raise exception 'invalid_schedule_payload'; end if;

  begin
    target_company_id := nullif(payload->>'company_id', '')::uuid;
  exception when others then
    raise exception 'invalid_company_id';
  end;

  if target_company_id is null then raise exception 'company_not_found'; end if;
  if not public.is_company_admin(target_company_id) then raise exception 'not_company_admin'; end if;
  if jsonb_typeof(payload->'working_days') <> 'array' then raise exception 'working_days_required'; end if;

  select coalesce(array_agg(distinct value::smallint order by value::smallint), '{}'::smallint[])
    into target_working_days
  from jsonb_array_elements_text(payload->'working_days') as item(value)
  where value ~ '^[0-6]$';

  if cardinality(target_working_days) = 0 then raise exception 'working_days_required'; end if;

  begin
    target_workday_start := coalesce(nullif(payload->>'workday_start', ''), '08:00')::time;
    target_workday_end := coalesce(nullif(payload->>'workday_end', ''), '18:00')::time;
  exception when others then
    raise exception 'invalid_working_hours';
  end;

  if target_workday_end <= target_workday_start then raise exception 'invalid_working_hours_range'; end if;

  insert into public.company_settings(company_id, working_days, workday_start, workday_end)
  values (target_company_id, target_working_days, target_workday_start, target_workday_end)
  on conflict (company_id) do update
  set working_days = excluded.working_days,
      workday_start = excluded.workday_start,
      workday_end = excluded.workday_end,
      updated_at = now();

  update public.companies
  set onboarding_step = greatest(onboarding_step, 3), updated_at = now()
  where id = target_company_id;

  select jsonb_build_object(
    'company_id', cs.company_id,
    'working_days', cs.working_days,
    'workday_start', to_char(cs.workday_start, 'HH24:MI'),
    'workday_end', to_char(cs.workday_end, 'HH24:MI'),
    'onboarding_step', 3
  ) into result
  from public.company_settings cs
  where cs.company_id = target_company_id;

  return result;
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
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_company_admin(target_company_id) then raise exception 'not_company_admin'; end if;

  insert into public.company_settings(
    company_id, monitor_appointments, monitor_orders, monitor_quotes,
    monitor_payment_promises, monitor_follow_ups, monitor_awaiting_reply,
    monitor_deadlines, monitor_tasks
  ) values (
    target_company_id, target_monitor_appointments, target_monitor_orders,
    target_monitor_quotes, target_monitor_payment_promises, target_monitor_follow_ups,
    target_monitor_awaiting_reply, target_monitor_deadlines, target_monitor_tasks
  )
  on conflict (company_id) do update
  set monitor_appointments = excluded.monitor_appointments,
      monitor_orders = excluded.monitor_orders,
      monitor_quotes = excluded.monitor_quotes,
      monitor_payment_promises = excluded.monitor_payment_promises,
      monitor_follow_ups = excluded.monitor_follow_ups,
      monitor_awaiting_reply = excluded.monitor_awaiting_reply,
      monitor_deadlines = excluded.monitor_deadlines,
      monitor_tasks = excluded.monitor_tasks,
      updated_at = now();

  update public.companies
  set onboarding_step = greatest(onboarding_step, 4), updated_at = now()
  where id = target_company_id;
end;
$$;

create or replace function public.onboarding_complete(target_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_company_admin(target_company_id) then raise exception 'not_company_admin'; end if;

  update public.companies
  set onboarding_completed_at = coalesce(onboarding_completed_at, now()),
      onboarding_step = 4,
      updated_at = now()
  where id = target_company_id;

  if not found then raise exception 'company_not_found'; end if;
end;
$$;

-- Reafirma as permissões das RPCs substituídas.
revoke all on function public.onboarding_save_company(uuid,text,text,text,text,text,text) from public, anon;
revoke all on function public.onboarding_save_schedule_v2(jsonb) from public, anon;
revoke all on function public.onboarding_save_monitors(uuid,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) from public, anon;
revoke all on function public.onboarding_complete(uuid) from public, anon;

grant execute on function public.onboarding_save_company(uuid,text,text,text,text,text,text) to authenticated;
grant execute on function public.onboarding_save_schedule_v2(jsonb) to authenticated;
grant execute on function public.onboarding_save_monitors(uuid,boolean,boolean,boolean,boolean,boolean,boolean,boolean,boolean) to authenticated;
grant execute on function public.onboarding_complete(uuid) to authenticated;

commit;
