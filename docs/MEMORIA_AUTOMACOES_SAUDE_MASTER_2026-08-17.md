# Secretária IA — Memória, Automações Internas e Saúde Master

Data: 2026-08-17

## Objetivo

Consolidar o núcleo inteligente do aplicativo sem depender da conexão real com a Meta. A V1 continua em modo de observação: nenhuma regra desta entrega envia mensagens a clientes.

## Entregue

### Central da Secretária
- Abas Atenção, Memória e Automações.
- Memória global da empresa para instruções, preferências, contexto, compromissos e fatos importantes.
- Memórias por cliente continuam separadas na ficha do cliente.
- Regras internas com liga/desliga por empresa.
- Execução manual segura das regras para criar alertas internos.
- Regras iniciais para sugestão de alta confiança, pendências atrasadas, cliente aguardando retorno e pagamento a conferir.

### Segurança das automações
- Nenhuma automação responde WhatsApp.
- Nenhuma automação confirma sugestão em nome do usuário.
- As ações disponíveis nesta fase são apenas `notify` e `remind`.
- Somente owner/admin altera regras; membros podem visualizar.

### Área Master
- Registro seguro de integrações com status, versão/configuração pública e atualização.
- Nenhum segredo, token, App Secret ou service-role é exposto no navegador.
- Supabase, Meta/WhatsApp, Vercel e GitHub aparecem no painel de saúde.
- Busca de empresas.
- Área preparada para auditoria administrativa.

### Auditoria
- `run_company_automations` registra execução no audit log da empresa.
- RPC `get_company_audit` permite leitura futura por owner/admin sem expor a tabela diretamente.

## Banco

Migration: `20260817190000_memory_automation_health.sql`

Cria:
- `automation_rules`
- `run_company_automations(uuid)`
- `get_company_audit(uuid, integer)`
- `platform_integrations`
- `platform_master_integrations()`
- `platform_master_activity(integer)`

## Validação realizada

- TypeScript: OK.
- ESLint: 0 erros; permanecem apenas os 2 warnings antigos de Fast Refresh em `AuthProvider.tsx` e `CompanyProvider.tsx`.
- Vitest/Vite não executaram no container Linux porque o ZIP contém o binding nativo do Rollup para Windows. Rodar `npm run test` e `npm run build` no Windows antes da publicação.

## WhatsApp

Nenhuma alteração foi feita no fluxo Meta/WhatsApp desta entrega. O ponto atual permanece preservado para retomada posterior.
