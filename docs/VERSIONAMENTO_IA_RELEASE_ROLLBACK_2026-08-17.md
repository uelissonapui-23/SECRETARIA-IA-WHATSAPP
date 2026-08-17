# Versionamento da IA, aprovação e rollback

Este bloco adiciona governança de versões do motor/configuração da Secretária IA.

- Releases são criadas como rascunho e são imutáveis quanto à configuração operacional registrada.
- Somente Master aprova uma release.
- Somente releases aprovadas podem ser ativadas em empresas.
- Cada empresa mantém a release ativa e a anterior, permitindo rollback auditado.
- Ativação/rollback aplica ao `analysis_policies` somente parâmetros públicos de execução; segredos continuam fora do banco/frontend.
- Todas as ações críticas geram registro em `platform_audit_logs` e histórico específico de release.
- A liberação `locked/pilot/enabled` continua independente da versão: uma empresa bloqueada não passa a chamar IA apenas porque recebeu uma release.
