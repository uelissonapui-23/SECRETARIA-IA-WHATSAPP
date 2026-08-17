begin;

-- Coexistência segura com WhatsApp Business App.
-- O objetivo é distinguir explicitamente o modo coexistence do Cloud API
-- tradicional e acompanhar a sincronização de contatos/histórico.
alter table public.whatsapp_connections
  add column if not exists coexistence_verified_at timestamptz,
  add column if not exists coexistence_is_on_biz_app boolean,
  add column if not exists platform_type text,
  add column if not exists contacts_sync_status text not null default 'not_started',
  add column if not exists contacts_sync_request_id text,
  add column if not exists contacts_sync_requested_at timestamptz,
  add column if not exists contacts_sync_completed_at timestamptz,
  add column if not exists history_sync_status text not null default 'not_started',
  add column if not exists history_sync_request_id text,
  add column if not exists history_sync_requested_at timestamptz,
  add column if not exists history_sync_completed_at timestamptz,
  add column if not exists history_sync_progress integer not null default 0,
  add column if not exists history_sync_last_error text;

alter table public.whatsapp_connections drop constraint if exists whatsapp_connections_history_progress_check;
alter table public.whatsapp_connections add constraint whatsapp_connections_history_progress_check
  check (history_sync_progress between 0 and 100);

-- Atualiza last_message_at sem permitir que chunks históricos antigos façam a
-- conversa parecer mais antiga do que uma mensagem recente já recebida.
create or replace function public.whatsapp_touch_conversation(
  target_company_id uuid,
  target_contact_id uuid,
  target_message_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  result_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  insert into public.conversations(company_id, contact_id, last_message_at)
  values(target_company_id, target_contact_id, target_message_at)
  on conflict (company_id, contact_id) do update
    set last_message_at = case
      when public.conversations.last_message_at is null then excluded.last_message_at
      when excluded.last_message_at is null then public.conversations.last_message_at
      else greatest(public.conversations.last_message_at, excluded.last_message_at)
    end
  returning id into result_id;

  return result_id;
end;
$$;

revoke all on function public.whatsapp_touch_conversation(uuid,uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.whatsapp_touch_conversation(uuid,uuid,timestamptz) to service_role;

commit;
