begin;

-- Motor de análise: política por empresa, telemetria sem conteúdo bruto e laboratório seguro.
alter table public.contacts add column if not exists is_internal boolean not null default false;
create index if not exists contacts_company_internal_idx on public.contacts(company_id,is_internal,created_at desc);

create table if not exists public.analysis_policies (
  company_id uuid primary key references public.companies(id) on delete cascade,
  engine_mode text not null default 'rules' check (engine_mode in ('rules','hybrid','llm')),
  min_confidence numeric(4,3) not null default 0.650 check (min_confidence between 0 and 1),
  context_messages integer not null default 5 check (context_messages between 1 and 12),
  use_company_memory boolean not null default true,
  use_contact_memory boolean not null default true,
  allow_multiple_suggestions boolean not null default true,
  save_analysis_metrics boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.analysis_policies(company_id)
select id from public.companies
on conflict(company_id) do nothing;

create or replace function public.ensure_analysis_policy() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.analysis_policies(company_id) values(new.id) on conflict(company_id) do nothing;
  return new;
end;
$$;
drop trigger if exists companies_ensure_analysis_policy on public.companies;
create trigger companies_ensure_analysis_policy after insert on public.companies for each row execute function public.ensure_analysis_policy();

drop trigger if exists analysis_policies_touch_updated_at on public.analysis_policies;
create trigger analysis_policies_touch_updated_at
before update on public.analysis_policies for each row execute function public.touch_updated_at();

alter table public.analysis_policies enable row level security;
drop policy if exists "analysis policies member select" on public.analysis_policies;
create policy "analysis policies member select" on public.analysis_policies for select using (public.is_company_member(company_id));
drop policy if exists "analysis policies admin update" on public.analysis_policies;
create policy "analysis policies admin update" on public.analysis_policies for update using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));
grant select,update on public.analysis_policies to authenticated;

create table if not exists public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  source text not null default 'message' check (source in ('message','lab','reprocess')),
  engine text not null default 'rules-v1',
  status text not null default 'done' check (status in ('done','skipped','error')),
  context_count integer not null default 0,
  memory_count integer not null default 0,
  candidates integer not null default 0,
  suggestions_created integer not null default 0,
  duration_ms integer,
  error_code text,
  created_at timestamptz not null default now()
);
create index if not exists analysis_runs_company_time_idx on public.analysis_runs(company_id,created_at desc);
create index if not exists analysis_runs_status_time_idx on public.analysis_runs(status,created_at desc);
alter table public.analysis_runs enable row level security;
drop policy if exists "analysis runs member select" on public.analysis_runs;
create policy "analysis runs member select" on public.analysis_runs for select using (public.is_company_member(company_id));
grant select on public.analysis_runs to authenticated;

create unique index if not exists ai_suggestions_source_type_unique
on public.ai_suggestions(source_message_id,type);

create or replace function public.analysis_company_health(target_company_id uuid)
returns jsonb
language plpgsql security definer set search_path=public stable
as $$
declare result jsonb;
begin
  if not public.is_company_member(target_company_id) then raise exception 'not_company_member' using errcode='42501'; end if;
  select jsonb_build_object(
    'runs_24h',(select count(*) from public.analysis_runs where company_id=target_company_id and created_at>now()-interval '24 hours'),
    'errors_24h',(select count(*) from public.analysis_runs where company_id=target_company_id and status='error' and created_at>now()-interval '24 hours'),
    'suggestions_24h',(select coalesce(sum(suggestions_created),0) from public.analysis_runs where company_id=target_company_id and created_at>now()-interval '24 hours'),
    'pending_jobs',(select count(*) from public.message_jobs where company_id=target_company_id and status='pending'),
    'failed_jobs',(select count(*) from public.message_jobs where company_id=target_company_id and status='failed'),
    'last_run_at',(select max(created_at) from public.analysis_runs where company_id=target_company_id),
    'mode',(select engine_mode from public.analysis_policies where company_id=target_company_id)
  ) into result;
  return result;
end;
$$;
revoke all on function public.analysis_company_health(uuid) from public,anon;
grant execute on function public.analysis_company_health(uuid) to authenticated;

-- Auditoria da empresa: continua restrita a owner/admin e agora poderá ser exibida na Central da Secretária.
create or replace function public.get_company_audit(target_company_id uuid, limit_rows integer default 30)
returns table(id bigint, action text, entity_type text, entity_id text, metadata jsonb, created_at timestamptz)
language plpgsql security definer set search_path=public stable
as $$
begin
  if not public.is_company_admin(target_company_id) then raise exception 'not_company_admin' using errcode='42501'; end if;
  return query
  select a.id,a.action,a.entity_type,a.entity_id,a.metadata,a.created_at
  from public.audit_logs a where a.company_id=target_company_id
  order by a.created_at desc limit greatest(1,least(coalesce(limit_rows,30),100));
end;
$$;
revoke all on function public.get_company_audit(uuid,integer) from public,anon;
grant execute on function public.get_company_audit(uuid,integer) to authenticated;

-- Master: indicadores do motor sem conteúdo das conversas.
create or replace function public.platform_master_overview()
returns jsonb
language plpgsql security definer set search_path=public stable
as $$
declare result jsonb;
begin
  if not public.is_platform_admin(array['master','support','viewer']) then raise exception 'not_platform_admin' using errcode='42501'; end if;
  select jsonb_build_object(
    'companies',(select count(*) from public.companies),
    'users',(select count(*) from public.profiles),
    'whatsapp_connected',(select count(*) from public.whatsapp_connections where status='connected'),
    'whatsapp_total',(select count(*) from public.whatsapp_connections),
    'pending_suggestions',(select count(*) from public.ai_suggestions where status='pending'),
    'open_work',(select count(*) from public.work_items where status in ('open','in_progress','waiting')),
    'messages',(select count(*) from public.messages),
    'analysis_runs_24h',(select count(*) from public.analysis_runs where created_at>now()-interval '24 hours'),
    'analysis_errors_24h',(select count(*) from public.analysis_runs where status='error' and created_at>now()-interval '24 hours'),
    'pending_jobs',(select count(*) from public.message_jobs where status='pending')
  ) into result;
  return result;
end;
$$;
revoke all on function public.platform_master_overview() from public,anon;
grant execute on function public.platform_master_overview() to authenticated;

insert into public.platform_integrations(key,label,provider,status,version,public_config,notes,last_checked_at)
values('analysis_engine','Motor de análise','Secretária IA','healthy','rules-v1','{"mode":"observation","raw_text_in_metrics":false,"multiple_suggestions":true}'::jsonb,'Classificação estruturada local enquanto o provedor LLM permanece desacoplado.',now())
on conflict(key) do update set status=excluded.status,version=excluded.version,public_config=excluded.public_config,notes=excluded.notes,last_checked_at=now(),updated_at=now();

commit;
