begin;

-- Consolidação operacional: alertas úteis, memória estruturada e base da Área Master.

alter table public.work_items drop constraint if exists work_items_type_check;
alter table public.work_items
  add constraint work_items_type_check
  check (type in ('order','service','quote','payment','follow_up','deadline','awaiting_reply'));

alter table public.app_notifications
  add column if not exists severity text not null default 'info' check (severity in ('info','success','warning','danger')),
  add column if not exists dedupe_key text;

create unique index if not exists app_notifications_company_user_dedupe_idx
  on public.app_notifications(company_id, user_id, dedupe_key)
  where user_id is not null and dedupe_key is not null;

create table if not exists public.operational_memories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  kind text not null default 'context' check (kind in ('context','preference','commitment','important','instruction')),
  content text not null,
  source text not null default 'manual' check (source in ('manual','conversation','assistant','system')),
  importance text not null default 'normal' check (importance in ('low','normal','high')),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists operational_memories_company_contact_idx
  on public.operational_memories(company_id, contact_id, is_active, created_at desc);

drop trigger if exists operational_memories_touch_updated_at on public.operational_memories;
create trigger operational_memories_touch_updated_at
before update on public.operational_memories
for each row execute function public.touch_updated_at();

alter table public.operational_memories enable row level security;
create policy "operational memories member select" on public.operational_memories
for select using (public.is_company_member(company_id));
create policy "operational memories member write" on public.operational_memories
for all using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

grant select, insert, update, delete on table public.operational_memories to authenticated;

create or replace function public.refresh_company_notifications(target_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg public.company_settings%rowtype;
  company_tz text;
  local_now timestamp;
  local_day date;
  inserted_count integer := 0;
  row_count integer := 0;
  task_count integer := 0;
  work_count integer := 0;
  suggestion_count integer := 0;
  appointment_count integer := 0;
begin
  if uid is null or not public.is_company_member(target_company_id) then
    raise exception 'not_company_member' using errcode = '42501';
  end if;

  select * into cfg from public.company_settings where company_id = target_company_id;
  select timezone into company_tz from public.companies where id = target_company_id;

  if cfg.company_id is null or coalesce(cfg.notifications_enabled, true) = false then
    return jsonb_build_object('inserted', 0, 'enabled', false);
  end if;

  company_tz := coalesce(nullif(company_tz,''), 'America/Manaus');
  local_now := now() at time zone company_tz;
  local_day := local_now::date;

  if coalesce(cfg.notify_overdue, true) then
    insert into public.app_notifications(company_id,user_id,kind,severity,title,body,link,dedupe_key)
    select target_company_id, uid, 'overdue_task', 'danger', 'Tarefa atrasada', t.title, '/trabalho', 'task-overdue:'||t.id::text
    from public.tasks t
    where t.company_id = target_company_id
      and t.status <> 'done'
      and t.due_at is not null and t.due_at < now()
    on conflict (company_id,user_id,dedupe_key) where user_id is not null and dedupe_key is not null do nothing;
    get diagnostics row_count = row_count; inserted_count := inserted_count + row_count;

    insert into public.app_notifications(company_id,user_id,kind,severity,title,body,link,dedupe_key)
    select target_company_id, uid, 'overdue_work', 'danger', 'Pendência atrasada', w.title, '/trabalho', 'work-overdue:'||w.id::text
    from public.work_items w
    where w.company_id = target_company_id
      and w.status in ('open','in_progress','waiting')
      and w.due_at is not null and w.due_at < now()
    on conflict (company_id,user_id,dedupe_key) where user_id is not null and dedupe_key is not null do nothing;
    get diagnostics row_count = row_count; inserted_count := inserted_count + row_count;
  end if;

  -- Um compromisso recebe um alerta quando entra na janela configurada no próprio registro.
  insert into public.app_notifications(company_id,user_id,kind,severity,title,body,link,dedupe_key)
  select target_company_id, uid, 'appointment', 'info', 'Compromisso chegando', a.title,
         'Horário: '||to_char(a.starts_at at time zone company_tz, 'DD/MM HH24:MI'), '/agenda', 'appointment:'||a.id::text
  from public.appointments a
  where a.company_id = target_company_id
    and a.status = 'scheduled'
    and a.starts_at >= now()
    and a.starts_at <= now() + make_interval(mins => greatest(coalesce(a.reminder_minutes,60),0))
  on conflict (company_id,user_id,dedupe_key) where user_id is not null and dedupe_key is not null do nothing;
  get diagnostics row_count = row_count; inserted_count := inserted_count + row_count;

  if coalesce(cfg.notify_new_suggestions, true) then
    insert into public.app_notifications(company_id,user_id,kind,severity,title,body,link,dedupe_key)
    select target_company_id, uid, 'suggestion', 'warning', 'A Secretária encontrou algo', s.title, '/secretaria', 'suggestion:'||s.id::text
    from public.ai_suggestions s
    where s.company_id = target_company_id and s.status = 'pending'
    on conflict (company_id,user_id,dedupe_key) where user_id is not null and dedupe_key is not null do nothing;
    get diagnostics row_count = row_count; inserted_count := inserted_count + row_count;
  end if;

  if coalesce(cfg.daily_summary_enabled, true)
     and local_now::time >= coalesce(cfg.daily_summary_time, '08:00'::time) then
    select count(*) into task_count from public.tasks
      where company_id=target_company_id and status <> 'done';
    select count(*) into work_count from public.work_items
      where company_id=target_company_id and status in ('open','in_progress','waiting');
    select count(*) into suggestion_count from public.ai_suggestions
      where company_id=target_company_id and status='pending';
    select count(*) into appointment_count from public.appointments
      where company_id=target_company_id and status='scheduled'
        and (starts_at at time zone company_tz)::date = local_day;

    insert into public.app_notifications(company_id,user_id,kind,severity,title,body,link,dedupe_key)
    values (
      target_company_id, uid, 'daily_summary', 'success', 'Resumo do dia',
      appointment_count||' compromisso(s), '||(task_count+work_count)||' pendência(s) e '||suggestion_count||' sugestão(ões) para revisar.',
      '/', 'daily:'||local_day::text
    )
    on conflict (company_id,user_id,dedupe_key) where user_id is not null and dedupe_key is not null do nothing;
    get diagnostics row_count = row_count; inserted_count := inserted_count + row_count;
  end if;

  return jsonb_build_object('inserted', inserted_count, 'enabled', true);
end;
$$;

grant execute on function public.refresh_company_notifications(uuid) to authenticated;

-- Visões administrativas: nenhum segredo de API é retornado.
create or replace function public.platform_master_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare result jsonb;
begin
  if not public.is_platform_admin(array['master','support','viewer']) then
    raise exception 'not_platform_admin' using errcode='42501';
  end if;

  select jsonb_build_object(
    'companies', (select count(*) from public.companies),
    'users', (select count(*) from public.profiles),
    'whatsapp_connected', (select count(*) from public.whatsapp_connections where status='connected'),
    'whatsapp_total', (select count(*) from public.whatsapp_connections),
    'pending_suggestions', (select count(*) from public.ai_suggestions where status='pending'),
    'open_work', (select count(*) from public.work_items where status in ('open','in_progress','waiting')),
    'messages', (select count(*) from public.messages)
  ) into result;
  return result;
end;
$$;

create or replace function public.platform_master_companies(limit_rows integer default 50)
returns table(
  id uuid,
  name text,
  created_at timestamptz,
  member_count bigint,
  whatsapp_status text,
  open_items bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_platform_admin(array['master','support','viewer']) then
    raise exception 'not_platform_admin' using errcode='42501';
  end if;
  return query
  select c.id, c.name, c.created_at,
    (select count(*) from public.company_members cm where cm.company_id=c.id),
    coalesce((select wc.status from public.whatsapp_connections wc where wc.company_id=c.id limit 1),'disconnected'),
    (select count(*) from public.work_items wi where wi.company_id=c.id and wi.status in ('open','in_progress','waiting'))
  from public.companies c
  order by c.created_at desc
  limit greatest(1, least(coalesce(limit_rows,50),200));
end;
$$;

revoke all on function public.platform_master_overview() from public, anon;
revoke all on function public.platform_master_companies(integer) from public, anon;
grant execute on function public.platform_master_overview() to authenticated;
grant execute on function public.platform_master_companies(integer) to authenticated;

commit;
