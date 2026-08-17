# Quarentena, rollback automático e evidências de releases da IA

Esta etapa fecha o principal circuito de segurança de releases do motor de análise.

## O que mudou

- Regressão grave continua bloqueando a IA da empresa.
- Se houver versão anterior válida, a plataforma faz rollback automático para ela antes do bloqueio.
- A versão que causou a regressão grave entra em quarentena global.
- Uma release em quarentena não pode ser ativada em nenhuma empresa até revisão explícita do Master.
- A Área Master passa a comparar releases por score médio, quantidade de avaliações, regressões, regressões graves e número de empresas usando cada versão.
- O Master pode liberar uma quarentena depois de revisar as evidências.
- Rollbacks e liberações de quarentena ficam registrados em auditoria.

## Filosofia de segurança

Rollback automático não significa liberação automática. Depois de uma regressão grave, a empresa permanece bloqueada para chamadas de IA até revisão Master, mesmo que a versão anterior tenha sido restaurada. Isso impede que uma troca automática esconda um problema operacional.

## Migração

`20260818110000_ai_release_quarantine_auto_rollback.sql`

## Função alterada

`analysis-evaluation`

Nenhuma integração WhatsApp/Meta foi alterada nesta etapa.
