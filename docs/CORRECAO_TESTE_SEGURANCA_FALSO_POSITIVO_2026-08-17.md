# Correção do teste de segurança

O teste `securityAudit.test.ts` estava lendo todos os arquivos JavaScript/TypeScript de `src`, inclusive o próprio arquivo de teste.

Como o próprio teste continha a expressão usada para detectar `META_APP_SECRET`, ele acusava um falso positivo.

## Correção
- arquivos `*.test.*` e `*.spec.*` são excluídos da varredura do frontend de produção;
- o nome sensível do segundo detector é montado dinamicamente no próprio teste, evitando autocolisão futura;
- a verificação continua cobrindo os arquivos reais do frontend.

Nenhum código de produção, migration ou integração Meta/WhatsApp foi alterado.
