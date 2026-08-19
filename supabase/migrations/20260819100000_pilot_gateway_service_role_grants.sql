begin;

-- O gateway usa uma chave secreta exclusivamente no Railway. RLS continua
-- protegendo clientes autenticados; estas permissões não são concedidas a anon.
grant usage on schema public to service_role;

grant select on table public.companies to service_role;
grant select on table public.company_members to service_role;

grant select, insert, update, delete
  on table public.pilot_whatsapp_sessions
  to service_role;

grant select, insert, update, delete
  on table public.pilot_whatsapp_auth
  to service_role;

grant select, insert, update
  on table public.contacts
  to service_role;

grant select, insert
  on table public.messages
  to service_role;

grant select, insert, update
  on table public.message_jobs
  to service_role;

commit;
