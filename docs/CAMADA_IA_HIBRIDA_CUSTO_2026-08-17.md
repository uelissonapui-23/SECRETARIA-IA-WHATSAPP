# Camada de IA híbrida e controle de custo

- Provedor server-side desacoplado e configurável por `AI_BASE_URL`, `AI_MODEL` e `AI_API_KEY`.
- Segredos nunca são enviados ao frontend.
- Modos por empresa: regras, híbrido (IA + regras) e IA com fallback.
- IA começa desabilitada por empresa; ativação é explícita.
- Fallback para `rules-v1` em indisponibilidade, configuração ausente ou limite diário.
- Limites diários por tokens e custo estimado.
- Telemetria registra provedor/modelo, tokens, custo estimado e fallback sem armazenar texto bruto adicional.
- Laboratório usa o mesmo motor selecionado pela empresa.
- Área Master mostra uso agregado de IA nas últimas 24 horas.
- Meta/WhatsApp permanece sem alteração nesta etapa.

## Segredos para ativação futura
Configure os segredos nas Edge Functions: `AI_API_KEY`, `AI_MODEL` e, se necessário, `AI_BASE_URL`. Os preços opcionais `AI_INPUT_COST_PER_1M` e `AI_OUTPUT_COST_PER_1M` alimentam o custo estimado.
