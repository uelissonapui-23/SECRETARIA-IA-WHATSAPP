# Correção da etapa 2 do onboarding

- Substitui o contrato da etapa 2 por uma RPC com payload JSONB validado no PostgreSQL.
- Elimina fragilidade de tipos entre navegador, PostgREST e `smallint[]`/`time`.
- Avança para a etapa 3 imediatamente após confirmação de persistência.
- A atualização do contexto da empresa passa a ser não bloqueante após o salvamento.
- Mantém autorização por `is_company_admin`, `security definer` e `EXECUTE` somente para `authenticated`.
