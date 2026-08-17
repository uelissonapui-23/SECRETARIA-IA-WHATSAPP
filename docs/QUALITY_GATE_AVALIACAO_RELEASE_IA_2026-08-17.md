# Quality Gate da IA — 2026-08-17

- Cenários de avaliação em lote por empresa, com conjunto padrão sem dados reais.
- Comparação entre rules-v1 e motor ativo quando o provedor estiver autorizado.
- Baseline e detecção de regressões por cenário.
- Liberação Master separada da preferência da empresa: locked, pilot, enabled.
- Edge Functions verificam o gate antes de qualquer chamada a provedor real.
- Nenhum segredo é exposto no frontend.
- Meta/WhatsApp permanece intocado nesta entrega.
