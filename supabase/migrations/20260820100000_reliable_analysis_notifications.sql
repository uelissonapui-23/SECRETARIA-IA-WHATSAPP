create or replace function public.notify_completed_analysis()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if coalesce(new.suggestions_created,0)<=0 or coalesce(old.suggestions_created,0)>0 then return new; end if;

  insert into public.app_notifications(company_id,user_id,kind,severity,title,body,link,dedupe_key)
  select s.company_id,m.user_id,
    case when s.status='confirmed' and s.type='appointment' then 'appointment' else 'suggestion' end,
    case when s.status='confirmed' and s.type='appointment' then 'success' else 'warning' end,
    case when s.status='confirmed' and s.type='appointment' then 'Compromisso organizado automaticamente' else 'Nova situação para revisar' end,
    coalesce(nullif(s.summary,''),s.title),
    case when s.status='confirmed' and s.type='appointment' then '/agenda' else '/secretaria' end,
    'analysis-suggestion-'||s.id::text
  from public.ai_suggestions s
  join public.company_members m on m.company_id=s.company_id
  where s.company_id=new.company_id and s.source_message_id=new.message_id
  on conflict (company_id,user_id,dedupe_key) where user_id is not null and dedupe_key is not null do nothing;

  return new;
end;
$$;

drop trigger if exists analysis_runs_notify_completion on public.analysis_runs;
create trigger analysis_runs_notify_completion
after update of suggestions_created on public.analysis_runs
for each row execute function public.notify_completed_analysis();
