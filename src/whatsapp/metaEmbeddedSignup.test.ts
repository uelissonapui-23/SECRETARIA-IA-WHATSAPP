import { describe, expect, it } from 'vitest'
import { parseMetaSignupMessage } from './metaEmbeddedSignup'

describe('parseMetaSignupMessage', () => {
  it('aceita o payload JSON padrão vindo de www.facebook.com', () => {
    const result = parseMetaSignupMessage({
      origin: 'https://www.facebook.com',
      data: JSON.stringify({
        type: 'WA_EMBEDDED_SIGNUP',
        event: 'FINISH',
        data: { waba_id: 'waba-1', phone_number_id: 'phone-1', business_id: 'business-1' },
      }),
    })

    expect(result).toEqual({
      type: 'WA_EMBEDDED_SIGNUP',
      event: 'FINISH',
      data: { waba_id: 'waba-1', phone_number_id: 'phone-1', business_id: 'business-1' },
    })
  })

  it('aceita postMessage originado em business.facebook.com', () => {
    const result = parseMetaSignupMessage({
      origin: 'https://business.facebook.com',
      data: { type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH', data: { waba_id: 'waba-2', phone_number_id: 'phone-2' } },
    })

    expect(result?.data.waba_id).toBe('waba-2')
    expect(result?.data.phone_number_id).toBe('phone-2')
  })

  it('aceita FINISH_ONLY_WABA sem exigir phone_number_id no frontend', () => {
    const result = parseMetaSignupMessage({
      origin: 'https://business.facebook.com',
      data: JSON.stringify({ type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH_ONLY_WABA', data: { waba_id: 'waba-3' } }),
    })

    expect(result?.event).toBe('FINISH_ONLY_WABA')
    expect(result?.data).toEqual({ waba_id: 'waba-3', phone_number_id: undefined, business_id: undefined })
  })

  it('normaliza identificadores aninhados', () => {
    const result = parseMetaSignupMessage({
      origin: 'https://www.facebook.com',
      data: {
        type: 'WA_EMBEDDED_SIGNUP',
        event: 'FINISH',
        data: { waba: { id: 'waba-4' }, phone_number: { id: 'phone-4' } },
      },
    })

    expect(result?.data.waba_id).toBe('waba-4')
    expect(result?.data.phone_number_id).toBe('phone-4')
  })

  it('ignora origem não confiável', () => {
    const result = parseMetaSignupMessage({
      origin: 'https://example.com',
      data: { type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH', data: { waba_id: 'x', phone_number_id: 'y' } },
    })

    expect(result).toBeNull()
  })
})
