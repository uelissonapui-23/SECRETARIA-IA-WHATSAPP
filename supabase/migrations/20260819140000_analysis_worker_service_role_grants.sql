begin;

-- A chave secreta das Edge Functions executa o motor como service_role.
-- RLS continua protegendo o navegador; somente o worker recebe estes acessos.
grant usage on schema public to service_role;

grant select on table public.messages to service_role;
grant select, update on table public.message_jobs to service_role;
grant select on table public.analysis_policies to service_role;
grant select on table public.company_settings to service_role;
grant select on table public.platform_ai_company_access to service_role;
grant select on table public.operational_memories to service_role;

grant select, insert, update on table public.analysis_runs to service_role;
grant insert on table public.ai_suggestions to service_role;
grant insert on table public.audit_logs to service_role;

commit;
