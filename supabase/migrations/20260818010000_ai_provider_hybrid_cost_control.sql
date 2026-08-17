begin;

alter table public.analysis_policies add column if not exists ai_enabled boolean not null default false;
alter table public.analysis_policies add column if not exists ai_model_label text;
alter table public.analysis_policies add column if not exists ai_daily_token_limit integer not null default 50000 check (ai_daily_token_limit between 0 and 10000000);
alter table public.analysis_policies add column if not exists ai_daily_cost_limit_usd numeric(10,4) not null default 1.0000 check (ai_daily_cost_limit_usd between 0 and 10000);
alter table public.analysis_policies add column if not exists ai_max_candidates integer not null default 4 check (ai_max_candidates between 1 and 8);
alter table public.analysis_policies add column if not exists fallback_to_rules boolean not null default true;

alter table public.analysis_runs add column if not exists provider text;
alter table public.analysis_runs add column if not exists model text;
alter table public.analysis_runs add column if not exists prompt_tokens integer not null default 0;
alter table public.analysis_runs add column if not exists completion_tokens integer not null default 0;
alter table public.analysis_runs add column if not exists total_tokens integer not null default 0;
alter table public.analysis_runs add column if not exists estimated_cost_usd numeric(12,6) not null default 0;
alter table public.analysis_runs add column if not exists fallback_used boolean not null default false;
create index if not exists analysis_runs_company_usage_idx on public.analysis_runs(company_id,created_at desc,total_tokens);

create or replace function public.analysis_company_health(target_company_id uuid)
returns jsonb language plpgsql security definer set search_path=public stable as $$
declare result jsonb;
begin
  if not public.is_company_member(target_company_id) then raise exception 'not_company_member' using errcode='42501'; end if;
  select jsonb_build_object(
    'mode',(select engine_mode from public.analysis_policies where company_id=target_company_id),
    'ai_enabled',(select ai_enabled from public.analysis_policies where company_id=target_company_id),
    'runs_24h',(select count(*) from public.analysis_runs where company_id=target_company_id and created_at>now()-interval '24 hours'),
    'errors_24h',(select count(*) from public.analysis_runs where company_id=target_company_id and status='error' and created_at>now()-interval '24 hours'),
    'suggestions_24h',(select count(*) from public.ai_suggestions where company_id=target_company_id and created_at>now()-interval '24 hours'),
    'tokens_today',(select coalesce(sum(total_tokens),0) from public.analysis_runs where company_id=target_company_id and created_at>=date_trunc('day',now())),
    'cost_today_usd',(select coalesce(sum(estimated_cost_usd),0) from public.analysis_runs where company_id=target_company_id and created_at>=date_trunc('day',now())),
    'fallbacks_24h',(select count(*) from public.analysis_runs where company_id=target_company_id and fallback_used and created_at>now()-interval '24 hours'),
    'pending_jobs',(select count(*) from public.message_jobs where company_id=target_company_id and status='pending'),
    'processing_jobs',(select count(*) from public.message_jobs where company_id=target_company_id and status='processing'),
    'failed_jobs',(select count(*) from public.message_jobs where company_id=target_company_id and status='failed'),
    'exhausted_jobs',(select count(*) from public.message_jobs where company_id=target_company_id and status='failed' and attempts>=max_attempts),
    'oldest_pending_minutes',(select coalesce(floor(extract(epoch from (now()-min(created_at)))/60),0) from public.message_jobs where company_id=target_company_id and status='pending')
  ) into result; return result;
end;$$;
revoke all on function public.analysis_company_health(uuid) from public,anon; grant execute on function public.analysis_company_health(uuid) to authenticated;

create or replace function public.platform_master_ai_usage()
returns jsonb language plpgsql security definer set search_path=public stable as $$
declare result jsonb;
begin
 if not public.is_platform_admin(array['master','support','viewer']) then raise exception 'not_platform_admin' using errcode='42501'; end if;
 select jsonb_build_object(
  'ai_companies',(select count(*) from public.analysis_policies where ai_enabled),
  'hybrid_companies',(select count(*) from public.analysis_policies where engine_mode='hybrid'),
  'llm_companies',(select count(*) from public.analysis_policies where engine_mode='llm'),
  'tokens_24h',(select coalesce(sum(total_tokens),0) from public.analysis_runs where created_at>now()-interval '24 hours'),
  'cost_24h_usd',(select coalesce(sum(estimated_cost_usd),0) from public.analysis_runs where created_at>now()-interval '24 hours'),
  'fallbacks_24h',(select count(*) from public.analysis_runs where fallback_used and created_at>now()-interval '24 hours')
 ) into result; return result;
end;$$;
revoke all on function public.platform_master_ai_usage() from public,anon; grant execute on function public.platform_master_ai_usage() to authenticated;

insert into public.platform_integrations(key,label,provider,status,version,public_config,notes,last_checked_at)
values('ai_provider','Provedor de IA','Configurável por segredo','paused','provider-v1','{"secrets_in_frontend":false,"hybrid":true,"fallback":"rules-v1","cost_control":true}'::jsonb,'Camada pronta para provedor compatível com OpenAI; permanece pausada até configurar segredo e habilitar por empresa.',now())
on conflict(key) do update set status=excluded.status,version=excluded.version,public_config=excluded.public_config,notes=excluded.notes,last_checked_at=now(),updated_at=now();
commit;
