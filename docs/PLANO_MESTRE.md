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

Após cada módulo, a entrega deve incluir todos os comandos necessários para instalar dependências, aplicar migrations, configurar permissões, validar banco e RLS, executar typecheck/lint/test/build, publicar no GitHub, executar automações do Supabase e publicar/testar na Vercel. Comandos pendentes de módulos anteriores também devem ser incluídos.

## Regras obrigatórias de interface e experiência

1. O sistema deve ter aparência profissional, bonita, limpa, coerente e organizada em todas as páginas.
2. A prioridade de produto é, nesta ordem: funcionalidade correta, praticidade, intuitividade e qualidade visual. Aparência nunca pode esconder, complicar ou prejudicar uma função.
3. Toda página deve ser responsiva e utilizável em celular, tablet, notebook e computador, sem depender de uma resolução específica.
4. Nenhuma informação essencial pode sair da tela, ser cortada, ficar escondida por menus, barras, botões, cards ou elementos fixos.
5. Layouts devem evitar overflow horizontal acidental. Quando o conteúdo realmente exigir largura, a solução responsiva deve ser intencional e utilizável.
6. Cards, listas, formulários, modais, tabelas e painéis devem se reorganizar conforme a largura disponível, preservando leitura e ações.
7. Textos longos, nomes de clientes, empresas, serviços, endereços e conteúdo gerado pela IA devem quebrar linha ou truncar de forma controlada, sempre com forma de acessar a informação completa quando necessário.
8. Botões e ações principais devem permanecer claros e acessíveis em telas pequenas, sem sobreposição ou áreas de toque inadequadas.
9. Estados de carregamento, vazio, erro, sucesso, conexão, desconexão e falta de permissão devem fazer parte da página definitiva de cada módulo.
10. Cada página deve ser entregue como página definitiva do módulo, prevendo estados normais e extremos de conteúdo, não apenas o cenário ideal de demonstração.
11. A navegação deve usar linguagem simples para pequenos empresários e minimizar etapas, campos e decisões desnecessárias.
12. Antes de fechar cada módulo, a validação visual deve cobrir pelo menos larguras representativas de celular, tablet e desktop, além de conteúdo longo e listas vazias/cheias.

## Regra de banco e Data API

O projeto mantém `Automatically expose new tables` desativado no Supabase. Portanto, toda migration que crie uma tabela, view, função ou sequência acessada pelo cliente deve declarar explicitamente os privilégios SQL necessários para os papéis `authenticated` e, somente quando houver motivo real, `anon`. RLS continua obrigatória e é a camada de autorização por linha. Nenhuma funcionalidade deve depender de privilégios implícitos do dashboard do Supabase.

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
Status: em fechamento e validação publicada.

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

### Módulo 10 - Administração Master, custos e saúde

Inclui uma área administrativa exclusiva da plataforma, separada das áreas das empresas. Terá usuário Master e papéis administrativos próprios, visão de usuários e empresas, status de contas, planos e assinaturas, consumo, custos de IA, conexão WhatsApp, jobs, falhas, auditoria, retenção, diagnósticos, ferramentas de suporte e ações administrativas controladas.

A autorização da plataforma é independente de `company_members`. Ser owner/admin de uma empresa nunca concede acesso Master. Nenhum usuário do frontend pode promover a própria conta. A base permanente utiliza `platform_admins`, controles administrativos e auditoria sem acesso direto pelas tabelas públicas do navegador. Ações sensíveis serão executadas no backend, exigirão revalidação de papel e gerarão registro de auditoria.

A área Master deverá evitar exposição desnecessária do conteúdo das conversas. Ferramentas de suporte que futuramente precisem consultar conteúdo sensível deverão ser restritas, justificáveis e auditadas.

### Módulo 11 - Apresentação pública e conversão

Inclui área pública profissional do produto, acessível sem login, com apresentação clara da Secretária IA, demonstração do funcionamento, benefícios, recursos, segurança/privacidade, perguntas frequentes, planos quando disponíveis e chamadas para criar conta, iniciar teste ou contratar. A jornada pública deve conduzir o interessado da descoberta até cadastro/compra sem misturar a área comercial com o aplicativo autenticado.

A arquitetura de rotas deverá reservar uma área pública independente da aplicação interna, permitindo SEO, compartilhamento e evolução comercial sem alterar as páginas operacionais. Não serão criadas páginas provisórias: este módulo será entregue completo quando chegar sua fase.

### Módulo 12 - Comercialização e assinaturas

Inclui planos, limites, período de teste, checkout, cobrança, assinatura, estados de pagamento, upgrade/downgrade, bloqueios graduais, reativação, política de uso, LGPD operacional, termos e fluxo de cancelamento/exclusão. Integra-se à apresentação pública e ao painel Master, mas mantém cobrança isolada da lógica operacional da empresa.

### Módulo 13 - Fechamento e piloto

Inclui revisão integral, testes de regressão, PWA final, performance, acessibilidade essencial, segurança, recuperação de falhas, documentação, piloto interno, piloto 3 empresas e piloto 10 empresas.


## Regras permanentes de administração da plataforma

1. O sistema terá uma camada de administração da plataforma separada das permissões de cada empresa.
2. Papéis administrativos previstos: `master`, `support`, `billing` e `viewer`, com princípio de menor privilégio.
3. O papel `master` não poderá ser obtido por cadastro, convite de empresa, alteração de perfil ou requisição do frontend.
4. Tabelas administrativas não serão expostas diretamente ao usuário comum pela Data API.
5. Toda ação sensível do painel Master deverá ser autorizada no backend e auditada.
6. Suspensão/bloqueio de usuário deverá preservar dados e rastreabilidade; exclusão definitiva seguirá fluxo próprio e requisitos de LGPD.
7. O painel Master deverá permitir gestão operacional sem quebrar o isolamento entre empresas.
8. Métricas administrativas podem agregar dados entre empresas, mas o acesso ao conteúdo privado será minimizado e controlado separadamente.

## Regras permanentes da área pública

1. A apresentação comercial será pública e independente da área autenticada.
2. O visitante deverá compreender o produto rapidamente, ver como funciona e encontrar um caminho claro para cadastro, teste e futura compra.
3. Login/cadastro continuarão conectados à mesma identidade do aplicativo, evitando contas duplicadas.
4. A área pública deverá ser responsiva, rápida, acessível e preparada para SEO/compartilhamento.
5. Planos e checkout serão conectados somente quando o módulo comercial estiver implementado; não haverá botões falsos ou fluxos incompletos.

## Backlog posterior à V1

- Google Agenda
- leitura/transcrição de áudio
- análise de imagens/documentos
- sugestão e envio de respostas ao cliente
- app nativo Android/iOS, somente se houver necessidade comercial ou técnica comprovada

## Critério de sucesso da V1

O produto prova valor quando o empresário recebe um lembrete relevante que teria esquecido, consegue abrir o contexto original em segundos, confirma que a interpretação está correta e passa a confiar que a Secretária o ajuda sem exigir alimentação manual constante do sistema.
