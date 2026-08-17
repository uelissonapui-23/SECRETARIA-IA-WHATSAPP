# Checklist de aceite antes de voltar para Meta/WhatsApp

## Estrutura concluída
- Login, cadastro, recuperação de senha e onboarding.
- Primeiro acesso Master e Área Master simplificada.
- Início, Agenda, Trabalho, Clientes, Secretária e Configurações.
- Memória, notificações, automações internas e resumo operacional.
- Motor de análise por regras, IA híbrida, fallback, custo e telemetria.
- Avaliação, feedback, quality gate, releases, rollback, quarentena e saúde da IA.
- Lazy loading dos módulos e PWA.

## Fechamento desta etapa
- Error Boundary global.
- Aviso offline.
- Testes estáticos de RLS/segredos no frontend.
- Contrato de responsividade.
- Contrato de prontidão pré-Meta.
- Reforço para telas muito pequenas, telas baixas, toque e TVs/monitores grandes.

## Critérios para voltar ao Meta
Antes de retomar o Embedded Signup, executar no Windows:

```powershell
npm run lint
npm run test
npm run build
npx supabase db push
```

O `db push` deve informar que o banco remoto está atualizado, salvo se houver migration pendente criada após este checklist.

## Meta/WhatsApp — ponto de retomada
O fluxo ficou congelado depois de confirmar que:
- autenticação e permissão da empresa chegam corretamente ao backend;
- a falha restante ocorre na troca do authorization code do Embedded Signup;
- a Meta retorna erro OAuth `100 / 36008` relacionado ao `redirect_uri`.

Na retomada, revisar a documentação oficial atual da Meta antes de alterar o fluxo novamente.
