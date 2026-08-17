begin;

-- Quarentena global de releases: uma versão com regressão grave não pode ser ativada
-- novamente até revisão explícita do Master.
create table if not exists public.platform_ai_release_quarantines(
  release_id uuid primary key references public.platform_ai_engine_releases(id) on delete cascade,
  reason text not null check(char_length(reason) between 3 and 1000),
  source_company_id uuid references public.companies(id) on delete set null,
  evaluation_run_id uuid references public.analysis_evaluation_runs(id) on delete set null,
  quarantined_at timestamptz not null default now(),
  quarantined_by uuid references auth.users(id) on delete set null,
  cleared_at timestamptz,
  cleared_by uuid references auth.users(id) on delete set null,
  clear_note text
);
alter table public.platform_ai_release_quarantines enable row level security;
create index if not exists platform_ai_release_quarantine_active_idx on public.platform_ai_release_quarantines(release_id) where cleared_at is null;

alter table public.platform_ai_release_history drop constraint if exists platform_ai_release_history_action_check;
alter table public.platform_ai_release_history add constraint platform_ai_release_history_action_check check(action in('activate','rollback','auto_rollback'));

-- Ativação passa a bloquear releases em quarentena.
create or replace function public.platform_master_activate_ai_release(target_company_id uuid,target_release_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$declare cfg jsonb;old_id uuid;begin
 if not public.is_platform_admin(array['master']) then raise exception 'not_platform_master' using errcode='42501';end if;
 if exists(select 1 from public.platform_ai_release_quarantines q where q.release_id=target_release_id and q.cleared_at is null) then raise exception 'release_quarantined';end if;
 select config into cfg from public.platform_ai_engine_releases where id=target_release_id and status='approved';if cfg is null then raise exception 'release_not_approved';end if;
 select active_release_id into old_id from public.platform_ai_company_access where company_id=target_company_id for update;
 update public.platform_ai_company_access set previous_release_id=old_id,active_release_id=target_release_id,updated_by=auth.uid(),updated_at=now() where company_id=target_company_id;
 update public.analysis_policies set engine_mode=coalesce(cfg->>'engine_mode',engine_mode),min_confidence=coalesce((cfg->>'min_confidence')::numeric,min_confidence),ai_max_candidates=coalesce((cfg->>'ai_max_candidates')::integer,ai_max_candidates),fallback_to_rules=coalesce((cfg->>'fallback_to_rules')::boolean,fallback_to_rules),updated_by=auth.uid(),updated_at=now() where company_id=target_company_id;
 insert into public.platform_ai_release_history(company_id,from_release_id,to_release_id,action,actor_user_id) values(target_company_id,old_id,target_release_id,'activate',auth.uid());
 insert into public.platform_audit_logs(actor_user_id,action,target_company_id,metadata) values(auth.uid(),'ai_release_activated',target_company_id,jsonb_build_object('from',old_id,'to',target_release_id));return jsonb_build_object('ok',true);
end;$$;

create or replace function public.platform_master_release_evidence() returns table(
 release_id uuid,version bigint,label text,status text,quarantined boolean,quarantine_reason text,
 active_companies bigint,runs_30d bigint,avg_score_30d numeric,regressions_30d bigint,severe_regressions_30d bigint,last_run_at timestamptz
) language plpgsql security definer set search_path=public stable as $$begin
 if not public.is_platform_admin(array['master','support','viewer']) then raise exception 'not_platform_admin' using errcode='42501';end if;
 return query
 select r.id,r.version,r.label,r.status,
   (q.release_id is not null and q.cleared_at is null) as quarantined,
   case when q.cleared_at is null then q.reason else null end,
   (select count(*) from public.platform_ai_company_access a where a.active_release_id=r.id),
   (select count(*) from public.analysis_evaluation_runs e where e.release_id=r.id and e.created_at>now()-interval '30 days'),
   coalesce((select avg(e.active_score) from public.analysis_evaluation_runs e where e.release_id=r.id and e.created_at>now()-interval '30 days'),0)::numeric,
   (select coalesce(sum(e.regressions),0) from public.analysis_evaluation_runs e where e.release_id=r.id and e.created_at>now()-interval '30 days'),
   (select count(*) from public.analysis_evaluation_runs e where e.release_id=r.id and e.severe_regression and e.created_at>now()-interval '30 days'),
   (select max(e.created_at) from public.analysis_evaluation_runs e where e.release_id=r.id)
 from public.platform_ai_engine_releases r
 left join public.platform_ai_release_quarantines q on q.release_id=r.id
 order by r.version desc limit 50;
end;$$;
revoke all on function public.platform_master_release_evidence() from public,anon;grant execute on function public.platform_master_release_evidence() to authenticated;

create or replace function public.platform_master_clear_release_quarantine(target_release_id uuid,target_note text) returns jsonb language plpgsql security definer set search_path=public as $$begin
 if not public.is_platform_admin(array['master']) then raise exception 'not_platform_master' using errcode='42501';end if;
 update public.platform_ai_release_quarantines set cleared_at=now(),cleared_by=auth.uid(),clear_note=left(coalesce(target_note,'Revisada pela Área Master'),1000) where release_id=target_release_id and cleared_at is null;
 if not found then raise exception 'release_not_quarantined';end if;
 insert into public.platform_audit_logs(actor_user_id,action,metadata) values(auth.uid(),'ai_release_quarantine_cleared',jsonb_build_object('release_id',target_release_id,'note',target_note));
 return jsonb_build_object('ok',true);
end;$$;
revoke all on function public.platform_master_clear_release_quarantine(uuid,text) from public,anon;grant execute on function public.platform_master_clear_release_quarantine(uuid,text) to authenticated;

create or replace function public.platform_master_ai_evolution() returns jsonb language plpgsql security definer set search_path=public stable as $$begin
  if not public.is_platform_admin(array['master','support','viewer']) then raise exception 'not_platform_admin' using errcode='42501'; end if;
  return jsonb_build_object(
    'runs_7d',(select count(*) from public.analysis_evaluation_runs where created_at>now()-interval '7 days'),
    'severe_regressions_7d',(select count(*) from public.analysis_evaluation_runs where created_at>now()-interval '7 days' and severe_regression),
    'auto_promotions_30d',(select count(*) from public.platform_ai_auto_actions where created_at>now()-interval '30 days' and action='auto_promote'),
    'auto_locks_30d',(select count(*) from public.platform_ai_auto_actions where created_at>now()-interval '30 days' and action='auto_lock'),
    'auto_rollbacks_30d',(select count(*) from public.platform_ai_release_history where created_at>now()-interval '30 days' and action='auto_rollback'),
    'quarantined_releases',(select count(*) from public.platform_ai_release_quarantines where cleared_at is null),
    'companies_auto_promote',(select count(*) from public.platform_ai_guardrails where auto_promote),
    'avg_active_score_7d',coalesce((select avg(active_score) from public.analysis_evaluation_runs where created_at>now()-interval '7 days'),0)
  );
end;$$;

insert into public.platform_integrations(key,label,provider,status,version,public_config,notes,last_checked_at)
values('ai_release_safety','Segurança de releases da IA','Secretária IA','healthy','release-safety-v1','{"auto_rollback":true,"quarantine":true,"evidence":true,"activation_block":true}'::jsonb,'Regressão grave pode fazer rollback automático e colocar a release em quarentena até revisão Master.',now())
on conflict(key) do update set status=excluded.status,version=excluded.version,public_config=excluded.public_config,notes=excluded.notes,last_checked_at=now(),updated_at=now();

commit;
