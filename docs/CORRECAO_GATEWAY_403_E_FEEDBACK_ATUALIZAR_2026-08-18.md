# Correção gateway 403 + feedback do botão Atualizar

Evidência:
- CORS passou: OPTIONS 204.
- GET/POST chegaram ao Railway e retornaram 403.
- O botão Atualizar fazia a chamada, mas não tinha estado visual de carregamento.

Correções:
1. Validação do JWT no gateway pelo cliente administrativo do Supabase.
2. Diagnóstico explícito da autorização nos logs do Railway.
3. Fallback seguro para `companies.created_by` como owner em bases antigas.
4. Resposta 401/403 com `reason` sem expor segredos.
5. Frontend traduz motivos de autorização em mensagens úteis.
6. Botão Atualizar mostra spinner e texto `Atualizando...`.

Segurança:
- Nenhuma secret key vai ao frontend.
- O fallback de owner só vale quando `companies.created_by` é exatamente o usuário autenticado.
- Admin/member continuam sem permissão de conectar se o papel não for owner/admin.
