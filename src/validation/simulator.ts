export type SimulationTurn = {
  direction: 'inbound' | 'outbound'
  body: string
  delayMs?: number
}

export type SimulationScenario = {
  id: 'appointment' | 'quote' | 'payment' | 'mixed' | 'nothing'
  title: string
  description: string
  contactName: string
  turns: SimulationTurn[]
}

export const simulationScenarios: SimulationScenario[] = [
  {
    id: 'appointment',
    title: 'Agendamento',
    description: 'Cliente conversa normalmente e termina pedindo um horário.',
    contactName: 'Carlos Demo',
    turns: [
      { direction: 'inbound', body: 'Oi, vocês fazem visita técnica?', delayMs: 900 },
      { direction: 'outbound', body: 'Fazemos sim. Qual horário fica melhor para você?', delayMs: 900 },
      { direction: 'inbound', body: 'Pode deixar marcado para amanhã às 15h.', delayMs: 900 },
    ],
  },
  {
    id: 'quote',
    title: 'Orçamento e prazo',
    description: 'Cliente pede orçamento e combina um prazo para receber.',
    contactName: 'Mariana Demo',
    turns: [
      { direction: 'inbound', body: 'Quero fazer um orçamento para envelopar uma geladeira comercial.', delayMs: 900 },
      { direction: 'outbound', body: 'Certo. Vou levantar as informações para você.', delayMs: 900 },
      { direction: 'inbound', body: 'Se puder me mandar o orçamento até sexta de manhã eu agradeço.', delayMs: 900 },
    ],
  },
  {
    id: 'payment',
    title: 'Promessa de pagamento',
    description: 'Cliente informa quando pretende pagar.',
    contactName: 'João Demo',
    turns: [
      { direction: 'outbound', body: 'Ficou faltando o saldo de R$ 250 do serviço.', delayMs: 900 },
      { direction: 'inbound', body: 'Pode deixar, faço o PIX de R$ 250 na sexta-feira.', delayMs: 900 },
    ],
  },
  {
    id: 'mixed',
    title: 'Fluxo completo',
    description: 'Uma conversa maior com orçamento, retorno e agendamento.',
    contactName: 'Ana Demo',
    turns: [
      { direction: 'inbound', body: 'Bom dia, queria saber o valor para fazer o adesivo da minha vitrine.', delayMs: 750 },
      { direction: 'outbound', body: 'Bom dia! Consigo preparar um orçamento. Você tem as medidas?', delayMs: 750 },
      { direction: 'inbound', body: 'Tenho sim, são 2 metros por 1,20. Te mando as fotos depois do almoço.', delayMs: 750 },
      { direction: 'outbound', body: 'Perfeito, fico aguardando.', delayMs: 750 },
      { direction: 'inbound', body: 'Mando as fotos às 14h e pode deixar uma visita marcada para quinta às 16h?', delayMs: 750 },
    ],
  },
  {
    id: 'nothing',
    title: 'Sem ação necessária',
    description: 'Serve para confirmar que a Secretária também sabe não interromper.',
    contactName: 'Cliente Satisfeito',
    turns: [
      { direction: 'inbound', body: 'Obrigado pelo atendimento, ficou ótimo! Bom trabalho para vocês.', delayMs: 900 },
    ],
  },
]

export function scenarioById(id: SimulationScenario['id']) {
  return simulationScenarios.find((scenario) => scenario.id === id) ?? simulationScenarios[0]
}

export function inboundTurns(scenario: SimulationScenario) {
  return scenario.turns.filter((turn) => turn.direction === 'inbound').length
}
