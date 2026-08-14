begin;

-- Módulo 3: conexão oficial do WhatsApp Business Platform.
-- O navegador pode consultar somente metadados não sensíveis. Credenciais de
-- acesso permanecem no Supabase Vault e operações de conexão são feitas por
-- Edge Functions autenticadas.

create extension if not exists supabase_vault cascade;

alter table public.whatsapp_connections
  add column if not exists business_id text,
  add column if not exists phone_number_name text,
  add column if not exists quality_rating text,
  add column if not exists connection_mode text not null default 'embedded_signup',
  add column if not exists activation_at timestamptz,
  add column if not exists last_webhook_at timestamptz,
  add column if not exists last_error text,
  add column if not exists token_secret_id uuid,
  add column if not exists connected_by uuid references auth.users(id) on delete set null,
  add column if not exists disconnected_by uuid references auth.users(id) on delete set null;

drop index if exists public.whatsapp_connections_phone_number_unique;
create unique index whatsapp_connections_phone_number_unique
  on public.whatsapp_connections(phone_number_id)
  where phone_number_id is not null and status = 'connected';

create index if not exists whatsapp_connections_company_status_idx
  on public.whatsapp_connections(company_id, status);

create or replace function public.is_company_admin(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.company_members cm
    where cm.company_id = target_company_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner','admin')
  );
$$;

-- O backend usa esta função com service role para guardar/rotacionar o token.
create or replace function public.whatsapp_store_access_token(
  target_connection_id uuid,
  access_token text
)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  existing_secret uuid;
  result_secret uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if access_token is null or length(access_token) < 20 then
    raise exception 'invalid_access_token';
  end if;

  select token_secret_id into existing_secret
  from public.whatsapp_connections
  where id = target_connection_id;

  if existing_secret is not null then
    perform vault.update_secret(existing_secret, access_token);
    result_secret := existing_secret;
  else
    result_secret := vault.create_secret(access_token, 'whatsapp_connection_' || target_connection_id::text, 'Token WhatsApp Cloud API da Secretária IA');
    update public.whatsapp_connections
      set token_secret_id = result_secret, updated_at = now()
      where id = target_connection_id;
  end if;

  return result_secret;
end;
$$;

create or replace function public.whatsapp_get_access_token(target_connection_id uuid)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select ds.decrypted_secret
  from public.whatsapp_connections wc
  join vault.decrypted_secrets ds on ds.id = wc.token_secret_id
  where wc.id = target_connection_id
    and auth.role() = 'service_role'
  limit 1;
$$;

create or replace function public.whatsapp_delete_access_token(target_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare sid uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  select token_secret_id into sid from public.whatsapp_connections where id = target_connection_id;
  if sid is not null then
    delete from vault.secrets where id = sid;
    update public.whatsapp_connections set token_secret_id = null, updated_at = now() where id = target_connection_id;
  end if;
end;
$$;


create or replace function public.whatsapp_increment_received(target_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  insert into public.usage_metrics(company_id, metric_date, messages_received)
  values (target_company_id, current_date, 1)
  on conflict (company_id, metric_date) do update
    set messages_received = public.usage_metrics.messages_received + 1;
end;
$$;

-- Usuário autenticado só lê o estado da conexão de empresas das quais participa.
grant select on table public.whatsapp_connections to authenticated;
revoke insert, update, delete on table public.whatsapp_connections from authenticated, anon;

revoke all on function public.whatsapp_store_access_token(uuid,text) from public, anon, authenticated;
revoke all on function public.whatsapp_increment_received(uuid) from public, anon, authenticated;
revoke all on function public.whatsapp_get_access_token(uuid) from public, anon, authenticated;
revoke all on function public.whatsapp_delete_access_token(uuid) from public, anon, authenticated;
grant execute on function public.whatsapp_store_access_token(uuid,text) to service_role;
grant execute on function public.whatsapp_increment_received(uuid) to service_role;
grant execute on function public.whatsapp_get_access_token(uuid) to service_role;
grant execute on function public.whatsapp_delete_access_token(uuid) to service_role;

commit;
