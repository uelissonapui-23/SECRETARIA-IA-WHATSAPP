begin;

-- RPC robusta da etapa 2 do onboarding.
-- Recebe um único JSONB para evitar fragilidade de resolução de tipos da Data API
-- em arrays smallint[] e time, valida no banco e retorna o que foi persistido.
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
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'invalid_schedule_payload';
  end if;

  begin
    target_company_id := nullif(payload->>'company_id', '')::uuid;
  exception when others then
    raise exception 'invalid_company_id';
  end;

  if target_company_id is null then
    raise exception 'company_not_found';
  end if;

  if not public.is_company_admin(target_company_id) then
    raise exception 'not_company_admin';
  end if;

  if jsonb_typeof(payload->'working_days') <> 'array' then
    raise exception 'working_days_required';
  end if;

  select coalesce(array_agg(distinct value::smallint order by value::smallint), '{}'::smallint[])
    into target_working_days
  from jsonb_array_elements_text(payload->'working_days') as item(value)
  where value ~ '^[0-6]$';

  if cardinality(target_working_days) = 0 then
    raise exception 'working_days_required';
  end if;

  begin
    target_workday_start := coalesce(nullif(payload->>'workday_start', ''), '08:00')::time;
    target_workday_end := coalesce(nullif(payload->>'workday_end', ''), '18:00')::time;
  exception when others then
    raise exception 'invalid_working_hours';
  end;

  if target_workday_end <= target_workday_start then
    raise exception 'invalid_working_hours_range';
  end if;

  insert into public.company_settings(company_id, working_days, workday_start, workday_end)
  values (target_company_id, target_working_days, target_workday_start, target_workday_end)
  on conflict (company_id) do update
  set working_days = excluded.working_days,
      workday_start = excluded.workday_start,
      workday_end = excluded.workday_end,
      updated_at = now();

  select jsonb_build_object(
    'company_id', cs.company_id,
    'working_days', cs.working_days,
    'workday_start', to_char(cs.workday_start, 'HH24:MI'),
    'workday_end', to_char(cs.workday_end, 'HH24:MI')
  ) into result
  from public.company_settings cs
  where cs.company_id = target_company_id;

  return result;
end;
$$;

revoke all on function public.onboarding_save_schedule_v2(jsonb) from public, anon;
grant execute on function public.onboarding_save_schedule_v2(jsonb) to authenticated;

commit;
