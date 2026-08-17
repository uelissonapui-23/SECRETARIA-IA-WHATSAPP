# Responsividade V3 + ações rápidas — 2026-08-17

## Correção global
- Sidebar deixa de disputar espaço com o conteúdo em notebooks e tablets (até 1100px) e passa para navegação inferior.
- Faixa intermediária de notebook (1101–1350px) usa menu mais compacto e grids de duas colunas.
- Cards, painéis, ações, abas, modais e textos passam a respeitar integralmente a viewport.
- Ações rápidas do Início usam grid fluido e deixam de escapar horizontalmente.
- Em celular, cards de resumo viram uma coluna quando necessário.
- Linhas de Agenda e Trabalho reorganizam conteúdo e botões sem sobreposição.
- Abas extensas podem rolar horizontalmente sem empurrar a página inteira.
- Ajustes adicionais para celular pequeno, paisagem baixa, desktop e TV.

## Próximo bloco incorporado
### Trabalho
- Editar passa a ser ação textual e mais fácil de reconhecer.
- Novo atalho **Amanhã** adia o prazo em um dia sem abrir formulário.
- **Concluir** permanece disponível como ação direta e ganha destaque visual discreto.

### Agenda
- **Concluir** e **Cancelar** passam a exibir texto, evitando depender apenas de ícones.
- **Editar / reagendar** continua como ação direta.

## Segurança
- Sem migration nova.
- Sem Edge Function nova.
- Sem alteração em Meta/WhatsApp.
- Operações continuam limitadas por company_id e pelas políticas existentes.

## Validação local no ambiente de geração
- TypeScript: OK.
- ESLint: 0 erros; permanecem os 2 warnings já existentes em AuthProvider e CompanyProvider.
- Test/build completos não puderam rodar neste Linux porque o ZIP contém node_modules instalado no Windows e faltam bindings nativos Linux de Rollup/Rolldown. Devem ser executados normalmente no ambiente Windows do projeto.
