# Correção do progresso do onboarding

## Causa raiz

A RPC da etapa 2 concluía com HTTP 200. O travamento visual era causado pelo ciclo de recarga do `CompanyProvider`: `refresh()` ativava `loading`, o `AppGuard` desmontava o `OnboardingPage` e o wizard era recriado com `step = 2` para qualquer empresa ainda incompleta.

## Correção definitiva

- `companies.onboarding_step` passa a persistir o progresso real do wizard.
- Etapa 1 grava progresso 2.
- Etapa 2 grava progresso 3.
- Etapa 3 grava progresso 4.
- Conclusão mantém etapa 4 e define `onboarding_completed_at`.
- `CompanyProvider` carrega `onboarding_step`.
- O wizard inicia pela etapa persistida e sobrevive a reload, logout/login e remontagens.
- As etapas 2 e 3 não forçam recarga do provider durante a navegação, eliminando desmontagem e flicker desnecessários.
