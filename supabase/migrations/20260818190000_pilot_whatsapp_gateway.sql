begin;

create table if not exists public.pilot_whatsapp_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  status text not null default 'disconnected' check (status in ('disconnected','connecting','qr_ready','connected','reconnecting','error')),
  display_phone_number text,
  whatsapp_jid text,
  last_connected_at timestamptz,
  last_message_at timestamptz,
  last_error text,
  gateway_instance text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Conteúdo sempre cifrado pelo gateway antes de chegar ao banco.
create table if not exists public.pilot_whatsapp_auth (
  company_id uuid primary key references public.companies(id) on delete cascade,
  encrypted_state text not null,
  state_version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.pilot_whatsapp_sessions enable row level security;
alter table public.pilot_whatsapp_auth enable row level security;

create policy "pilot session company read" on public.pilot_whatsapp_sessions
for select using (public.is_company_member(company_id));

-- Auth do dispositivo nunca é legível/escrevível pelo cliente. Somente service role do gateway.

create index if not exists pilot_whatsapp_sessions_status_idx on public.pilot_whatsapp_sessions(status);

commit;
