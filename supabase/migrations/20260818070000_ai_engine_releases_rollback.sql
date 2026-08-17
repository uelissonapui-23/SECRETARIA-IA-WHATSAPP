begin;

-- Versões imutáveis do motor/configuração da IA, com aprovação e rollback auditado.
create table if not exists public.platform_ai_engine_releases(
 id uuid primary key default gen_random_uuid(),
 version integer generated always as identity unique,
 label text not null check(char_length(label) between 3 and 80),
 status text not null default 'draft' check(status in('draft','approved','retired')),
 config jsonb not null default '{}'::jsonb,
 notes text check(notes is null or char_length(notes)<=1000),
 created_by uuid references auth.users(id) on delete set null,
 approved_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), approved_at timestamptz
);
alter table public.platform_ai_engine_releases enable row level security;

alter table public.platform_ai_company_access add column if not exists active_release_id uuid references public.platform_ai_engine_releases(id) on delete set null;
alter table public.platform_ai_company_access add column if not exists previous_release_id uuid references public.platform_ai_engine_releases(id) on delete set null;

create table if not exists public.platform_ai_release_history(
 id bigint generated always as identity primary key,
 company_id uuid not null references public.companies(id) on delete cascade,
 from_release_id uuid references public.platform_ai_engine_releases(id) on delete set null,
 to_release_id uuid references public.platform_ai_engine_releases(id) on delete set null,
 action text not null check(action in('activate','rollback')),
 actor_user_id uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now()
);
create index if not exists platform_ai_release_history_company_idx on public.platform_ai_release_history(company_id,created_at desc);
alter table public.platform_ai_release_history enable row level security;

create or replace function public.platform_master_ai_releases() returns table(id uuid,version bigint,label text,status text,config jsonb,notes text,created_at timestamptz,approved_at timestamptz) language plpgsql security definer set search_path=public stable as $$begin
 if not public.is_platform_admin(array['master','support','viewer']) then raise exception 'not_platform_admin' using errcode='42501';end if;
 return query select r.id,r.version,r.label,r.status,r.config,r.notes,r.created_at,r.approved_at from public.platform_ai_engine_releases r order by r.version desc limit 50;
end;$$;
revoke all on function public.platform_master_ai_releases() from public,anon;grant execute on function public.platform_master_ai_releases() to authenticated;

create or replace function public.platform_master_create_ai_release(target_label text,target_notes text default null) returns uuid language plpgsql security definer set search_path=public as $$declare rid uuid;begin
 if not public.is_platform_admin(array['master']) then raise exception 'not_platform_master' using errcode='42501';end if;
 insert into public.platform_ai_engine_releases(label,notes,config,created_by) values(target_label,target_notes,jsonb_build_object('engine_mode','hybrid','min_confidence',0.65,'ai_max_candidates',4,'fallback_to_rules',true,'contract','analysis-v1'),auth.uid()) returning id into rid;
 insert into public.platform_audit_logs(actor_user_id,action,metadata) values(auth.uid(),'ai_release_created',jsonb_build_object('release_id',rid,'label',target_label));return rid;
end;$$;
revoke all on function public.platform_master_create_ai_release(text,text) from public,anon;grant execute on function public.platform_master_create_ai_release(text,text) to authenticated;

create or replace function public.platform_master_approve_ai_release(target_release_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$begin
 if not public.is_platform_admin(array['master']) then raise exception 'not_platform_master' using errcode='42501';end if;
 update public.platform_ai_engine_releases set status='approved',approved_by=auth.uid(),approved_at=now() where id=target_release_id and status='draft';
 if not found then raise exception 'release_not_draft';end if;
 insert into public.platform_audit_logs(actor_user_id,action,metadata) values(auth.uid(),'ai_release_approved',jsonb_build_object('release_id',target_release_id));return jsonb_build_object('ok',true);
end;$$;
revoke all on function public.platform_master_approve_ai_release(uuid) from public,anon;grant execute on function public.platform_master_approve_ai_release(uuid) to authenticated;

create or replace function public.platform_master_activate_ai_release(target_company_id uuid,target_release_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$declare cfg jsonb;old_id uuid;begin
 if not public.is_platform_admin(array['master']) then raise exception 'not_platform_master' using errcode='42501';end if;
 select config into cfg from public.platform_ai_engine_releases where id=target_release_id and status='approved';if cfg is null then raise exception 'release_not_approved';end if;
 select active_release_id into old_id from public.platform_ai_company_access where company_id=target_company_id for update;
 update public.platform_ai_company_access set previous_release_id=old_id,active_release_id=target_release_id,updated_by=auth.uid(),updated_at=now() where company_id=target_company_id;
 update public.analysis_policies set engine_mode=coalesce(cfg->>'engine_mode',engine_mode),min_confidence=coalesce((cfg->>'min_confidence')::numeric,min_confidence),ai_max_candidates=coalesce((cfg->>'ai_max_candidates')::integer,ai_max_candidates),fallback_to_rules=coalesce((cfg->>'fallback_to_rules')::boolean,fallback_to_rules),updated_by=auth.uid(),updated_at=now() where company_id=target_company_id;
 insert into public.platform_ai_release_history(company_id,from_release_id,to_release_id,action,actor_user_id) values(target_company_id,old_id,target_release_id,'activate',auth.uid());
 insert into public.platform_audit_logs(actor_user_id,action,target_company_id,metadata) values(auth.uid(),'ai_release_activated',target_company_id,jsonb_build_object('from',old_id,'to',target_release_id));return jsonb_build_object('ok',true);
end;$$;
revoke all on function public.platform_master_activate_ai_release(uuid,uuid) from public,anon;grant execute on function public.platform_master_activate_ai_release(uuid,uuid) to authenticated;

create or replace function public.platform_master_rollback_ai_release(target_company_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$declare current_id uuid;rollback_id uuid;cfg jsonb;begin
 if not public.is_platform_admin(array['master']) then raise exception 'not_platform_master' using errcode='42501';end if;
 select active_release_id,previous_release_id into current_id,rollback_id from public.platform_ai_company_access where company_id=target_company_id for update;
 if rollback_id is null then raise exception 'no_previous_release';end if;
 select config into cfg from public.platform_ai_engine_releases where id=rollback_id and status in('approved','retired');if cfg is null then raise exception 'previous_release_missing';end if;
 update public.platform_ai_company_access set active_release_id=rollback_id,previous_release_id=current_id,updated_by=auth.uid(),updated_at=now() where company_id=target_company_id;
 update public.analysis_policies set engine_mode=coalesce(cfg->>'engine_mode',engine_mode),min_confidence=coalesce((cfg->>'min_confidence')::numeric,min_confidence),ai_max_candidates=coalesce((cfg->>'ai_max_candidates')::integer,ai_max_candidates),fallback_to_rules=coalesce((cfg->>'fallback_to_rules')::boolean,fallback_to_rules),updated_by=auth.uid(),updated_at=now() where company_id=target_company_id;
 insert into public.platform_ai_release_history(company_id,from_release_id,to_release_id,action,actor_user_id) values(target_company_id,current_id,rollback_id,'rollback',auth.uid());
 insert into public.platform_audit_logs(actor_user_id,action,target_company_id,metadata) values(auth.uid(),'ai_release_rollback',target_company_id,jsonb_build_object('from',current_id,'to',rollback_id));return jsonb_build_object('ok',true,'release_id',rollback_id);
end;$$;
revoke all on function public.platform_master_rollback_ai_release(uuid) from public,anon;grant execute on function public.platform_master_rollback_ai_release(uuid) to authenticated;

-- O PostgreSQL não permite CREATE OR REPLACE quando o tipo de retorno muda.
-- A versão anterior retornava 6 colunas; esta passa a retornar 8.
drop function if exists public.platform_master_ai_access();

create or replace function public.platform_master_ai_access() returns table(company_id uuid,company_name text,release_state text,ai_enabled boolean,engine_mode text,active_release_id uuid,previous_release_id uuid,updated_at timestamptz) language plpgsql security definer set search_path=public stable as $$begin
 if not public.is_platform_admin(array['master','support','viewer']) then raise exception 'not_platform_admin' using errcode='42501';end if;
 return query select c.id,c.name,a.release_state,p.ai_enabled,p.engine_mode,a.active_release_id,a.previous_release_id,a.updated_at from public.companies c join public.platform_ai_company_access a on a.company_id=c.id left join public.analysis_policies p on p.company_id=c.id order by c.created_at desc limit 200;end;$$;
revoke all on function public.platform_master_ai_access() from public,anon;grant execute on function public.platform_master_ai_access() to authenticated;

insert into public.platform_integrations(key,label,provider,status,version,public_config,notes,last_checked_at) values('ai_release_management','Versionamento da IA','Secretária IA','healthy','release-v1','{"approval":true,"company_activation":true,"rollback":true,"audit":true}'::jsonb,'Versões aprovadas podem ser ativadas por empresa e revertidas com auditoria.',now()) on conflict(key) do update set status=excluded.status,version=excluded.version,public_config=excluded.public_config,notes=excluded.notes,last_checked_at=now(),updated_at=now();
commit;
