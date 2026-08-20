create or replace function public.create_push_test_notification(target_company_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare notification_id uuid;
begin
  if auth.uid() is null or not public.is_company_member(target_company_id) then
    raise exception 'membership_required' using errcode='42501';
  end if;

  insert into public.app_notifications(company_id,user_id,kind,severity,title,body,link,dedupe_key)
  values(target_company_id,auth.uid(),'push_test','info','Alerta de teste da evoria','Os alertas deste aparelho estão funcionando.','/secretaria','push-test-'||auth.uid()::text||'-'||extract(epoch from clock_timestamp())::bigint)
  returning id into notification_id;

  return notification_id;
end;
$$;

revoke all on function public.create_push_test_notification(uuid) from public;
grant execute on function public.create_push_test_notification(uuid) to authenticated;
