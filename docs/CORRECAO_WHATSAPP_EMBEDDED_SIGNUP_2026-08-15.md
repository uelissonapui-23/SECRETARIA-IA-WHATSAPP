# Correção — WhatsApp Embedded Signup

Data: 2026-08-15

## Sintoma corrigido

A tela de conexão ficava presa em **“Aguardando Meta...”** e nenhuma chamada para a Edge Function `whatsapp-connect` aparecia no Network.

## Causa tratada

O frontend aguardava simultaneamente o `code` do `FB.login()` e o `postMessage` final do Embedded Signup, porém:

- aceitava apenas mensagens originadas em `www.facebook.com` e `web.facebook.com`;
- exigia `phone_number_id` inclusive no evento válido `FINISH_ONLY_WABA`;
- forçava `featureType: whatsapp_business_app_onboarding`, apesar da configuração atual do painel estar no fluxo Embedded Signup v4 padrão;
- não tinha timeout/saída segura caso a Meta não entregasse o evento final.

## Alterações

### `src/whatsapp/metaEmbeddedSignup.ts`

- adicionada normalização segura do `postMessage` da Meta;
- aceitas origens oficiais relevantes, incluindo `business.facebook.com`;
- suporte a `FINISH` e `FINISH_ONLY_WABA`;
- suporte a payload JSON string ou objeto;
- suporte a IDs em formatos diretos ou aninhados;
- configuração alinhada com Embedded Signup v4 + session info v3;
- removida a imposição de coexistência pelo frontend;
- mensagens de progresso mais claras;
- watchdog de 5 minutos para impedir estado infinito de “Aguardando Meta”.

### `supabase/functions/whatsapp-connect/index.ts`

- `phone_number_id` deixa de ser obrigatório quando a Meta conclui com `FINISH_ONLY_WABA`;
- após trocar o `code` por token, a função consulta os números da WABA;
- se houver exatamente um número, ele é usado;
- se não houver número ou houver vários sem seleção explícita, retorna erro claro em vez de falhar silenciosamente.

### `src/pages/WhatsAppPage.tsx`

- estados terminais de erro/cancelamento também liberam o botão para uma nova tentativa.

### Teste novo

`src/whatsapp/metaEmbeddedSignup.test.ts` cobre:

- origem `www.facebook.com`;
- origem `business.facebook.com`;
- `FINISH_ONLY_WABA` sem número;
- IDs aninhados;
- rejeição de origem não confiável.

## Validação feita

`tsc -b --pretty false` executado sem erros.

O build/teste via Vite/Vitest não foi executado neste ambiente porque o ZIP original trazia `node_modules` de Windows e o Rollup nativo Linux opcional não estava disponível. No ambiente normal do projeto, execute:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

## Publicação

Após substituir os arquivos, publicar o frontend e a Edge Function alterada:

```bash
git add .
git commit -m "Corrige retorno do Embedded Signup do WhatsApp"
git push
```

Se o workflow do Supabase não publicar automaticamente a função alterada, publicar `whatsapp-connect` pelo fluxo já usado no projeto.
