# Simulador automático de mensagens — 2026-08-18

## Objetivo
Validar a experiência central da Secretária IA sem depender da aprovação comercial da Meta e sem usar automação não oficial do WhatsApp Web.

O usuário não precisa exportar conversa a cada mensagem. A tela oferece cenários automáticos que representam mensagens chegando de um webhook. Depois de clicar em **Iniciar simulação automática**, os turnos entram sozinhos no pipeline existente.

## Pipeline utilizado

Simulador -> `validation-import` -> `contacts` -> `conversations` -> `messages` -> `message_jobs` -> `process-message` -> `ai_suggestions` -> Central da Secretária.

O motor operacional abaixo do conector é o mesmo que será usado pela Meta no futuro.

## Cenários incluídos
- Agendamento
- Orçamento e prazo
- Promessa de pagamento
- Fluxo completo
- Sem ação necessária

O cenário "Sem ação necessária" é importante para validar que a Secretária sabe não interromper o usuário quando não existe ação útil.

## Modos disponíveis
1. **Simulação automática** — principal para demonstração e validação do valor.
2. **Mensagem manual** — testa uma frase específica.
3. **Conversa exportada** — laboratório opcional para contexto real, não rotina diária do cliente.

## Segurança
- Não abre sessão de WhatsApp Web.
- Não escaneia QR Code.
- Não envia mensagens a clientes.
- Não usa bibliotecas que imitam o WhatsApp Web.
- Dados criados continuam identificados como validação e podem ser limpos separadamente.
- Apenas Owner/Admin podem usar a importação/simulação.

## Futuro
Quando a integração oficial estiver disponível, o simulador permanece apenas como ferramenta de QA. A fonte muda para Meta Webhook, preservando o restante do pipeline.
