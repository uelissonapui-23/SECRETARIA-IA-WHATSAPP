begin;

-- O projeto foi criado com "Automatically expose new tables" desativado.
-- Por isso, os privilégios da Data API são concedidos explicitamente e a
-- autorização fina continua sendo feita pelas políticas RLS já existentes.

grant usage on schema public to authenticated;

grant select, update on table public.profiles to authenticated;
grant select, insert, update on table public.companies to authenticated;
grant select on table public.company_members to authenticated;
grant select, insert, update, delete on table public.company_settings to authenticated;
grant select, insert, update on table public.user_preferences to authenticated;

-- Estruturas já previstas na fundação. O acesso real continua limitado por RLS.
grant select on table public.whatsapp_connections to authenticated;
grant select on table public.contacts to authenticated;
grant select on table public.conversations to authenticated;
grant select on table public.messages to authenticated;
grant select on table public.ai_suggestions to authenticated;
grant select, insert, update, delete on table public.appointments to authenticated;
grant select, insert, update, delete on table public.tasks to authenticated;
grant select, insert, update, delete on table public.payment_promises to authenticated;
grant select, insert, update, delete on table public.reminders to authenticated;

-- Não conceder acesso direto do cliente a jobs, auditoria ou métricas internas.
revoke all on table public.message_jobs from authenticated, anon;
revoke all on table public.audit_logs from authenticated, anon;
revoke all on table public.usage_metrics from authenticated, anon;

commit;
