begin;

-- O worker usa INSERT ... RETURNING id para decidir se a sugestão pode ser
-- autoagendada. RLS continua protegendo o navegador e usuários autenticados.
grant select on table public.ai_suggestions to service_role;

commit;
