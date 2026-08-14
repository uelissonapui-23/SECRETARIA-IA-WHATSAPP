# Correção de fechamento do Módulo 2

## Causa identificada

O projeto Supabase foi criado com `Automatically expose new tables` desativado, decisão correta para manter controle explícito. As migrations anteriores criaram RLS e políticas, mas não concederam os privilégios SQL de tabela necessários ao papel `authenticated` para a Data API. Assim, o onboarding podia autenticar o usuário, mas falhar ao inserir a primeira empresa.

## Correção

A migration `20260815003000_module2_explicit_data_api_permissions.sql` concede somente os privilégios de Data API necessários às tabelas acessadas pelo cliente e mantém RLS como camada de autorização por linha. Jobs, auditoria e métricas internas continuam sem acesso direto pelo frontend.

## Validação obrigatória

Após o deploy, criar/concluir o onboarding, atualizar a página, sair e entrar novamente. Empresa e configurações devem persistir. Depois testar recuperação de senha antes de fechar o Módulo 2.
