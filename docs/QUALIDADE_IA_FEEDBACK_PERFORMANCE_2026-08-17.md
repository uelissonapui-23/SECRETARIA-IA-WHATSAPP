# Qualidade da IA, feedback humano e performance — 2026-08-17

## Objetivo
Transformar as decisões humanas em métricas verificáveis de qualidade sem treinar automaticamente o sistema nem armazenar texto bruto adicional.

## Entrega
- tabela `analysis_feedback` com RLS por empresa;
- confirmação de sugestão registra feedback positivo;
- ação **Está errado** registra feedback negativo e usa o status `wrong` já existente;
- laboratório permite avaliar cada candidato como correto/incorreto;
- painel de qualidade de 30 dias na Central da Secretária;
- métricas agregadas de qualidade na Área Master;
- nenhum feedback altera prompts, regras ou responde clientes automaticamente;
- rotas operacionais carregadas com `React.lazy`, reduzindo o bundle inicial e preparando code splitting real.

## Segurança
O feedback armazena metadados (tipo, confiança, engine e veredito). O texto bruto do laboratório não é copiado para a tabela de feedback.

## WhatsApp
Nenhuma alteração foi feita no fluxo de conexão Meta/WhatsApp nesta etapa.
