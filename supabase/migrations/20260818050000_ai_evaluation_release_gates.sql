begin;

create table if not exists public.analysis_evaluation_cases(
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 label text not null check(char_length(label) between 2 and 120),
 input_text text not null check(char_length(input_text) between 3 and 1200),
 expected_types text[] not null default '{}',
 notes text check(notes is null or char_length(notes)<=500),
 is_active boolean not null default true,
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists analysis_eval_cases_company_idx on public.analysis_evaluation_cases(company_id,is_active,created_at);
alter table public.analysis_evaluation_cases enable row level security;
drop policy if exists "analysis eval member select" on public.analysis_evaluation_cases;
create policy "analysis eval member select" on public.analysis_evaluation_cases for select using(public.is_company_member(company_id));
drop policy if exists "analysis eval admin write" on public.analysis_evaluation_cases;
create policy "analysis eval admin write" on public.analysis_evaluation_cases for all using(public.is_company_admin(company_id)) with check(public.is_company_admin(company_id));
grant select,insert,update,delete on public.analysis_evaluation_cases to authenticated;

create table if not exists public.analysis_evaluation_runs(
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
 active_engine text not null, cases_count integer not null default 0, rules_passed integer not null default 0, active_passed integer not null default 0,
 rules_score numeric(6,5) not null default 0, active_score numeric(6,5) not null default 0, regressions integer not null default 0,
 ai_compared boolean not null default false, is_baseline boolean not null default false, fallback_used boolean not null default false,
 total_tokens integer not null default 0, estimated_cost_usd numeric(12,6) not null default 0,
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create index if not exists analysis_eval_runs_company_idx on public.analysis_evaluation_runs(company_id,created_at desc);
alter table public.analysis_evaluation_runs enable row level security;
drop policy if exists "analysis eval runs member select" on public.analysis_evaluation_runs;
create policy "analysis eval runs member select" on public.analysis_evaluation_runs for select using(public.is_company_member(company_id));
grant select on public.analysis_evaluation_runs to authenticated;

create table if not exists public.analysis_evaluation_results(
 id uuid primary key default gen_random_uuid(), run_id uuid not null references public.analysis_evaluation_runs(id) on delete cascade,
 case_id uuid not null references public.analysis_evaluation_cases(id) on delete cascade, engine text not null,
 expected_types text[] not null default '{}', detected_types text[] not null default '{}', passed boolean not null, regression boolean not null default false,
 created_at timestamptz not null default now(), unique(run_id,case_id,engine)
);
alter table public.analysis_evaluation_results enable row level security;
drop policy if exists "analysis eval results member select" on public.analysis_evaluation_results;
create policy "analysis eval results member select" on public.analysis_evaluation_results for select using(exists(select 1 from public.analysis_evaluation_runs r where r.id=run_id and public.is_company_member(r.company_id)));
grant select on public.analysis_evaluation_results to authenticated;

-- Liberação do provedor é uma decisão da plataforma, separada das preferências da empresa.
create table if not exists public.platform_ai_company_access(
 company_id uuid primary key references public.companies(id) on delete cascade,
 release_state text not null default 'locked' check(release_state in('locked','pilot','enabled')),
 note text check(note is null or char_length(note)<=500), updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
insert into public.platform_ai_company_access(company_id) select id from public.companies on conflict(company_id) do nothing;
create or replace function public.ensure_ai_company_access() returns trigger language plpgsql security definer set search_path=public as $$begin insert into public.platform_ai_company_access(company_id) values(new.id) on conflict(company_id) do nothing;return new;end;$$;
drop trigger if exists companies_ensure_ai_access on public.companies;
create trigger companies_ensure_ai_access after insert on public.companies for each row execute function public.ensure_ai_company_access();
alter table public.platform_ai_company_access enable row level security;
-- Sem grants diretos de escrita. Edge Functions usam service-role; Master usa RPC auditada.

create or replace function public.analysis_seed_evaluation_cases(target_company_id uuid) returns integer language plpgsql security definer set search_path=public as $$
declare n integer:=0;begin
 if not public.is_company_admin(target_company_id) then raise exception 'not_company_admin' using errcode='42501';end if;
 if exists(select 1 from public.analysis_evaluation_cases where company_id=target_company_id) then return 0;end if;
 insert into public.analysis_evaluation_cases(company_id,label,input_text,expected_types,created_by) values
 (target_company_id,'Agendamento simples','Pode marcar uma visita amanhã às 15h?',array['appointment'],auth.uid()),
 (target_company_id,'Pedido','Quero fechar o pedido de 3 banners para sexta.',array['order','deadline'],auth.uid()),
 (target_company_id,'Orçamento','Me manda um orçamento para envelopar o carro.',array['quote'],auth.uid()),
 (target_company_id,'Promessa de pagamento','Faço o PIX de R$ 350 amanhã.',array['payment_promise'],auth.uid()),
 (target_company_id,'Retorno','Me chama de novo na segunda para eu confirmar.',array['follow_up'],auth.uid()),
 (target_company_id,'Cliente aguardando','Fico no aguardo da sua resposta.',array['awaiting_reply'],auth.uid()),
 (target_company_id,'Sem ação','Obrigado, ficou ótimo!',array[]::text[],auth.uid()),
 (target_company_id,'Múltiplos sinais','Amanhã às 10h passo aí e depois faço o pagamento.',array['appointment','payment_promise'],auth.uid());
 get diagnostics n=row_count; return n;end;$$;
revoke all on function public.analysis_seed_evaluation_cases(uuid) from public,anon;grant execute on function public.analysis_seed_evaluation_cases(uuid) to authenticated;

create or replace function public.analysis_evaluation_summary(target_company_id uuid) returns jsonb language plpgsql security definer set search_path=public stable as $$
declare r record;begin if not public.is_company_member(target_company_id) then raise exception 'not_company_member' using errcode='42501';end if;
 select * into r from public.analysis_evaluation_runs where company_id=target_company_id order by created_at desc limit 1;
 return jsonb_build_object('cases',(select count(*) from public.analysis_evaluation_cases where company_id=target_company_id and is_active),
 'runs',(select count(*) from public.analysis_evaluation_runs where company_id=target_company_id),
 'latest_rules_score',coalesce(r.rules_score,0),'latest_active_score',coalesce(r.active_score,0),'latest_engine',coalesce(r.active_engine,'rules-v1'),
 'latest_regressions',coalesce(r.regressions,0),'latest_at',r.created_at,
 'baseline_score',coalesce((select active_score from public.analysis_evaluation_runs where company_id=target_company_id and is_baseline order by created_at desc limit 1),0));end;$$;
revoke all on function public.analysis_evaluation_summary(uuid) from public,anon;grant execute on function public.analysis_evaluation_summary(uuid) to authenticated;

create or replace function public.platform_master_ai_access() returns table(company_id uuid,company_name text,release_state text,ai_enabled boolean,engine_mode text,updated_at timestamptz) language plpgsql security definer set search_path=public stable as $$begin
 if not public.is_platform_admin(array['master','support','viewer']) then raise exception 'not_platform_admin' using errcode='42501';end if;
 return query select c.id,c.name,a.release_state,p.ai_enabled,p.engine_mode,a.updated_at from public.companies c join public.platform_ai_company_access a on a.company_id=c.id left join public.analysis_policies p on p.company_id=c.id order by c.created_at desc limit 200;end;$$;
revoke all on function public.platform_master_ai_access() from public,anon;grant execute on function public.platform_master_ai_access() to authenticated;

create or replace function public.platform_master_set_ai_access(target_company_id uuid,target_state text,target_note text default null) returns jsonb language plpgsql security definer set search_path=public as $$begin
 if not public.is_platform_admin(array['master']) then raise exception 'not_platform_master' using errcode='42501';end if;
 if target_state not in('locked','pilot','enabled') then raise exception 'invalid_state';end if;
 insert into public.platform_ai_company_access(company_id,release_state,note,updated_by,updated_at) values(target_company_id,target_state,target_note,auth.uid(),now()) on conflict(company_id) do update set release_state=excluded.release_state,note=excluded.note,updated_by=excluded.updated_by,updated_at=now();
 insert into public.platform_audit_logs(actor_user_id,action,target_company_id,metadata) values(auth.uid(),'ai_release_changed',target_company_id,jsonb_build_object('release_state',target_state));
 return jsonb_build_object('ok',true,'release_state',target_state);end;$$;
revoke all on function public.platform_master_set_ai_access(uuid,text,text) from public,anon;grant execute on function public.platform_master_set_ai_access(uuid,text,text) to authenticated;

create or replace function public.platform_master_ai_evaluation() returns jsonb language plpgsql security definer set search_path=public stable as $$begin
 if not public.is_platform_admin(array['master','support','viewer']) then raise exception 'not_platform_admin' using errcode='42501';end if;
 return jsonb_build_object('evaluation_runs_30d',(select count(*) from public.analysis_evaluation_runs where created_at>now()-interval '30 days'),
 'companies_with_baseline',(select count(distinct company_id) from public.analysis_evaluation_runs where is_baseline),
 'regressions_latest_24h',(select coalesce(sum(regressions),0) from public.analysis_evaluation_runs where created_at>now()-interval '24 hours'),
 'ai_locked',(select count(*) from public.platform_ai_company_access where release_state='locked'),
 'ai_pilot',(select count(*) from public.platform_ai_company_access where release_state='pilot'),
 'ai_enabled',(select count(*) from public.platform_ai_company_access where release_state='enabled'));end;$$;
revoke all on function public.platform_master_ai_evaluation() from public,anon;grant execute on function public.platform_master_ai_evaluation() to authenticated;

insert into public.platform_integrations(key,label,provider,status,version,public_config,notes,last_checked_at)
values('ai_quality_gate','Quality Gate da IA','Secretária IA','healthy','eval-v1','{"batch":true,"baseline":true,"regression_detection":true,"master_release_gate":true}'::jsonb,'Liberação do provedor separada da preferência da empresa e protegida por avaliação em lote.',now())
on conflict(key) do update set status=excluded.status,version=excluded.version,public_config=excluded.public_config,notes=excluded.notes,last_checked_at=now(),updated_at=now();
commit;
