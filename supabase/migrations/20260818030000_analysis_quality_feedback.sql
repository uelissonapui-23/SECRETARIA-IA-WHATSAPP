begin;
create table if not exists public.analysis_feedback(
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 suggestion_id uuid references public.ai_suggestions(id) on delete set null, source text not null check(source in('suggestion','lab','manual')),
 verdict text not null check(verdict in('correct','incorrect','missed')), suggestion_type public.suggestion_type,
 confidence numeric(4,3), engine text, notes text check(notes is null or char_length(notes)<=500), created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create index if not exists analysis_feedback_company_time_idx on public.analysis_feedback(company_id,created_at desc);
create unique index if not exists analysis_feedback_suggestion_user_unique on public.analysis_feedback(suggestion_id,created_by) where suggestion_id is not null;
alter table public.analysis_feedback enable row level security;
drop policy if exists "analysis feedback member select" on public.analysis_feedback;
create policy "analysis feedback member select" on public.analysis_feedback for select using(public.is_company_member(company_id));
drop policy if exists "analysis feedback member insert" on public.analysis_feedback;
create policy "analysis feedback member insert" on public.analysis_feedback for insert with check(public.is_company_member(company_id) and created_by=auth.uid());
grant select,insert on public.analysis_feedback to authenticated;
create or replace function public.analysis_quality_summary(target_company_id uuid) returns jsonb language plpgsql security definer set search_path=public stable as $$
declare t bigint;c bigint;i bigint;m bigint;
begin if not public.is_company_member(target_company_id) then raise exception 'not_company_member' using errcode='42501';end if;
 select count(*),count(*) filter(where verdict='correct'),count(*) filter(where verdict='incorrect'),count(*) filter(where verdict='missed') into t,c,i,m from public.analysis_feedback where company_id=target_company_id and created_at>now()-interval '30 days';
 return jsonb_build_object('total',t,'correct',c,'incorrect',i,'missed',m,'accuracy',case when t=0 then 0 else round(c::numeric/t,4) end);end;$$;
revoke all on function public.analysis_quality_summary(uuid) from public,anon;grant execute on function public.analysis_quality_summary(uuid) to authenticated;
create or replace function public.platform_master_quality() returns jsonb language plpgsql security definer set search_path=public stable as $$
declare t bigint;c bigint;i bigint;
begin if not public.is_platform_admin(array['master','support','viewer']) then raise exception 'not_platform_admin' using errcode='42501';end if;
 select count(*),count(*) filter(where verdict='correct'),count(*) filter(where verdict='incorrect') into t,c,i from public.analysis_feedback where created_at>now()-interval '30 days';
 return jsonb_build_object('feedback_30d',t,'correct_30d',c,'incorrect_30d',i,'accuracy_30d',case when t=0 then 0 else round(c::numeric/t,4) end);end;$$;
revoke all on function public.platform_master_quality() from public,anon;grant execute on function public.platform_master_quality() to authenticated;
commit;
