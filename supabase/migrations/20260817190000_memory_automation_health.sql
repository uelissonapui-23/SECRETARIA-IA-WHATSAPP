begin;

-- Memória global, automações internas seguras e saúde operacional.
-- Nenhuma automação desta fase envia mensagens ao cliente. O modo V1 continua observacional.

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  event_type text not null check (event_type in ('pending_suggestion','overdue_item','upcoming_appointment','awaiting_reply','payment_follow_up')),
  action_type text not null check (action_type in ('notify','remind')),
  config jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists automation_rules_company_enabled_idx
  on public.automation_rules(company_id, is_enabled, created_at desc);

drop trigger if exists automation_rules_touch_updated_at on public.automation_rules;
create trigger automation_rules_touch_updated_at
before update on public.automation_rules
for each row execute function public.touch_updated_at();

alter table public.automation_rules enable row level security;
drop policy if exists "automation rules member select" on public.automation_rules;
create policy "automation rules member select" on public.automation_rules
for select using (public.is_company_member(company_id));
drop policy if exists "automation rules admin write" on public.automation_rules;
create policy "automation rules admin write" on public.automation_rules
for all using (public.is_company_admin(company_id))
with check (public.is_company_admin(company_id));

grant select on public.automation_rules to authenticated;
grant insert, update, delete on public.automation_rules to authenticated;

-- Regras iniciais conservadoras: só organizam alertas internos.
insert into public.automation_rules(company_id,name,event_type,action_type,config)
select c.id,'Sugestões importantes','pending_suggestion','notify','{"min_confidence":0.85}'::jsonb
from public.companies c
where not exists (
  select 1 from public.automation_rules r where r.company_id=c.id and r.event_type='pending_suggestion'
);
insert into public.automation_rules(company_id,name,event_type,action_type,config)
select c.id,'Pendências atrasadas','overdue_item','notify','{}'::jsonb
from public.companies c
where not exists (
  select 1 from public.automation_rules r where r.company_id=c.id and r.event_type='overdue_item'
);
insert into public.automation_rules(company_id,name,event_type,action_type,config)
select c.id,'Cliente aguardando retorno','awaiting_reply','remind','{"hours":24}'::jsonb
from public.companies c
where not exists (
  select 1 from public.automation_rules r where r.company_id=c.id and r.event_type='awaiting_reply'
);
insert into public.automation_rules(company_id,name,event_type,action_type,config)
select c.id,'Pagamento para acompanhar','payment_follow_up','remind','{"hours":4}'::jsonb
from public.companies c
where not exists (
  select 1 from public.automation_rules r where r.company_id=c.id and r.event_type='payment_follow_up'
);

create or replace function public.run_company_automations(target_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.automation_rules%rowtype;
  n integer := 0;
  rc integer := 0;
  threshold numeric;
  wait_hours integer;
begin
  if uid is null or not public.is_company_member(target_company_id) then
    raise exception 'not_company_member' using errcode='42501';
  end if;

  for r in select * from public.automation_rules where company_id=target_company_id and is_enabled loop
    if r.event_type='pending_suggestion' then
      threshold := greatest(0, least(1, coalesce((r.config->>'min_confidence')::numeric,0.85)));
      insert into public.app_notifications(company_id,user_id,kind,severity,title,body,link,dedupe_key)
      select target_company_id,uid,'automation_suggestion','warning','Sugestão com alta confiança',s.title,'/secretaria','auto:suggestion:'||s.id::text
      from public.ai_suggestions s
      where s.company_id=target_company_id and s.status='pending' and coalesce(s.confidence,0)>=threshold
      on conflict (company_id,user_id,dedupe_key) where user_id is not null and dedupe_key is not null do nothing;
      get diagnostics rc = row_count; n := n + rc;

    elsif r.event_type='overdue_item' then
      insert into public.app_notifications(company_id,user_id,kind,severity,title,body,link,dedupe_key)
      select target_company_id,uid,'automation_overdue','danger','Pendência precisa de atenção',w.title,'/trabalho','auto:overdue:'||w.id::text
      from public.work_items w
      where w.company_id=target_company_id and w.status in ('open','in_progress','waiting') and w.due_at<now()
      on conflict (company_id,user_id,dedupe_key) where user_id is not null and dedupe_key is not null do nothing;
      get diagnostics rc = row_count; n := n + rc;

    elsif r.event_type='awaiting_reply' then
      wait_hours := greatest(1, least(720, coalesce((r.config->>'hours')::integer,24)));
      insert into public.app_notifications(company_id,user_id,kind,severity,title,body,link,dedupe_key)
      select target_company_id,uid,'automation_reply','info','Cliente aguardando retorno',w.title,'/trabalho','auto:reply:'||w.id::text
      from public.work_items w
      where w.company_id=target_company_id and w.type='awaiting_reply' and w.status in ('open','waiting')
        and coalesce(w.due_at,w.created_at) <= now() - make_interval(hours=>wait_hours)
      on conflict (company_id,user_id,dedupe_key) where user_id is not null and dedupe_key is not null do nothing;
      get diagnostics rc = row_count; n := n + rc;

    elsif r.event_type='payment_follow_up' then
      wait_hours := greatest(1, least(720, coalesce((r.config->>'hours')::integer,4)));
      insert into public.app_notifications(company_id,user_id,kind,severity,title,body,link,dedupe_key)
      select target_company_id,uid,'automation_payment','warning','Pagamento para conferir',w.title,'/trabalho','auto:payment:'||w.id::text
      from public.work_items w
      where w.company_id=target_company_id and w.type='payment' and w.status in ('open','waiting')
        and coalesce(w.due_at,w.created_at) <= now() - make_interval(hours=>wait_hours)
      on conflict (company_id,user_id,dedupe_key) where user_id is not null and dedupe_key is not null do nothing;
      get diagnostics rc = row_count; n := n + rc;

    elsif r.event_type='upcoming_appointment' then
      insert into public.app_notifications(company_id,user_id,kind,severity,title,body,link,dedupe_key)
      select target_company_id,uid,'automation_appointment','info','Compromisso se aproximando',a.title,'/agenda','auto:appointment:'||a.id::text
      from public.appointments a
      where a.company_id=target_company_id and a.status='scheduled' and a.starts_at between now() and now()+interval '2 hours'
      on conflict (company_id,user_id,dedupe_key) where user_id is not null and dedupe_key is not null do nothing;
      get diagnostics rc = row_count; n := n + rc;
    end if;
  end loop;

  insert into public.audit_logs(company_id,actor_user_id,action,entity_type,metadata)
  values(target_company_id,uid,'automations_run','automation_rules',jsonb_build_object('notifications_created',n));

  return jsonb_build_object('notifications_created',n,'mode','observe');
end;
$$;
revoke all on function public.run_company_automations(uuid) from public, anon;
grant execute on function public.run_company_automations(uuid) to authenticated;

-- Auditoria operacional: acesso somente por RPC e somente owner/admin.
create or replace function public.get_company_audit(target_company_id uuid, limit_rows integer default 30)
returns table(id bigint, action text, entity_type text, entity_id text, metadata jsonb, created_at timestamptz)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_company_admin(target_company_id) then
    raise exception 'not_company_admin' using errcode='42501';
  end if;
  return query
  select a.id,a.action,a.entity_type,a.entity_id,a.metadata,a.created_at
  from public.audit_logs a where a.company_id=target_company_id
  order by a.created_at desc limit greatest(1,least(coalesce(limit_rows,30),100));
end;
$$;
revoke all on function public.get_company_audit(uuid,integer) from public, anon;
grant execute on function public.get_company_audit(uuid,integer) to authenticated;

-- Registro público/seguro de integrações. Nunca armazena segredo, token ou chave.
create table if not exists public.platform_integrations (
  key text primary key,
  label text not null,
  provider text not null,
  status text not null default 'unknown' check(status in ('healthy','paused','attention','unknown')),
  version text,
  public_config jsonb not null default '{}'::jsonb,
  notes text,
  last_checked_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.platform_integrations(key,label,provider,status,version,public_config,notes,last_checked_at) values
('supabase','Supabase','Supabase','healthy',null,'{"services":["Database","Auth","RLS","Edge Functions"],"secret_storage":"environment"}','Núcleo de dados e autenticação.',now()),
('meta_whatsapp','Meta / WhatsApp','Meta','paused','Embedded Signup','{"mode":"observation","secret_storage":"Edge Function Secrets"}','Fluxo preservado para retomada após estabilização da Meta.',now()),
('vercel','Vercel','Vercel','healthy',null,'{"branch":"main","deploy":"Git integration + optional hook"}','Hospedagem da aplicação web.',now()),
('github','GitHub','GitHub','healthy','Actions','{"branch":"main","ci":true}','Código, CI e automação de publicação.',now())
on conflict(key) do update set
  label=excluded.label,provider=excluded.provider,public_config=excluded.public_config,notes=excluded.notes,updated_at=now();

alter table public.platform_integrations enable row level security;
revoke all on table public.platform_integrations from anon, authenticated;

create or replace function public.platform_master_integrations()
returns table(key text,label text,provider text,status text,version text,public_config jsonb,notes text,last_checked_at timestamptz,updated_at timestamptz)
language plpgsql security definer set search_path=public stable
as $$
begin
  if not public.is_platform_admin(array['master','support','viewer']) then
    raise exception 'not_platform_admin' using errcode='42501';
  end if;
  return query select p.key,p.label,p.provider,p.status,p.version,p.public_config,p.notes,p.last_checked_at,p.updated_at from public.platform_integrations p order by p.label;
end;
$$;
revoke all on function public.platform_master_integrations() from public, anon;
grant execute on function public.platform_master_integrations() to authenticated;

create or replace function public.platform_master_activity(limit_rows integer default 25)
returns table(id bigint,action text,target_company_id uuid,metadata jsonb,created_at timestamptz)
language plpgsql security definer set search_path=public stable
as $$
begin
  if not public.is_platform_admin(array['master','support','viewer']) then
    raise exception 'not_platform_admin' using errcode='42501';
  end if;
  return query select a.id,a.action,a.target_company_id,a.metadata,a.created_at from public.platform_audit_logs a order by a.created_at desc limit greatest(1,least(coalesce(limit_rows,25),100));
end;
$$;
revoke all on function public.platform_master_activity(integer) from public, anon;
grant execute on function public.platform_master_activity(integer) to authenticated;

commit;
