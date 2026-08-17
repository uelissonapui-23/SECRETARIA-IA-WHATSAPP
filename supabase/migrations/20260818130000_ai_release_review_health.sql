begin;

create table if not exists public.platform_ai_release_reviews(
  id bigint generated always as identity primary key,
  release_id uuid not null references public.platform_ai_engine_releases(id) on delete cascade,
  decision text not null check(decision in('approved','rejected','needs_work')),
  reason text not null check(char_length(reason) between 3 and 1500),
  checklist jsonb not null default '{}'::jsonb,
  evidence_snapshot jsonb not null default '{}'::jsonb,
  reviewer_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.platform_ai_release_reviews enable row level security;
create index if not exists platform_ai_release_reviews_release_idx on public.platform_ai_release_reviews(release_id,created_at desc);

create or replace function public.platform_master_release_review_history() returns table(
 id bigint,release_id uuid,version bigint,label text,decision text,reason text,checklist jsonb,evidence_snapshot jsonb,created_at timestamptz
) language plpgsql security definer set search_path=public stable as $$begin
 if not public.is_platform_admin(array['master','support','viewer']) then raise exception 'not_platform_admin' using errcode='42501';end if;
 return query select rv.id,rv.release_id,r.version,r.label,rv.decision,rv.reason,rv.checklist,rv.evidence_snapshot,rv.created_at
 from public.platform_ai_release_reviews rv join public.platform_ai_engine_releases r on r.id=rv.release_id
 order by rv.created_at desc limit 100;
end;$$;
revoke all on function public.platform_master_release_review_history() from public,anon;grant execute on function public.platform_master_release_review_history() to authenticated;

create or replace function public.platform_master_review_ai_release(target_release_id uuid,target_decision text,target_reason text,target_checklist jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path=public as $$declare ev jsonb;begin
 if not public.is_platform_admin(array['master']) then raise exception 'not_platform_master' using errcode='42501';end if;
 if target_decision not in('approved','rejected','needs_work') then raise exception 'invalid_decision';end if;
 if char_length(trim(coalesce(target_reason,'')))<3 then raise exception 'reason_required';end if;
 select jsonb_build_object('runs_30d',count(e.id),'avg_score_30d',coalesce(avg(e.active_score),0),'regressions_30d',coalesce(sum(e.regressions),0),'severe_regressions_30d',count(*) filter(where e.severe_regression)) into ev
 from public.analysis_evaluation_runs e where e.release_id=target_release_id and e.created_at>now()-interval '30 days';
 insert into public.platform_ai_release_reviews(release_id,decision,reason,checklist,evidence_snapshot,reviewer_user_id)
 values(target_release_id,target_decision,left(trim(target_reason),1500),coalesce(target_checklist,'{}'::jsonb),coalesce(ev,'{}'::jsonb),auth.uid());
 insert into public.platform_audit_logs(actor_user_id,action,metadata) values(auth.uid(),'ai_release_reviewed',jsonb_build_object('release_id',target_release_id,'decision',target_decision,'reason',left(trim(target_reason),300)));
 return jsonb_build_object('ok',true);
end;$$;
revoke all on function public.platform_master_review_ai_release(uuid,text,text,jsonb) from public,anon;grant execute on function public.platform_master_review_ai_release(uuid,text,text,jsonb) to authenticated;

create or replace function public.platform_master_release_health() returns table(
 release_id uuid,version bigint,label text,status text,health text,runs_30d bigint,avg_score_30d numeric,regressions_30d bigint,severe_regressions_30d bigint,active_companies bigint,quarantined boolean,last_decision text,last_review_at timestamptz
) language plpgsql security definer set search_path=public stable as $$begin
 if not public.is_platform_admin(array['master','support','viewer']) then raise exception 'not_platform_admin' using errcode='42501';end if;
 return query
 with metrics as(
  select r.id release_id,r.version,r.label,r.status,
   count(e.id) filter(where e.created_at>now()-interval '30 days')::bigint runs,
   coalesce(avg(e.active_score) filter(where e.created_at>now()-interval '30 days'),0)::numeric score,
   coalesce(sum(e.regressions) filter(where e.created_at>now()-interval '30 days'),0)::bigint regs,
   count(e.id) filter(where e.created_at>now()-interval '30 days' and e.severe_regression)::bigint severe,
   (select count(*) from public.platform_ai_company_access a where a.active_release_id=r.id)::bigint companies,
   exists(select 1 from public.platform_ai_release_quarantines q where q.release_id=r.id and q.cleared_at is null) quarantined
  from public.platform_ai_engine_releases r left join public.analysis_evaluation_runs e on e.release_id=r.id group by r.id
 )
 select m.release_id,m.version,m.label,m.status,
  case when m.quarantined or m.severe>0 then 'critical' when m.runs=0 then 'unknown' when m.score<0.80 or m.regs>0 then 'attention' else 'healthy' end,
  m.runs,m.score,m.regs,m.severe,m.companies,m.quarantined,
  (select rv.decision from public.platform_ai_release_reviews rv where rv.release_id=m.release_id order by rv.created_at desc limit 1),
  (select rv.created_at from public.platform_ai_release_reviews rv where rv.release_id=m.release_id order by rv.created_at desc limit 1)
 from metrics m order by m.version desc limit 50;
end;$$;
revoke all on function public.platform_master_release_health() from public,anon;grant execute on function public.platform_master_release_health() to authenticated;

insert into public.platform_integrations(key,label,provider,status,version,public_config,notes,last_checked_at)
values('ai_release_review','Revisão e saúde de releases','Secretária IA','healthy','release-review-v1','{"review_history":true,"checklist":true,"health_report":true,"evidence_snapshot":true}'::jsonb,'Aprovação e reprovação ficam justificadas com checklist e snapshot das evidências.',now())
on conflict(key) do update set status=excluded.status,version=excluded.version,public_config=excluded.public_config,notes=excluded.notes,last_checked_at=now(),updated_at=now();

commit;
