begin;

-- Guardrails por empresa para promoção de piloto e bloqueio automático em regressões graves.
create table if not exists public.platform_ai_guardrails(
  company_id uuid primary key references public.companies(id) on delete cascade,
  auto_promote boolean not null default false,
  auto_lock_on_severe_regression boolean not null default true,
  required_pilot_runs integer not null default 3 check(required_pilot_runs between 1 and 20),
  min_active_score numeric(6,5) not null default 0.90 check(min_active_score between 0 and 1),
  max_regressions integer not null default 0 check(max_regressions between 0 and 50),
  severe_regression_count integer not null default 2 check(severe_regression_count between 1 and 50),
  severe_score_drop numeric(6,5) not null default 0.20 check(severe_score_drop between 0 and 1),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.platform_ai_guardrails enable row level security;

insert into public.platform_ai_guardrails(company_id)
select id from public.companies
on conflict(company_id) do nothing;

create or replace function public.ensure_ai_guardrails() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into public.platform_ai_guardrails(company_id) values(new.id) on conflict(company_id) do nothing;
  return new;
end;$$;
drop trigger if exists companies_ensure_ai_guardrails on public.companies;
create trigger companies_ensure_ai_guardrails after insert on public.companies for each row execute function public.ensure_ai_guardrails();

alter table public.analysis_evaluation_runs add column if not exists release_id uuid references public.platform_ai_engine_releases(id) on delete set null;
alter table public.analysis_evaluation_runs add column if not exists baseline_score_snapshot numeric(6,5) not null default 0;
alter table public.analysis_evaluation_runs add column if not exists score_delta numeric(7,5) not null default 0;
alter table public.analysis_evaluation_runs add column if not exists severe_regression boolean not null default false;
alter table public.analysis_evaluation_runs add column if not exists release_state_at_run text check(release_state_at_run is null or release_state_at_run in('locked','pilot','enabled'));
create index if not exists analysis_eval_runs_release_idx on public.analysis_evaluation_runs(company_id,release_id,created_at desc);
create index if not exists analysis_eval_runs_severe_idx on public.analysis_evaluation_runs(severe_regression,created_at desc) where severe_regression=true;

create table if not exists public.platform_ai_auto_actions(
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  release_id uuid references public.platform_ai_engine_releases(id) on delete set null,
  evaluation_run_id uuid references public.analysis_evaluation_runs(id) on delete set null,
  action text not null check(action in('auto_promote','auto_lock')),
  reason text not null,
  previous_state text,
  next_state text,
  created_at timestamptz not null default now()
);
create index if not exists platform_ai_auto_actions_company_idx on public.platform_ai_auto_actions(company_id,created_at desc);
alter table public.platform_ai_auto_actions enable row level security;

create or replace function public.platform_master_ai_evolution() returns jsonb
language plpgsql security definer set search_path=public stable as $$
begin
  if not public.is_platform_admin(array['master','support','viewer']) then raise exception 'not_platform_admin' using errcode='42501'; end if;
  return jsonb_build_object(
    'runs_7d',(select count(*) from public.analysis_evaluation_runs where created_at>now()-interval '7 days'),
    'severe_regressions_7d',(select count(*) from public.analysis_evaluation_runs where created_at>now()-interval '7 days' and severe_regression),
    'auto_promotions_30d',(select count(*) from public.platform_ai_auto_actions where created_at>now()-interval '30 days' and action='auto_promote'),
    'auto_locks_30d',(select count(*) from public.platform_ai_auto_actions where created_at>now()-interval '30 days' and action='auto_lock'),
    'companies_auto_promote',(select count(*) from public.platform_ai_guardrails where auto_promote),
    'avg_active_score_7d',coalesce((select avg(active_score) from public.analysis_evaluation_runs where created_at>now()-interval '7 days'),0)
  );
end;$$;
revoke all on function public.platform_master_ai_evolution() from public,anon;
grant execute on function public.platform_master_ai_evolution() to authenticated;

create or replace function public.platform_master_ai_evolution_rows() returns table(
  company_id uuid, company_name text, release_state text, active_release_id uuid, release_version bigint,
  auto_promote boolean, auto_lock_on_severe_regression boolean, required_pilot_runs integer,
  min_active_score numeric, max_regressions integer, severe_regression_count integer, severe_score_drop numeric,
  latest_score numeric, latest_regressions integer, latest_severe boolean, pilot_runs integer, eligible_for_promotion boolean
) language plpgsql security definer set search_path=public stable as $$
begin
  if not public.is_platform_admin(array['master','support','viewer']) then raise exception 'not_platform_admin' using errcode='42501'; end if;
  return query
  select c.id,c.name,a.release_state,a.active_release_id,r.version,
    g.auto_promote,g.auto_lock_on_severe_regression,g.required_pilot_runs,g.min_active_score,g.max_regressions,g.severe_regression_count,g.severe_score_drop,
    coalesce(last_run.active_score,0)::numeric,coalesce(last_run.regressions,0)::integer,coalesce(last_run.severe_regression,false),
    coalesce(pilot_stats.runs,0)::integer,
    (a.release_state='pilot' and a.active_release_id is not null
      and coalesce(pilot_stats.runs,0)>=g.required_pilot_runs
      and coalesce(last_run.active_score,0)>=g.min_active_score
      and coalesce(last_run.regressions,0)<=g.max_regressions
      and not coalesce(last_run.severe_regression,false)) as eligible_for_promotion
  from public.companies c
  join public.platform_ai_company_access a on a.company_id=c.id
  join public.platform_ai_guardrails g on g.company_id=c.id
  left join public.platform_ai_engine_releases r on r.id=a.active_release_id
  left join lateral (
    select er.active_score,er.regressions,er.severe_regression from public.analysis_evaluation_runs er
    where er.company_id=c.id and (a.active_release_id is null or er.release_id=a.active_release_id)
    order by er.created_at desc limit 1
  ) last_run on true
  left join lateral (
    select count(*)::integer as runs from public.analysis_evaluation_runs er
    where er.company_id=c.id and er.release_id=a.active_release_id and er.release_state_at_run='pilot'
  ) pilot_stats on true
  order by c.created_at desc limit 200;
end;$$;
revoke all on function public.platform_master_ai_evolution_rows() from public,anon;
grant execute on function public.platform_master_ai_evolution_rows() to authenticated;

create or replace function public.platform_master_set_ai_guardrails(
  target_company_id uuid,target_auto_promote boolean,target_auto_lock boolean,target_required_runs integer,
  target_min_score numeric,target_max_regressions integer,target_severe_count integer,target_severe_drop numeric
) returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_admin(array['master']) then raise exception 'not_platform_master' using errcode='42501'; end if;
  if target_required_runs not between 1 and 20 or target_min_score not between 0 and 1 or target_max_regressions not between 0 and 50 or target_severe_count not between 1 and 50 or target_severe_drop not between 0 and 1 then raise exception 'invalid_guardrails'; end if;
  insert into public.platform_ai_guardrails(company_id,auto_promote,auto_lock_on_severe_regression,required_pilot_runs,min_active_score,max_regressions,severe_regression_count,severe_score_drop,updated_by,updated_at)
  values(target_company_id,target_auto_promote,target_auto_lock,target_required_runs,target_min_score,target_max_regressions,target_severe_count,target_severe_drop,auth.uid(),now())
  on conflict(company_id) do update set auto_promote=excluded.auto_promote,auto_lock_on_severe_regression=excluded.auto_lock_on_severe_regression,required_pilot_runs=excluded.required_pilot_runs,min_active_score=excluded.min_active_score,max_regressions=excluded.max_regressions,severe_regression_count=excluded.severe_regression_count,severe_score_drop=excluded.severe_score_drop,updated_by=excluded.updated_by,updated_at=now();
  insert into public.platform_audit_logs(actor_user_id,action,target_company_id,metadata) values(auth.uid(),'ai_guardrails_updated',target_company_id,jsonb_build_object('auto_promote',target_auto_promote,'auto_lock',target_auto_lock,'required_runs',target_required_runs,'min_score',target_min_score,'max_regressions',target_max_regressions,'severe_count',target_severe_count,'severe_drop',target_severe_drop));
  return jsonb_build_object('ok',true);
end;$$;
revoke all on function public.platform_master_set_ai_guardrails(uuid,boolean,boolean,integer,numeric,integer,integer,numeric) from public,anon;
grant execute on function public.platform_master_set_ai_guardrails(uuid,boolean,boolean,integer,numeric,integer,integer,numeric) to authenticated;

insert into public.platform_integrations(key,label,provider,status,version,public_config,notes,last_checked_at)
values('ai_evolution_guardrails','Evolução e guardrails da IA','Secretária IA','healthy','guardrails-v1','{"history":true,"severe_regression_lock":true,"pilot_promotion":true,"auto_promotion_opt_in":true}'::jsonb,'Histórico comparativo, bloqueio automático em regressão grave e promoção de piloto somente quando critérios forem atingidos.',now())
on conflict(key) do update set status=excluded.status,version=excluded.version,public_config=excluded.public_config,notes=excluded.notes,last_checked_at=now(),updated_at=now();

commit;
