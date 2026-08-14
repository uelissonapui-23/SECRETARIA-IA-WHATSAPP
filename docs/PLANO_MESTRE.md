# Plano Mestre Oficial - Secretária IA

## Objetivo do produto

Criar uma Secretária IA para micro e pequenos empresários que trabalham principalmente pelo WhatsApp. O sistema acompanha novas mensagens a partir da ativação, identifica informações operacionais relevantes, organiza pendências e lembra o empresário. Toda interpretação importante deve ser verificável por meio do contexto de origem.

## Regras fechadas da V1

1. A IA não envia mensagens aos clientes.
2. A IA não lê ou transcreve áudios.
3. A IA não varre histórico antigo.
4. O monitoramento começa no instante de ativação da conexão oficial do WhatsApp.
5. A IA pode consultar somente uma janela curta de mensagens anteriores quando uma nova mensagem depender de contexto.
6. Todo evento criado pela IA deve manter referência à mensagem de origem e ao contexto necessário.
7. Google Agenda fica fora da V1, mas a agenda interna deve nascer independente para permitir integração futura.
8. A PWA é a interface principal. Processamentos críticos rodam no backend e não dependem da PWA aberta.
9. O sistema nasce multiempresa e com isolamento por RLS.
10. A IA atua em modo observação: identifica, organiza, sugere e lembra; o empresário decide.

## Regra oficial de desenvolvimento por módulos

O projeto será construído por módulos completos, e não por funções isoladas. Cada módulo deve ser entregue já compatível com o produto final e incluir todas as capacidades naturalmente pertencentes àquele módulo que já estejam previstas no Plano Mestre. A meta é evitar reabrir páginas e estruturas por falta de funções previsíveis.

Cada módulo passa por: analisar, planejar, implementar, revisar impactos, validar e entregar. A entrega padrão é um ZIP com arquivos nos caminhos corretos para extração na raiz do projeto. Migrations são sempre incrementais e versionadas. Nenhum módulo pode apagar ou substituir silenciosamente dados de módulos anteriores.

## Arquitetura

- Frontend: React + TypeScript + Vite
- Plataforma cliente: PWA mobile-first e desktop responsiva
- Backend e banco: Supabase/PostgreSQL
- Autenticação: Supabase Auth
- Segurança: RLS, secrets somente backend, auditoria e isolamento por `company_id`
- WhatsApp: integração oficial Meta WhatsApp Business Platform/Cloud API
- IA: camada própria de serviço, com classificação barata e escalonamento quando necessário
- Deploy: GitHub + Vercel + Supabase migrations/functions
- Google Agenda: integração futura via camada de integração, sem tornar a agenda interna dependente do Google

## Módulos oficiais

### Módulo 1 - Fundação técnica
Status: concluído.

Inclui PWA, estrutura React/Vite/TypeScript, Supabase, banco multiempresa, RLS inicial, pipeline de webhook/job, estrutura de mensagens e sugestões, CI e deploy.

### Módulo 2 - Conta, empresa e onboarding
Status: concluído nesta entrega.

Inclui cadastro, login, confirmação de e-mail, recuperação e redefinição de senha, persistência de sessão, proteção de rotas, perfil, criação da primeira empresa, vínculo owner, preferências, horário de atendimento, seleção do que a Secretária deve observar, conclusão retomável do onboarding, configurações editáveis, logout e reforço das políticas de membros.

A arquitetura aceita múltiplas empresas por usuário sem refazer autenticação ou banco. A interface de troca de empresa poderá ser exposta quando o módulo de equipe/multiempresa exigir.

### Módulo 3 - WhatsApp oficial e conexão empresarial
Próximo.

Será entregue completo para o escopo do projeto: configuração de integração Meta, Embedded Signup quando aplicável, estados da conexão, callback seguro, credenciais somente backend, webhook verificado, assinatura/validação, vínculo WABA/número à empresa, ativação temporal do monitoramento, reconexão, desconexão, tratamento de falhas, painel de status e prova real de recebimento de novas mensagens de texto.

### Módulo 4 - Motor IA e contexto verificável

Inclui filtro de relevância, classificação, extração estruturada, contexto curto sob demanda, confiança, regras por empresa, deduplicação semântica, sugestões, origem, “Ver contexto”, “Por que estou vendo isso?”, feedback de acerto/erro, métricas de tokens/custo e abstração de provedor.

### Módulo 5 - Central da Secretária e notificações

Inclui Home definitiva, Hoje, Precisa da sua atenção, pendências, lembretes, resumo diário, notificações web push, preferências de notificação, deep links e resolução das sugestões.

### Módulo 6 - Agenda interna definitiva

Inclui agendamentos, edição, cancelamento, status, dia/semana/mês, conflitos, cliente/endereço/origem, lembretes e base preparada para Google Calendar futuro.

### Módulo 7 - Trabalho e clientes

Inclui clientes, pedidos/serviços, orçamentos em acompanhamento, tarefas, promessas de pagamento, prazos, retornos, histórico operacional e relacionamento com sugestões da IA.

### Módulo 8 - Memória operacional

Inclui memória estruturada da empresa e do cliente, preferências aprendidas com correções, regras seguras e explicáveis, sem treinamento indiscriminado sobre conversas privadas.

### Módulo 9 - Equipe, papéis e múltiplas empresas

Inclui convites, owner/admin/member, permissões, responsáveis por tarefas/agendamentos, troca de empresa, auditoria e isolamento completo.

### Módulo 10 - Administração, custos e saúde

Inclui painel operacional interno, métricas por empresa, erros de webhook/IA, custo estimado, jobs, auditoria, retenção, diagnósticos e ferramentas seguras de suporte.

### Módulo 11 - Comercialização

Inclui planos, limites, teste, cobrança, estados de assinatura, bloqueios graduais, política de uso, LGPD operacional, termos e fluxo de cancelamento/exclusão.

### Módulo 12 - Fechamento e piloto

Inclui revisão integral, testes de regressão, PWA final, performance, acessibilidade essencial, segurança, recuperação de falhas, documentação, piloto interno, piloto 3 empresas e piloto 10 empresas.

## Backlog posterior à V1

- Google Agenda
- leitura/transcrição de áudio
- análise de imagens/documentos
- sugestão e envio de respostas ao cliente
- app nativo Android/iOS, somente se houver necessidade comercial ou técnica comprovada

## Critério de sucesso da V1

O produto prova valor quando o empresário recebe um lembrete relevante que teria esquecido, consegue abrir o contexto original em segundos, confirma que a interpretação está correta e passa a confiar que a Secretária o ajuda sem exigir alimentação manual constante do sistema.
