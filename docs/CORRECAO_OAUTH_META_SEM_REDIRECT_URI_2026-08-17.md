# Correção OAuth Meta — Embedded Signup sem redirect_uri manual

## Causa confirmada

O WhatsApp Embedded Signup é iniciado pelo Facebook JavaScript SDK (`FB.login`) com `config_id`, `response_type: 'code'` e `override_default_response_type: true`.

Nesse fluxo, não devemos forçar um `redirect_uri` da aplicação no `FB.login` nem repetir esse parâmetro na troca do código. A documentação oficial de onboarding da Meta mostra a troca em `GET /oauth/access_token` com `client_id`, `client_secret` e `code`.

Forçar `https://secretaria-ia-whatsapp-iota.vercel.app/` nos dois lados fazia o código retornado pelo popup do SDK ser validado contra uma URI diferente daquela associada internamente pela Meta, gerando erro 100 / subcode 36008.

## Alterações

- removido `redirect_uri` das opções de `FB.login`;
- removido `redirect_uri` do payload enviado ao backend;
- removido `redirect_uri` da chamada `/oauth/access_token`;
- preservados `config_id`, `response_type: 'code'`, `override_default_response_type: true` e o modo de coexistência.
