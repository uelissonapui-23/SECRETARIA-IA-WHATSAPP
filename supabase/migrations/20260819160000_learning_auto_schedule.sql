begin;

alter table public.analysis_policies
  add column if not exists learning_enabled boolean not null default true,
  add column if not exists auto_schedule_enabled boolean not null default true,
  add column if not exists auto_schedule_threshold numeric(4,3) not null default 0.950 check (auto_schedule_threshold between 0.850 and 0.990),
  add column if not exists auto_schedule_min_samples integer not null default 5 check (auto_schedule_min_samples between 3 and 100);

-- O worker aprende apenas com decisões registradas e cria compromissos.
-- Reagendamento e cancelamento continuam exigindo confirmação humana.
grant select on table public.analysis_feedback to service_role;
grant select, insert, update on table public.appointments to service_role;
grant update on table public.ai_suggestions to service_role;

commit;
