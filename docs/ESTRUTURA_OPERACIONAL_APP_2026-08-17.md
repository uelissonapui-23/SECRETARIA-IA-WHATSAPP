# Estrutura operacional da Secretária IA — 2026-08-17

Esta entrega permite continuar o desenvolvimento completo do produto sem depender da conexão real do WhatsApp/Meta.

## O que foi estruturado

- Início/Dashboard com dados reais do Supabase: compromissos de hoje, sugestões pendentes, tarefas/trabalhos em aberto e atrasados.
- Agenda interna com criação, edição, conclusão, cancelamento e exclusão de compromissos, vínculo opcional com cliente, tipo, endereço e observações.
- Clientes com cadastro e edição manual, telefone, e-mail e anotações. O mesmo cadastro continuará apto a receber contatos originados do WhatsApp.
- Trabalho com tarefas e uma nova entidade `work_items` para pedido, serviço, orçamento, retorno, prazo e cliente aguardando resposta.
- Central da Secretária com sugestões pendentes, confirmação/ignorar, contexto verificável e conversão de sugestões em Agenda/Trabalho.
- Troca de empresa no topo quando o usuário possuir mais de uma empresa.
- Estados vazios, carregamento, erro e responsividade para as novas áreas.

## Banco

Migration incremental `20260817110000_operational_core_structure.sql`:

- amplia `contacts`, `tasks` e `appointments`;
- cria `work_items`;
- cria a base de `app_notifications` para o módulo de notificações;
- adiciona índices, triggers de atualização, RLS e privilégios explícitos da Data API.

A migration não depende da conexão do WhatsApp e não apaga dados anteriores.

## WhatsApp/Meta

O código atual da conexão foi preservado. A integração real permanece congelada no ponto já diagnosticado para ser retomada depois que o restante do produto estiver estruturado.

## Próximas camadas naturais

A base desta entrega permite evoluir sem refazer as páginas para: motor IA real, notificações/resumo diário, memória operacional, equipe/múltiplas empresas, área Master, apresentação pública e integrações futuras.
