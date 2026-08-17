# Fluxo diário simples e conectado — 2026-08-17

Objetivo: fazer o usuário resolver o dia com poucos cliques e sem precisar conhecer a estrutura interna do sistema.

## Início
- Mantém o bloco **Comece por aqui** para as ações mais comuns.
- Adiciona **Seu dia em 30 segundos**, que resume a próxima ação mais importante em linguagem simples.
- Direciona automaticamente para Trabalho, Secretária ou Agenda conforme a prioridade encontrada.

## Clientes
- O histórico do cliente passa a funcionar como ponto de partida para ações comuns.
- Dentro do cliente existem atalhos diretos para:
  - Agendar compromisso
  - Criar tarefa
  - Criar trabalho
- O cliente já chega selecionado no formulário de destino.

## Agenda
- Aceita abertura contextual por URL.
- Quando a Agenda é aberta a partir de um cliente, o formulário já inicia com aquele cliente vinculado.

## Trabalho
- Aceita abertura contextual para Tarefa ou Trabalho.
- Quando aberto a partir de um cliente, o formulário já inicia com o cliente selecionado.

## Secretária
- Mantém a simplificação da etapa anterior:
  - Atenção
  - Memória
  - Lembretes
- Ferramentas técnicas continuam escondidas em **Ferramentas avançadas** para Owner/Admin.

## Segurança e arquitetura
- Nenhuma migration nova.
- Nenhuma Edge Function nova.
- Nenhuma alteração no fluxo Meta/WhatsApp.
- Nenhuma automação passa a responder clientes sozinha.

## Validação local da entrega
- TypeScript: OK
- ESLint dos arquivos funcionais alterados: 0 erros
