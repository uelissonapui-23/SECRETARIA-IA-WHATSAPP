# Correção do Piloto 24h — 403 + feedback do Atualizar

## Evidência
- CORS passou: OPTIONS 204.
- GET/POST chegaram ao Railway e retornaram 403.
- O botão Atualizar executava a chamada, mas não apresentava estado visual de carregamento.

## Alterações
1. O gateway passa a validar o JWT do usuário com o cliente de servidor (`admin.auth.getUser(token)`), removendo dependência desnecessária da publishable key nessa etapa.
2. A autorização continua exigindo `owner` ou `admin` em `company_members`.
3. Para empresas antigas, existe fallback restrito: somente `companies.created_by === user.id` é reconhecido como owner. Isso não concede acesso a terceiros.
4. Logs seguros indicam em qual etapa a autorização falhou sem registrar token/chaves.
5. O botão Atualizar agora mostra spinner, texto `Atualizando...` e confirmação `Status atualizado agora.` quando termina.

## Sem mudanças
- nenhuma migration;
- nenhuma função de envio de WhatsApp;
- nenhuma chave movida para o frontend;
- isolamento por `company_id` mantido.
