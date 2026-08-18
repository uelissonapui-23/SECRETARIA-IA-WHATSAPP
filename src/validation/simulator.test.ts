import { describe, expect, it } from 'vitest'
import { inboundTurns, scenarioById, simulationScenarios } from './simulator'

describe('simulador de mensagens', () => {
  it('oferece cenários essenciais de validação', () => {
    expect(simulationScenarios.map((item) => item.id)).toEqual(expect.arrayContaining(['appointment','quote','payment','mixed','nothing']))
  })

  it('mantém ao menos uma mensagem recebida em cada cenário', () => {
    for (const scenario of simulationScenarios) expect(inboundTurns(scenario)).toBeGreaterThan(0)
  })

  it('retorna um cenário válido mesmo com id conhecido', () => {
    expect(scenarioById('payment').title).toContain('pagamento')
  })
})
