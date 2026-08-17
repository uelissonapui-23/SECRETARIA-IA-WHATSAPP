# Maturidade operacional + Área Master + deploy resiliente

Esta etapa consolida o aplicativo sem depender da conexão real da Meta.

## Entregue

- Agenda com próximos, histórico, concluir, cancelar, reabrir/reagendar e lembretes configuráveis.
- Trabalho com criação, edição, conclusão, exclusão, histórico, prioridades e acompanhamento de pagamento.
- Clientes com histórico operacional e memória estruturada por cliente.
- Central da Secretária passa a converter também promessas de pagamento em acompanhamento operacional.
- Notificações internas reais para atrasos, compromissos próximos, novas sugestões e resumo diário.
- Área Master com visão de empresas, usuários, estado do WhatsApp, pendências e integrações, sem expor segredos.
- Workflow de fallback para Vercel via Deploy Hook após CI verde.

## Automação Vercel — configuração única

A integração Git normal da Vercel continua sendo o caminho principal. O workflow `Deploy Vercel` funciona como fallback e exige um único secret no GitHub:

`VERCEL_DEPLOY_HOOK_URL`

Na Vercel, crie um Deploy Hook de Production apontando para a branch `main`. Copie a URL e salve em GitHub > Settings > Secrets and variables > Actions > New repository secret.

O endereço do hook é segredo operacional e nunca deve ser gravado no repositório.

## Segurança

A Área Master usa `platform_admins`, separada das permissões internas das empresas. Segredos reais de Meta/Supabase continuam fora do frontend e das tabelas comuns.
