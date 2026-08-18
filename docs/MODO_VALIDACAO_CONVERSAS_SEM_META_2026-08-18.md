# Modo de validação de conversas sem Meta — 2026-08-18

## Decisão

A integração oficial Meta/WhatsApp permanece preservada e pausada. Para validar o valor da Secretária IA antes da formalização empresarial e App Review, o projeto passa a ter uma trilha paralela de validação que **não automatiza o WhatsApp Web**.

## Base da decisão

- O WhatsApp oferece exportação oficial do histórico de uma conversa em texto.
- A WhatsApp Business Platform oficial continua sendo a arquitetura de produção futura, baseada em Cloud API + Webhooks.
- O Embedded Signup/Coexistence continua preservado para a futura conexão oficial dos clientes.

## Como funciona na prática

Na página Conversas/WhatsApp existem duas trilhas:

### Validar agora

1. **Teste rápido**: o usuário digita uma mensagem como se fosse um cliente.
2. **Conversa exportada**: o usuário importa um `.txt` exportado pelo próprio WhatsApp ou cola o conteúdo.
3. O frontend identifica as mensagens e pede qual participante representa a empresa.
4. Todas as mensagens importadas entram no mesmo modelo `contacts -> conversations -> messages` usado pela integração Meta.
5. Mensagens anteriores servem como contexto.
6. Somente a última mensagem recebida do cliente é marcada para análise.
7. A nova Edge Function `validation-import` chama o mesmo `process-message` usado pelo pipeline oficial.
8. As sugestões aparecem na Secretária e podem ser confirmadas normalmente para Agenda/Trabalho.

### Meta oficial

Todo o fluxo anterior de Embedded Signup, Coexistence, WABA, número, webhook e sincronização permanece no projeto, porém visualmente separado como trilha oficial pausada.

## Segurança

- Apenas Owner/Admin pode importar ou limpar conversas de validação.
- A Edge Function valida a sessão e o vínculo com a empresa no servidor.
- São aceitas no máximo 200 mensagens por importação.
- Cada mensagem é limitada a 4.000 caracteres.
- O modo de validação não envia nenhuma mensagem ao WhatsApp.
- Não há QR Code, sessão do WhatsApp Web, scraping, browser automation ou biblioteca não oficial.
- Dados de teste usam `whatsapp_id` com prefixo `validation:` e podem ser apagados sem tocar em contatos reais da Meta.

## Arquivos

- `src/components/ValidationConnectorPanel.tsx`
- `src/validation/chatImport.ts`
- `src/validation/chatImport.test.ts`
- `src/pages/WhatsAppPage.tsx`
- `src/styles.css`
- `supabase/functions/validation-import/index.ts`
- `supabase/config.toml`
- `.github/workflows/deploy-supabase.yml`

## Banco

Nenhuma migration nova é necessária. O modo usa as estruturas já existentes do pipeline operacional.

## Deploy

A GitHub Action do Supabase foi atualizada para publicar `validation-import` automaticamente quando houver push em `main` com alteração em `supabase/**`.
