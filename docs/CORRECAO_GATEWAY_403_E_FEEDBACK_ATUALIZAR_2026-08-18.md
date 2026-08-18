# Correção gateway 403 + feedback do botão Atualizar

## Evidência
- CORS resolvido: OPTIONS retorna 204.
- GET/POST chegam ao Railway, mas retornam 403.
- O botão Atualizar realmente disparava GET, porém não possuía estado visual de carregamento.

## Correções
1. Autorização do gateway agora diferencia:
   - token inválido/expirado;
   - erro ao consultar company_members;
   - erro ao consultar companies;
   - usuário sem papel owner/admin.
2. Fallback seguro para empresas antigas:
   - se company_members estiver ausente, o `companies.created_by` pode confirmar o proprietário.
3. Logs do Railway agora indicam a causa da recusa sem imprimir tokens ou segredos.
4. O frontend traduz os códigos de erro em mensagens claras.
5. O botão Atualizar passa a mostrar `Atualizando...` e ícone girando.
6. Polling automático para quando há erro permanente de autorização, evitando spam de 403.

## Não muda
- nenhuma migration;
- nenhuma variável;
- nenhuma credencial;
- nenhuma integração Meta;
- nenhuma função de envio de WhatsApp.
