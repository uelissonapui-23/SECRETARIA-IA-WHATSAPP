# Entrega do Módulo 3: WhatsApp oficial e conexão empresarial

## Escopo fechado

Este módulo implementa a camada de conexão oficial com a Meta, sem envio de mensagens ao cliente. A Secretária começa a observar novas mensagens somente após a ativação do número.

### Incluído

- Página `/whatsapp` responsiva e definitiva.
- Estado conectado, desconectado, carregando, erro e falta de configuração Meta.
- Embedded Signup oficial via SDK da Meta.
- Fluxo de coexistência preparado para número existente no WhatsApp Business App.
- Troca do `code` pelo access token exclusivamente na Edge Function.
- Armazenamento do token no Supabase Vault.
- Vínculo por empresa, WABA e `phone_number_id`.
- `activation_at` como T0 do monitoramento.
- Webhook GET para challenge e POST com verificação `X-Hub-Signature-256`.
- Deduplicação de mensagens pelo ID da Meta.
- Texto elegível para pipeline; áudio, imagem e demais mídias ficam fora da IA na V1.
- Histórico anterior ao T0 ignorado.
- Desconexão sem apagar histórico operacional já registrado.
- Auditoria de conexão/desconexão.
- Último webhook recebido exibido na interface.
- Navegação mobile com menu “Mais” para manter acesso a todas as áreas sem cortar a barra inferior.
- Worker existente passa a recusar chamadas quando `WORKER_SECRET` não estiver configurado.

## Configuração externa obrigatória

A primeira conexão real depende de criar/configurar um App na Meta for Developers com WhatsApp Business Platform e Embedded Signup. Os valores necessários são:

### Frontend Vercel

- `VITE_META_APP_ID`
- `VITE_META_CONFIG_ID`
- `VITE_META_GRAPH_VERSION=v26.0`

### Supabase Edge Function Secrets

- `META_APP_ID`
- `META_APP_SECRET`
- `META_VERIFY_TOKEN`
- `META_GRAPH_VERSION=v26.0`
- `WORKER_SECRET`

O `WORKER_SECRET` será usado no Módulo 4 para o processamento assíncrono. Já é obrigatório para que o endpoint interno não fique aberto.

## Webhook

URL do projeto atual:

`https://rqqdvssisioxkhuxymdw.supabase.co/functions/v1/whatsapp-webhook`

O Verify Token será criado pelo proprietário do sistema e gravado somente como secret no Supabase e na configuração de webhook da Meta.

## Validação técnica realizada nesta entrega

- `npm run typecheck`: aprovado.
- ESLint executado diretamente: 0 erros; permanecem 2 warnings já existentes de Fast Refresh em Providers.
- `test/build`: não executáveis no ambiente de geração porque o `node_modules` anexado veio do Windows e contém binário opcional do Rollup para Windows. O GitHub Actions fará instalação limpa no Linux e é a validação definitiva da entrega.

## Critério de fechamento do Módulo 3

O módulo será marcado como validado quando:

1. CI e Deploy Supabase ficarem verdes.
2. Vercel publicar a nova página.
3. Meta App/Embedded Signup estiver configurado.
4. Um WhatsApp Business real for conectado.
5. O painel mostrar número e `activation_at`.
6. Uma nova mensagem de texto enviada após o T0 aparecer no banco uma única vez.
7. Uma mídia/áudio não for marcada como elegível para IA.
8. Mensagem anterior ao T0 não entrar no pipeline.
9. Desconectar e reconectar funcionarem mantendo isolamento por empresa.
