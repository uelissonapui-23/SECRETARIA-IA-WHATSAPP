import { describe, expect, it } from 'vitest'
import { isLikelyRelevantMessage } from './relevance'

describe('isLikelyRelevantMessage', () => {
  it('ignora cumprimentos simples', () => expect(isLikelyRelevantMessage('Bom dia')).toBe(false))
  it('detecta combinação de visita', () => expect(isLikelyRelevantMessage('Pode vir amanhã às 14h')).toBe(true))
  it('detecta promessa de pagamento', () => expect(isLikelyRelevantMessage('Faço o PIX sexta')).toBe(true))
})
