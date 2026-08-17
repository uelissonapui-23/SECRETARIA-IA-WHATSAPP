# Fechamento pré-Meta — qualidade, segurança e resiliência

Esta etapa agrupa os últimos blocos técnicos antes do retorno à integração Meta/WhatsApp.

## Resiliência de interface
- Error Boundary global evita tela branca em erro inesperado.
- mensagem amigável com Atualizar e Voltar ao Início;
- detalhes técnicos aparecem apenas em desenvolvimento.

## Falha de conexão
- aviso global quando o dispositivo fica offline;
- explica que navegação já carregada pode continuar, mas alterações dependem da internet.

## Responsividade e acessibilidade
- preserva Responsividade V3;
- reforça contenção de botões, links, inputs e textos;
- foco visível para teclado;
- tratamento específico de erro/offline no celular.

## Auditoria preventiva automatizada
Novo teste `securityAudit.test.ts` impede regressões simples:
- tabela pública criada sem RLS;
- SECURITY DEFINER sem `set search_path = public`;
- referências a chaves administrativas dentro do frontend.

Novo teste `responsiveContract.test.ts` protege os breakpoints e regras estruturais obrigatórias.

## Performance/PWA
A aplicação já utiliza lazy loading por rota e o build atual gera chunks separados por página. Esta etapa preserva essa estrutura e evita voltar a um bundle monolítico.

## Meta/WhatsApp
Nenhuma alteração nesta integração. A conexão continua congelada até a conclusão da validação pré-Meta.
