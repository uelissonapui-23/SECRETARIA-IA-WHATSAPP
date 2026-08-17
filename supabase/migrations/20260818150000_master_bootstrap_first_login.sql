begin;

-- ============================================================
-- Bootstrap seguro e único da primeira conta Master
-- ============================================================
-- O e-mail abaixo NÃO é uma senha nem um segredo. Ele funciona somente como
-- allow-list para a primeira reivindicação do papel Master.
-- A reivindicação exige:
--   1) usuário autenticado;
--   2) o mesmo e-mail no auth.users;
--   3) e-mail já confirmado;
--   4) registro de bootstrap ainda não consumido.
--
-- Depois da primeira reivindicação, claimed_at/claimed_by impedem reutilização.

create table if not exists public.platform_master_bootstrap (
  email text primary key,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint platform_master_bootstrap_email_lowercase check (email = lower(email))
);

alter table public.platform_master_bootstrap enable row level security;
revoke all on table public.platform_master_bootstrap from public, anon, authenticated;

insert into public.platform_master_bootstrap(email)
values ('evoriagerenciamentodeeventos@gmail.com')
on conflict (email) do nothing;

create or replace function public.claim_platform_master_bootstrap()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  confirmed_at timestamptz;
  existing_role text;
  claimed_email text;
begin
  if current_user_id is null then
    return null;
  end if;

  select lower(u.email), u.email_confirmed_at
    into current_email, confirmed_at
  from auth.users u
  where u.id = current_user_id;

  select pa.role
    into existing_role
  from public.platform_admins pa
  where pa.user_id = current_user_id
    and pa.is_active = true
  limit 1;

  if existing_role = 'master' then
    return 'master';
  end if;

  -- Nunca promove conta sem e-mail confirmado.
  if current_email is null or confirmed_at is null then
    return existing_role;
  end if;

  update public.platform_master_bootstrap
     set claimed_by = current_user_id,
         claimed_at = now()
   where email = current_email
     and claimed_at is null
  returning email into claimed_email;

  if claimed_email is null then
    return existing_role;
  end if;

  insert into public.platform_admins(
    user_id,
    role,
    is_active,
    granted_by,
    created_at,
    updated_at
  )
  values (
    current_user_id,
    'master',
    true,
    current_user_id,
    now(),
    now()
  )
  on conflict (user_id) do update
    set role = 'master',
        is_active = true,
        updated_at = now();

  insert into public.platform_audit_logs(
    actor_user_id,
    action,
    target_user_id,
    metadata
  )
  values (
    current_user_id,
    'platform_master_bootstrap_claimed',
    current_user_id,
    jsonb_build_object('method', 'confirmed_email_bootstrap')
  );

  return 'master';
end;
$$;

revoke all on function public.claim_platform_master_bootstrap() from public, anon;
grant execute on function public.claim_platform_master_bootstrap() to authenticated;

commit;
