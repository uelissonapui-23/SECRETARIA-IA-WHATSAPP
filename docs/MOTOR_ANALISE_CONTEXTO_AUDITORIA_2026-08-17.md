# Motor de análise, contexto e auditoria — 2026-08-17

Esta etapa transforma o classificador provisório em um motor estruturado `rules-v1`, ainda sem custo externo e sem envio automático de mensagens.

## Entregue

- política de análise por empresa (`analysis_policies`);
- telemetria sem armazenar texto bruto (`analysis_runs`);
- múltiplas sugestões por mensagem quando aplicável;
- uso de contexto curto da conversa e memória operacional;
- respeito aos monitores configurados pela empresa;
- deduplicação por mensagem + tipo de sugestão;
- laboratório seguro na Central da Secretária para testar exemplos sem WhatsApp;
- auditoria da empresa visível apenas a owner/admin;
- saúde do motor e fila de jobs na Área Master;
- `analysis-lab` autenticada e `process-message` usando o mesmo analisador compartilhado.

## Segurança e privacidade

O laboratório não envia mensagem para cliente. A telemetria de análise registra contagens, duração, engine e erro, mas não grava o texto bruto testado. A ação real continua dependendo de confirmação humana.

## Próxima evolução

O ponto de troca para um LLM real ficou desacoplado. Quando for habilitado, a saída deverá manter o mesmo contrato estruturado de candidatos, validação, confiança, auditoria e confirmação humana.
