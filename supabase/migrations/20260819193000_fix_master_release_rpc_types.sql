begin;

drop function if exists public.platform_master_ai_releases();
create function public.platform_master_ai_releases()
returns table(id uuid,version integer,label text,status text,config jsonb,notes text,created_at timestamptz,approved_at timestamptz)
language plpgsql security definer set search_path=public stable as $$begin
 if not public.is_platform_admin(array['master','support','viewer']) then raise exception 'not_platform_admin' using errcode='42501';end if;
 return query select r.id,r.version,r.label,r.status,r.config,r.notes,r.created_at,r.approved_at from public.platform_ai_engine_releases r order by r.version desc limit 50;
end;$$;
revoke all on function public.platform_master_ai_releases() from public,anon;
grant execute on function public.platform_master_ai_releases() to authenticated;

drop function if exists public.platform_master_release_evidence();
create function public.platform_master_release_evidence() returns table(
 release_id uuid,version integer,label text,status text,quarantined boolean,quarantine_reason text,
 active_companies bigint,runs_30d bigint,avg_score_30d numeric,regressions_30d bigint,severe_regressions_30d bigint,last_run_at timestamptz
) language plpgsql security definer set search_path=public stable as $$begin
 if not public.is_platform_admin(array['master','support','viewer']) then raise exception 'not_platform_admin' using errcode='42501';end if;
 return query select r.id,r.version,r.label,r.status,
   (q.release_id is not null and q.cleared_at is null),case when q.cleared_at is null then q.reason else null end,
   (select count(*) from public.platform_ai_company_access a where a.active_release_id=r.id),
   (select count(*) from public.analysis_evaluation_runs e where e.release_id=r.id and e.created_at>now()-interval '30 days'),
   coalesce((select avg(e.active_score) from public.analysis_evaluation_runs e where e.release_id=r.id and e.created_at>now()-interval '30 days'),0)::numeric,
   (select coalesce(sum(e.regressions),0) from public.analysis_evaluation_runs e where e.release_id=r.id and e.created_at>now()-interval '30 days'),
   (select count(*) from public.analysis_evaluation_runs e where e.release_id=r.id and e.severe_regression and e.created_at>now()-interval '30 days'),
   (select max(e.created_at) from public.analysis_evaluation_runs e where e.release_id=r.id)
 from public.platform_ai_engine_releases r left join public.platform_ai_release_quarantines q on q.release_id=r.id order by r.version desc limit 50;
end;$$;
revoke all on function public.platform_master_release_evidence() from public,anon;
grant execute on function public.platform_master_release_evidence() to authenticated;

drop function if exists public.platform_master_release_review_history();
create function public.platform_master_release_review_history() returns table(
 id bigint,release_id uuid,version integer,label text,decision text,reason text,checklist jsonb,evidence_snapshot jsonb,created_at timestamptz
) language plpgsql security definer set search_path=public stable as $$begin
 if not public.is_platform_admin(array['master','support','viewer']) then raise exception 'not_platform_admin' using errcode='42501';end if;
 return query select rv.id,rv.release_id,r.version,r.label,rv.decision,rv.reason,rv.checklist,rv.evidence_snapshot,rv.created_at
 from public.platform_ai_release_reviews rv join public.platform_ai_engine_releases r on r.id=rv.release_id order by rv.created_at desc limit 100;
end;$$;
revoke all on function public.platform_master_release_review_history() from public,anon;
grant execute on function public.platform_master_release_review_history() to authenticated;

drop function if exists public.platform_master_release_health();
create function public.platform_master_release_health() returns table(
 release_id uuid,version integer,label text,status text,health text,runs_30d bigint,avg_score_30d numeric,regressions_30d bigint,severe_regressions_30d bigint,active_companies bigint,quarantined boolean,last_decision text,last_review_at timestamptz
) language plpgsql security definer set search_path=public stable as $$begin
 if not public.is_platform_admin(array['master','support','viewer']) then raise exception 'not_platform_admin' using errcode='42501';end if;
 return query with metrics as(
  select r.id release_id,r.version,r.label,r.status,count(e.id) filter(where e.created_at>now()-interval '30 days')::bigint runs,
   coalesce(avg(e.active_score) filter(where e.created_at>now()-interval '30 days'),0)::numeric score,
   coalesce(sum(e.regressions) filter(where e.created_at>now()-interval '30 days'),0)::bigint regs,
   count(e.id) filter(where e.created_at>now()-interval '30 days' and e.severe_regression)::bigint severe,
   (select count(*) from public.platform_ai_company_access a where a.active_release_id=r.id)::bigint companies,
   exists(select 1 from public.platform_ai_release_quarantines q where q.release_id=r.id and q.cleared_at is null) quarantined
  from public.platform_ai_engine_releases r left join public.analysis_evaluation_runs e on e.release_id=r.id group by r.id
 ) select m.release_id,m.version,m.label,m.status,
  case when m.quarantined or m.severe>0 then 'critical' when m.runs=0 then 'unknown' when m.score<0.80 or m.regs>0 then 'attention' else 'healthy' end,
  m.runs,m.score,m.regs,m.severe,m.companies,m.quarantined,
  (select rv.decision from public.platform_ai_release_reviews rv where rv.release_id=m.release_id order by rv.created_at desc limit 1),
  (select rv.created_at from public.platform_ai_release_reviews rv where rv.release_id=m.release_id order by rv.created_at desc limit 1)
 from metrics m order by m.version desc limit 50;
end;$$;
revoke all on function public.platform_master_release_health() from public,anon;
grant execute on function public.platform_master_release_health() to authenticated;

commit;
