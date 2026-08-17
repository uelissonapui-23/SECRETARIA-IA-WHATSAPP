# Correção definitiva do fluxo WhatsApp — 2026-08-17

## Causas encontradas

1. O produto exige coexistência com o WhatsApp Business app, mas o Embedded Signup era iniciado com `featureType` vazio. Para coexistência, a Meta exige `featureType: 'whatsapp_business_app_onboarding'` e `sessionInfoVersion: '3'`.
2. A chamada das Edge Functions dependia do Authorization implícito do SDK. Agora o access token da sessão Supabase é anexado explicitamente.
3. A autorização da empresa estava duplicada no backend com uma regra própria. Agora connect/disconnect usam `company_role_for()` no contexto JWT do usuário, a mesma fonte de verdade usada pelas regras do banco.
4. A configuração local da função não declarava `verify_jwt = false` para connect/disconnect, embora o workflow as publicasse com `--no-verify-jwt`. Isso permitia divergência entre deploy manual e CI. A configuração agora é explícita e a função continua validando o JWT internamente.
5. Uma migration corrige vínculos antigos em que o criador da empresa não permaneceu como `owner`.

## Fluxo final

1. Frontend abre Embedded Signup no modo de coexistência.
2. Meta retorna o code OAuth e, quando disponível, WABA/phone_number_id via WA_EMBEDDED_SIGNUP.
3. Frontend envia code e IDs para whatsapp-connect com JWT Supabase explícito.
4. Edge Function valida o usuário pelo JWT e consulta `company_role_for()`.
5. Somente owner/admin segue para service role.
6. Backend troca o code por token Meta.
7. Se WABA/telefone não vieram no postMessage, o backend tenta resolver pela autorização do token/Graph API.
8. App é inscrito na WABA, metadados do número são obtidos e a conexão é persistida.
9. Token fica no Vault; o navegador recebe apenas metadados da conexão.

## Arquivos alterados

- `src/whatsapp/metaEmbeddedSignup.ts`
- `src/pages/WhatsAppPage.tsx`
- `supabase/functions/whatsapp-connect/index.ts`
- `supabase/functions/whatsapp-disconnect/index.ts`
- `supabase/config.toml`
- `supabase/migrations/20260817073000_repair_company_owner_membership.sql`
