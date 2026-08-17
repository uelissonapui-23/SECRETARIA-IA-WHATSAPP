# Fila de análise, resiliência e reprocessamento

Entrega estrutural posterior ao motor `rules-v1`.

## O que entrou

- fila de análise visível para Owner/Admin sem expor o texto bruto;
- limite de tentativas por mensagem e classificação `retryable`/`exhausted`;
- registro de última tentativa e conclusão;
- reprocessamento manual de uma mensagem ou lote pequeno de falhas;
- Edge Function `analysis-control`, autenticada pelo usuário e autorizada por empresa;
- o segredo do worker continua somente no servidor;
- indicadores de fila na Central da Secretária e Área Master;
- testes unitários dos estados e regras de retry;
- telemetria e auditoria das ações de reprocessamento.

## Segurança

O frontend nunca recebe `WORKER_SECRET` nem service role. `analysis-control` valida o JWT e exige Owner/Admin antes de chamar `process-message` internamente.

## Escopo

Esta etapa não altera WhatsApp/Meta e não envia respostas automáticas a clientes. O modo observação continua sendo a regra do produto.
