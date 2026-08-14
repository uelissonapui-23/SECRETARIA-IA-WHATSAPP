# Entrega do Módulo 2 - Conta, Empresa e Onboarding

## O que este módulo fecha

- cadastro por e-mail e senha;
- confirmação de e-mail;
- login e persistência de sessão;
- recuperação e redefinição de senha;
- proteção de rotas privadas;
- perfil do usuário;
- criação da primeira empresa;
- vínculo automático do proprietário;
- preferências de empresa e usuário;
- horário e dias de atendimento;
- seleção das categorias que a Secretária deve observar;
- onboarding retomável e obrigatório antes do uso do app;
- configurações posteriores de empresa, perfil, senha e observação;
- logout;
- arquitetura preparada para múltiplas empresas;
- reforço de RLS para impedir edição administrativa por membros comuns;
- migration incremental sem substituir a fundação anterior.

## Extração

Extraia o ZIP na raiz do projeto da Fase 1 e permita substituir os arquivos existentes indicados no pacote.

Depois aplique as migrations do Supabase e rode a validação padrão do projeto.

## Validação local esperada

```bash
npm install
npm run typecheck
npm run lint
npm run test
npm run build
```

Nesta entrega, a validação de sintaxe TS/TSX e os caminhos de imports foram executados no ambiente de geração. A instalação das dependências npm não concluiu nesse ambiente por indisponibilidade de acesso ao registry, então o build completo precisa ser confirmado no ambiente local antes do módulo seguinte ser integrado em produção.
