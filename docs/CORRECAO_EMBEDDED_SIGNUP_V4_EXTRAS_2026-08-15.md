# Correção Embedded Signup v4 — 2026-08-15

## Sintoma
O `FB.login` retornava `status=connected` e `code`, porém o evento `WA_EMBEDDED_SIGNUP` com `waba_id`/`phone_number_id` não chegava. O frontend terminava em `authorization-without-session` e `whatsapp-connect` nunca era chamado.

## Causa provável isolada
O launcher enviava `extras: { version: 'v4', sessionInfoVersion: '3' }`. Na configuração atual do Embedded Signup v4, a versão do fluxo é determinada pela configuração de login criada no painel da Meta e os extras de v4 não devem forçar esses campos.

## Alteração
- O `FB.login` passa a usar `extras: {}`.
- O parser continua aceitando o JSON string oficial e ganhou fallback defensivo para string percent-encoded/query-string.
- O diagnóstico temporário permanece até o primeiro teste confirmar `FINISH` e a chamada a `whatsapp-connect`.
