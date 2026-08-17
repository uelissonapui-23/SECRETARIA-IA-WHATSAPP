begin;

-- Estrutura operacional para a Secretária IA continuar evoluindo mesmo sem a
-- conexão real do WhatsApp. Tudo permanece multiempresa e protegido por RLS.

alter table public.contacts
  add column if not exists email text,
  add column if not exists notes text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists last_interaction_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.tasks
  add column if not exists description text,
  add column if not exists priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  add column if not exists completed_at timestamptz,
  add column if not exists assigned_to uuid references auth.users(id) on delete set null;

alter table public.appointments
  add column if not exists kind text not null default 'appointment' check (kind in ('appointment','visit','delivery','meeting','other')),
  add column if not exists reminder_minutes integer not null default 60 check (reminder_minutes between 0 and 10080);

create table if not exists public.work_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  suggestion_id uuid references public.ai_suggestions(id) on delete set null,
  type text not null check (type in ('order','service','quote','follow_up','deadline','awaiting_reply')),
  title text not null,
  description text,
  amount numeric(12,2),
  due_at timestamptz,
  status text not null default 'open' check (status in ('open','in_progress','waiting','done','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  kind text not null default 'info',
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists contacts_company_name_idx on public.contacts(company_id, name);
create index if not exists work_items_company_status_due_idx on public.work_items(company_id, status, due_at);
create index if not exists tasks_company_status_due_idx on public.tasks(company_id, status, due_at);
create index if not exists app_notifications_user_read_idx on public.app_notifications(user_id, read_at, created_at desc);

-- Reaproveita o trigger genérico de updated_at criado no módulo 2.
drop trigger if exists contacts_touch_updated_at on public.contacts;
create trigger contacts_touch_updated_at before update on public.contacts for each row execute function public.touch_updated_at();
drop trigger if exists work_items_touch_updated_at on public.work_items;
create trigger work_items_touch_updated_at before update on public.work_items for each row execute function public.touch_updated_at();

alter table public.work_items enable row level security;
alter table public.app_notifications enable row level security;

-- Contatos passam a ser gerenciáveis pela empresa. O webhook ainda pode gravar via service role.
drop policy if exists "contacts member write" on public.contacts;
create policy "contacts member write" on public.contacts
for all using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy "work items member select" on public.work_items
for select using (public.is_company_member(company_id));
create policy "work items member write" on public.work_items
for all using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create policy "notifications own select" on public.app_notifications
for select using (
  public.is_company_member(company_id)
  and (user_id is null or user_id = auth.uid())
);
create policy "notifications own update" on public.app_notifications
for update using (
  public.is_company_member(company_id)
  and (user_id is null or user_id = auth.uid())
) with check (
  public.is_company_member(company_id)
  and (user_id is null or user_id = auth.uid())
);

-- Data API explícita: o projeto não expõe novas tabelas automaticamente.
grant select, insert, update, delete on table public.contacts to authenticated;
grant select, insert, update, delete on table public.work_items to authenticated;
grant select, update on table public.app_notifications to authenticated;

commit;
