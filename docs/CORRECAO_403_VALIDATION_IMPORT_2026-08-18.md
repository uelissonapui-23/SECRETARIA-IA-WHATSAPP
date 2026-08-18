# Correção do 403 da validation-import

## Evidência observada
- OPTIONS retorna 200.
- POST chega à função e retorna 403.
- A invocação contém usuário autenticado (`auth_user`), portanto a requisição não está falhando por ausência de login.

## Causa arquitetural corrigida
A função verificava o papel do usuário consultando `company_members` com um cliente administrativo.
Isso criava uma dependência desnecessária da service-role apenas para autorização e escondia erros da consulta,
transformando qualquer falha em `not_company_admin`.

A autorização agora usa:
1. JWT real do usuário;
2. `auth.getUser(token)`;
3. consulta a `company_members` com o próprio contexto autenticado e RLS.

Esse é o mesmo modelo de autorização usado pelo frontend e segue o princípio de menor privilégio.

## Diagnóstico
A função agora registra:
- `membership-check`
- `membership-query-failed`
- papel encontrado e resultado da autorização

E o frontend passa a mostrar a mensagem JSON devolvida pela função em vez de apenas
`Edge Function returned a non-2xx status code`.

## Sem mudanças
- nenhuma migration;
- nenhuma alteração Meta/WhatsApp;
- nenhum segredo exposto no frontend.
