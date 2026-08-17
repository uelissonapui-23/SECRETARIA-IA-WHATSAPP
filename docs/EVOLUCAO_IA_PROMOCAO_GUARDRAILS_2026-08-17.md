# Evolução da IA, promoção e guardrails — 2026-08-17

Esta etapa adiciona histórico comparativo por release e empresa, critérios objetivos de promoção em piloto e bloqueio automático quando uma avaliação detecta regressão grave.

## Regras de segurança
- Auto-promoção nasce desligada por empresa.
- Auto-bloqueio por regressão grave nasce ligado.
- Promoção automática só pode ocorrer no estado `pilot`, com release ativa, quantidade mínima de execuções, score mínimo, regressões dentro do limite e nenhuma regressão grave.
- Regressão grave considera quantidade de casos que regrediram e queda de score em relação ao baseline.
- Toda promoção/bloqueio automático gera histórico e auditoria Master.
- Nenhum segredo de provedor é exposto ao frontend.

## Dados adicionados
- `platform_ai_guardrails`
- `platform_ai_auto_actions`
- métricas de release/baseline/score delta em `analysis_evaluation_runs`
- RPCs Master de evolução e configuração de guardrails.

## Fluxo
Avaliação -> comparação com baseline -> classificação de regressão -> guardrails -> manter piloto / promover / bloquear.
