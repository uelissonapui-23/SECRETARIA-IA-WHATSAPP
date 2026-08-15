# Correção de diagnóstico do WhatsApp Embedded Signup — 2026-08-15

## Sintoma confirmado

O Facebook Login retorna um `code` de autorização, mas o frontend não recebe o evento final `WA_EMBEDDED_SIGNUP` com `waba_id`/`phone_number_id`. Com isso, a Edge Function `whatsapp-connect` não é chamada e a interface permanecia em “Aguardando Meta...”.

## Alterações

- Aceita subdomínios HTTPS legítimos de `facebook.com` em vez de uma lista rígida.
- Normaliza payloads em string JSON, objeto e alguns encapsulamentos (`data`, `payload`, `message`).
- Normaliza identificadores em `session_info`, `sessionInfo` e `data.data`.
- Registra diagnóstico sanitizado de cada mensagem da Meta, sem expor `code`, token, WABA ID ou Phone Number ID.
- Exibe o diagnóstico na própria tela do WhatsApp.
- Se o OAuth devolver o `code` mas o Embedded Signup não enviar a sessão em 20 segundos, a interface sai do estado de espera e informa exatamente esse caso.
- Watchdog geral reduzido para 90 segundos para evitar travamento indefinido.

## Segurança

Nenhum token, authorization code, WABA ID, Phone Number ID ou payload bruto é mostrado no diagnóstico ou escrito intencionalmente no console.
