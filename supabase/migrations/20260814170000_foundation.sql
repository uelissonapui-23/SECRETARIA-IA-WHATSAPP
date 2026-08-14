begin;

create extension if not exists pgcrypto;

create type public.company_role as enum ('owner','admin','member');
create type public.suggestion_status as enum ('pending','confirmed','edited','ignored','wrong');
create type public.suggestion_type as enum ('appointment','order','quote','payment_promise','follow_up','deadline','awaiting_reply','task');
create type public.job_status as enum ('pending','processing','done','failed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_type text,
  timezone text not null default 'America/Manaus',
  monitoring_started_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.company_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (company_id,user_id)
);

create table public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  waba_id text,
  phone_number_id text,
  display_phone_number text,
  status text not null default 'disconnected',
  connected_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  whatsapp_id text not null,
  name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, whatsapp_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique(company_id, contact_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  provider_message_id text not null,
  direction text not null check (direction in ('inbound','outbound')),
  message_type text not null,
  body_text text,
  provider_timestamp timestamptz,
  raw_payload jsonb,
  eligible_for_ai boolean not null default false,
  created_at timestamptz not null default now(),
  unique(company_id, provider_message_id)
);

create table public.message_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  message_id uuid not null unique references public.messages(id) on delete cascade,
  status public.job_status not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  source_message_id uuid not null references public.messages(id) on delete cascade,
  context_message_ids uuid[] not null default '{}',
  type public.suggestion_type not null,
  title text not null,
  summary text,
  extracted_data jsonb not null default '{}'::jsonb,
  reason text,
  confidence numeric(4,3) check (confidence between 0 and 1),
  status public.suggestion_status not null default 'pending',
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  suggestion_id uuid references public.ai_suggestions(id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  address text,
  notes text,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  suggestion_id uuid references public.ai_suggestions(id) on delete set null,
  title text not null,
  due_at timestamptz,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_promises (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  suggestion_id uuid references public.ai_suggestions(id) on delete set null,
  amount numeric(12,2),
  promised_for date not null,
  status text not null default 'expected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  suggestion_id uuid references public.ai_suggestions(id) on delete cascade,
  remind_at timestamptz not null,
  status text not null default 'scheduled',
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  company_id uuid references public.companies(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.usage_metrics (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  metric_date date not null default current_date,
  messages_received integer not null default 0,
  messages_ai_analyzed integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  estimated_cost_usd numeric(12,6) not null default 0,
  unique(company_id, metric_date)
);

create or replace function public.is_company_member(target_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.company_members cm where cm.company_id = target_company_id and cm.user_id = auth.uid());
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name','')) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.handle_new_company()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.company_members(company_id, user_id, role) values (new.id, new.created_by, 'owner') on conflict do nothing;
  return new;
end;
$$;

create trigger on_company_created after insert on public.companies for each row execute function public.handle_new_company();

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.whatsapp_connections enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.message_jobs enable row level security;
alter table public.ai_suggestions enable row level security;
alter table public.appointments enable row level security;
alter table public.tasks enable row level security;
alter table public.payment_promises enable row level security;
alter table public.reminders enable row level security;
alter table public.audit_logs enable row level security;
alter table public.usage_metrics enable row level security;

create policy "profiles own row" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "companies members read" on public.companies for select using (public.is_company_member(id));
create policy "companies creator insert" on public.companies for insert with check (created_by = auth.uid());
create policy "companies members update" on public.companies for update using (public.is_company_member(id));
create policy "company members read" on public.company_members for select using (public.is_company_member(company_id));
create policy "company members owner insert" on public.company_members for insert with check (user_id = auth.uid() or public.is_company_member(company_id));

-- Todas as tabelas operacionais obedecem ao company_id. Escritas de webhook/worker usam chave secreta no backend.
do $$
declare t text;
begin
  foreach t in array array['whatsapp_connections','contacts','conversations','messages','message_jobs','ai_suggestions','appointments','tasks','payment_promises','reminders','audit_logs','usage_metrics'] loop
    execute format('create policy %I on public.%I for select using (public.is_company_member(company_id))', t || '_member_select', t);
  end loop;
end $$;

create policy "appointments member write" on public.appointments for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy "tasks member write" on public.tasks for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy "payment promises member write" on public.payment_promises for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy "reminders member write" on public.reminders for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy "suggestions member update" on public.ai_suggestions for update using (public.is_company_member(company_id));

create index messages_conversation_time_idx on public.messages(conversation_id, provider_timestamp desc);
create index messages_company_time_idx on public.messages(company_id, created_at desc);
create index suggestions_company_status_idx on public.ai_suggestions(company_id, status, created_at desc);
create index jobs_status_available_idx on public.message_jobs(status, available_at);
create index appointments_company_start_idx on public.appointments(company_id, starts_at);
create index reminders_company_time_idx on public.reminders(company_id, remind_at);

commit;
