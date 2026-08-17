# Correção do redirect_uri — Meta Embedded Signup

O authorization code retornado pelo Facebook Login for Business fica vinculado ao `redirect_uri` usado no diálogo OAuth.
A troca do código na Graph API precisa repetir exatamente o mesmo valor.

A aplicação agora:

1. define explicitamente `redirect_uri` no `FB.login`;
2. usa a raiz HTTPS do domínio atual (`window.location.origin + /`);
3. envia esse mesmo valor ao backend junto do code;
4. o backend valida a URI e a repete no endpoint `/oauth/access_token`;
5. os logs registram apenas a origem, nunca o code ou token.

Isso corrige o erro de validação do verification code por divergência de `redirect_uri`.
