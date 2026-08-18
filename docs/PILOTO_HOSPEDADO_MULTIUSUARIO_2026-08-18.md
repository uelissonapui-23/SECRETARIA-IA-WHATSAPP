# Piloto hospedado multiusuário — arquitetura

## Objetivo
Permitir que várias empresas vinculem seus próprios WhatsApps ao mesmo serviço persistente, mantendo isolamento por `company_id`, sem exigir computador ligado e sem envio de mensagens pelo produto.

## Isolamento
- 1 registro de sessão por empresa;
- 1 auth state Signal cifrado por empresa;
- JWT + membership owner/admin em toda conexão/desconexão/status;
- credenciais nunca são retornadas ao frontend;
- QR existe apenas na memória do worker;
- mensagens/contact/conversation sempre recebem `company_id` da sessão do servidor;
- deduplicação por `(company_id, provider_message_id)`;
- falha de uma sessão não derruba as demais.

## Fluxo
WhatsApp -> Baileys no Railway -> contacts/conversations/messages -> message_jobs -> process-message -> sugestões -> confirmação humana.

## Escala
V1 usa um worker persistente com várias sessões em memória. A coluna `gateway_instance` já prepara ownership futuro. Antes de escalar horizontalmente, adicionar lease/lock distribuído para garantir que somente um worker possua cada sessão.

## Limites conscientes
Piloto V1: somente conversas 1:1 e texto/caption. Ignora grupos, status, newsletters, áudio e mídia. Nenhuma API de envio foi criada.

## Migração futura
Meta Webhook substitui somente a entrada; o pipeline operacional permanece.
