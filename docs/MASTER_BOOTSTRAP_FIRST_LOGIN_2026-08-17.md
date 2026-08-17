# Primeiro acesso da conta Master

Esta etapa cria um bootstrap único para a primeira conta Master da plataforma.

E-mail autorizado:

`evoriagerenciamentodeeventos@gmail.com`

## Fluxo

1. Aplicar a migration `20260818150000_master_bootstrap_first_login.sql`.
2. Criar a conta normalmente em `/auth/cadastro` usando o e-mail autorizado.
3. Confirmar o e-mail pelo link enviado pelo Supabase.
4. Fazer o primeiro login.
5. O `AppGuard` chama `claim_platform_master_bootstrap()`.
6. A função confere usuário autenticado, e-mail confirmado e allow-list ainda não consumida.
7. O papel `master` é concedido e auditado.
8. Se a conta Master não possuir empresa, ela é levada diretamente para `/master`, sem onboarding obrigatório.

## Segurança

- O papel Master não é concedido apenas porque alguém conhece o endereço de e-mail.
- É obrigatório autenticar e confirmar a posse do e-mail.
- O bootstrap é consumido apenas uma vez.
- A tabela de bootstrap não é acessível pelo navegador.
- A concessão fica registrada em `platform_audit_logs`.
- Usuários comuns continuam seguindo o onboarding normal.
