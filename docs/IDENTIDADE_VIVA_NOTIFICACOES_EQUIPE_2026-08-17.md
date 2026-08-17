# Identidade visual V2 + notificações + equipe

Esta entrega mantém o núcleo operacional e a integração WhatsApp congelada, mas deixa a experiência mais viva e prepara o uso diário do produto.

## Visual
- paleta principal: azul-marinho, turquesa, azul-violeta, coral e amarelo quente;
- fundos tonais discretos, gradientes leves e sombras suaves;
- hierarquia mais forte nos cards, navegação e cabeçalhos;
- estados vazios e indicadores mais amigáveis sem excesso de cor;
- responsividade preservada.

## Notificações
- sino do cabeçalho passa a abrir uma central real baseada em `app_notifications`;
- contador de não lidas;
- ação para marcar todas como lidas;
- preferências por empresa para notificações, atrasos e novas sugestões.

## Resumo diário
- preferência para habilitar/desabilitar;
- horário configurável por empresa;
- estrutura de banco pronta para o mecanismo futuro de geração/entrega.

## Equipe
- Configurações passam a exibir membros da empresa e seus papéis;
- leitura é feita por RPC segura, limitada a membros da própria empresa;
- não foi criado fluxo de convite nesta entrega.

## Banco
Aplicar a migration `20260817150000_experience_notifications_team.sql` antes de usar as novas preferências/equipe em produção.
