# WhatsApp — retomada segura em coexistência (2026-08-17)

## Decisão de arquitetura

A Secretária IA passa a aceitar como caminho padrão apenas o **WhatsApp Business App Onboarding / Coexistence** da Meta. O objetivo é evitar que o cliente precise abandonar o WhatsApp Business ou migrar o número pelo fluxo tradicional da Cloud API.

## Base documental verificada

A documentação atual da Meta informa que:

- Embedded Signup v4 é a implementação atual do fluxo incorporado;
- o onboarding de usuários do WhatsApp Business app usa `featureType: whatsapp_business_app_onboarding`;
- o evento de conclusão específico desse fluxo é `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`;
- depois da conexão, o número pode ser validado por `is_on_biz_app=true` e `platform_type=CLOUD_API`;
- o aplicativo deve ser inscrito na WABA com `POST /<WABA_ID>/subscribed_apps`;
- para coexistência devem ser recebidos também os webhooks `history`, `smb_app_state_sync` e `smb_message_echoes`;
- contatos podem ser sincronizados com `POST /<PHONE_NUMBER_ID>/smb_app_data` usando `sync_type=smb_app_state_sync`;
- histórico pode ser sincronizado com o mesmo endpoint usando `sync_type=history`;
- a sincronização inicial deve começar dentro da janela de 24 horas após o onboarding;
- mensagens 1:1 de até 180 dias podem ser sincronizadas se o cliente permitir;
- mensagens enviadas pelo próprio WhatsApp Business app chegam por `smb_message_echoes` e devem ser espelhadas no sistema;
- a desconexão completa de coexistência é feita pelo cliente no WhatsApp Business, em Conta > Plataforma de negócios, e não pelo endpoint tradicional de deregistro.

## Proteções implementadas

1. O frontend não aceita `FINISH`/`FINISH_ONLY_WABA` como conclusão válida para este produto.
2. O fallback que conectava apenas com o código OAuth foi removido do modo coexistência.
3. O backend exige `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`.
4. O backend confirma `is_on_biz_app=true` e `platform_type=CLOUD_API` antes de salvar a conexão.
5. A conexão é registrada como `connection_mode=coexistence`.
6. Contatos e histórico são solicitados imediatamente após a conexão para não perder a janela de 24 horas.
7. Histórico sincronizado é salvo, mas fica com `eligible_for_ai=false`: não há análise retroativa automática.
8. Novas mensagens enviadas pelo WhatsApp Business app são espelhadas como mensagens de saída.
9. Webhook continua validando `x-hub-signature-256` com `META_APP_SECRET`.
10. A UI deixa claro que o botão local não equivale a remover a conexão da Meta.

## Configuração obrigatória no painel Meta

Antes do teste real, conferir no App Dashboard:

- configuração **Facebook Login for Business / Embedded Signup v4**;
- produto WhatsApp habilitado;
- callback do webhook validado;
- campos de webhook inscritos: `messages`, `history`, `smb_app_state_sync`, `smb_message_echoes` e `account_update`;
- Configuration ID usado no frontend corresponde à configuração v4 criada para Embedded Signup;
- conta/app possui elegibilidade necessária para onboarding de WhatsApp Business app users (Tech Provider/Solution Partner, conforme o modelo da conta Meta).

## Observações de produto

- Chats 1:1 podem ser sincronizados; grupos não fazem parte deste fluxo de coexistência.
- Algumas funções do WhatsApp Business possuem limitações após o onboarding, portanto o cliente deve ser informado antes de confirmar a conexão.
- Dispositivos vinculados podem ser desvinculados durante o onboarding e precisam ser relincados quando suportados.
- Nenhum número deve ser usado como teste destrutivo. Primeiro validar o fluxo com um número secundário/comercial adequado.
