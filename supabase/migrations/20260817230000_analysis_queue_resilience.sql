begin;

alter table public.message_jobs add column if not exists max_attempts integer not null default 3 check (max_attempts between 1 and 10);
alter table public.message_jobs add column if not exists last_attempt_at timestamptz;
alter table public.message_jobs add column if not exists completed_at timestamptz;
alter table public.message_jobs add column if not exists failure_class text;
create index if not exists message_jobs_company_status_idx on public.message_jobs(company_id,status,available_at);

alter table public.analysis_policies add column if not exists auto_retry_failed boolean not null default true;
alter table public.analysis_policies add column if not exists retry_delay_minutes integer not null default 5 check (retry_delay_minutes between 1 and 1440);
alter table public.analysis_policies add column if not exists max_retry_attempts integer not null default 3 check (max_retry_attempts between 1 and 10);

create or replace function public.analysis_queue_snapshot(target_company_id uuid, limit_rows integer default 30)
returns table(
  job_id uuid,
  message_id uuid,
  status public.job_status,
  attempts integer,
  max_attempts integer,
  available_at timestamptz,
  last_attempt_at timestamptz,
  completed_at timestamptz,
  last_error text,
  failure_class text,
  message_created_at timestamptz,
  contact_name text
)
language plpgsql security definer set search_path=public stable
as $$
begin
  if not public.is_company_admin(target_company_id) then raise exception 'not_company_admin' using errcode='42501'; end if;
  return query
  select j.id,j.message_id,j.status,j.attempts,j.max_attempts,j.available_at,j.last_attempt_at,j.completed_at,j.last_error,j.failure_class,m.created_at,c.name
  from public.message_jobs j
  join public.messages m on m.id=j.message_id
  left join public.contacts c on c.id=m.contact_id
  where j.company_id=target_company_id
  order by case j.status when 'failed' then 0 when 'pending' then 1 when 'processing' then 2 else 3 end, j.updated_at desc
  limit greatest(1,least(coalesce(limit_rows,30),100));
end;
$$;
revoke all on function public.analysis_queue_snapshot(uuid,integer) from public,anon;
grant execute on function public.analysis_queue_snapshot(uuid,integer) to authenticated;

create or replace function public.analysis_requeue_message(target_company_id uuid,target_message_id uuid)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare affected integer;
begin
  if not public.is_company_admin(target_company_id) then raise exception 'not_company_admin' using errcode='42501'; end if;
  update public.message_jobs
     set status='pending', available_at=now(), last_error=null, failure_class=null, completed_at=null, updated_at=now()
   where company_id=target_company_id and message_id=target_message_id;
  get diagnostics affected=row_count;
  if affected=0 then raise exception 'job_not_found' using errcode='P0002'; end if;
  insert into public.audit_logs(company_id,actor_user_id,action,entity_type,entity_id,metadata)
  values(target_company_id,auth.uid(),'analysis_requeued','message',target_message_id,jsonb_build_object('source','manual'));
  return jsonb_build_object('queued',true,'message_id',target_message_id);
end;
$$;
revoke all on function public.analysis_requeue_message(uuid,uuid) from public,anon;
grant execute on function public.analysis_requeue_message(uuid,uuid) to authenticated;

create or replace function public.analysis_requeue_failed(target_company_id uuid, limit_rows integer default 10)
returns jsonb
language plpgsql security definer set search_path=public
as $$
declare affected integer;
begin
  if not public.is_company_admin(target_company_id) then raise exception 'not_company_admin' using errcode='42501'; end if;
  with picked as (
    select id from public.message_jobs
    where company_id=target_company_id and status='failed' and attempts < max_attempts
    order by updated_at asc
    limit greatest(1,least(coalesce(limit_rows,10),50))
    for update skip locked
  )
  update public.message_jobs j
     set status='pending', available_at=now(), last_error=null, failure_class=null, completed_at=null, updated_at=now()
    from picked p where j.id=p.id;
  get diagnostics affected=row_count;
  insert into public.audit_logs(company_id,actor_user_id,action,entity_type,metadata)
  values(target_company_id,auth.uid(),'analysis_failed_requeued','analysis',jsonb_build_object('count',affected));
  return jsonb_build_object('queued',affected);
end;
$$;
revoke all on function public.analysis_requeue_failed(uuid,integer) from public,anon;
grant execute on function public.analysis_requeue_failed(uuid,integer) to authenticated;

create or replace function public.analysis_company_health(target_company_id uuid)
returns jsonb
language plpgsql security definer set search_path=public stable
as $$
declare result jsonb;
begin
  if not public.is_company_member(target_company_id) then raise exception 'not_company_member' using errcode='42501'; end if;
  select jsonb_build_object(
    'mode',(select engine_mode from public.analysis_policies where company_id=target_company_id),
    'runs_24h',(select count(*) from public.analysis_runs where company_id=target_company_id and created_at>now()-interval '24 hours'),
    'errors_24h',(select count(*) from public.analysis_runs where company_id=target_company_id and status='error' and created_at>now()-interval '24 hours'),
    'suggestions_24h',(select count(*) from public.ai_suggestions where company_id=target_company_id and created_at>now()-interval '24 hours'),
    'pending_jobs',(select count(*) from public.message_jobs where company_id=target_company_id and status='pending'),
    'processing_jobs',(select count(*) from public.message_jobs where company_id=target_company_id and status='processing'),
    'failed_jobs',(select count(*) from public.message_jobs where company_id=target_company_id and status='failed'),
    'exhausted_jobs',(select count(*) from public.message_jobs where company_id=target_company_id and status='failed' and attempts>=max_attempts),
    'oldest_pending_minutes',(select coalesce(floor(extract(epoch from (now()-min(created_at)))/60),0) from public.message_jobs where company_id=target_company_id and status='pending')
  ) into result;
  return result;
end;
$$;
revoke all on function public.analysis_company_health(uuid) from public,anon;
grant execute on function public.analysis_company_health(uuid) to authenticated;

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
    'pending_jobs',(select count(*) from public.message_jobs where status='pending'),
    'failed_jobs',(select count(*) from public.message_jobs where status='failed'),
    'exhausted_jobs',(select count(*) from public.message_jobs where status='failed' and attempts>=max_attempts)
  ) into result;
  return result;
end;
$$;
revoke all on function public.platform_master_overview() from public,anon;
grant execute on function public.platform_master_overview() to authenticated;

insert into public.platform_integrations(key,label,provider,status,version,public_config,notes,last_checked_at)
values('analysis_queue','Fila de análise','Secretária IA','healthy','queue-v1','{"retry":"manual+controlled","max_attempts":3,"raw_text_in_metrics":false}'::jsonb,'Fila resiliente com reprocessamento administrativo e limite de tentativas.',now())
on conflict(key) do update set status=excluded.status,version=excluded.version,public_config=excluded.public_config,notes=excluded.notes,last_checked_at=now(),updated_at=now();

commit;
