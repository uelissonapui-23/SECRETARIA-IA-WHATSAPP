import { describe, expect, it } from 'vitest'
import { inspectMetaSignupEvent, parseMetaSignupMessage } from './metaEmbeddedSignup'

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

  it('aceita qualquer subdomínio HTTPS legítimo de facebook.com', () => {
    const result = parseMetaSignupMessage({
      origin: 'https://business.facebook.com',
      data: { type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH', data: { waba_id: 'waba-2', phone_number_id: 'phone-2' } },
    })

    expect(result?.data.waba_id).toBe('waba-2')
    expect(result?.data.phone_number_id).toBe('phone-2')
  })


  it('aceita o evento oficial de conclusão da coexistência', () => {
    const result = parseMetaSignupMessage({
      origin: 'https://business.facebook.com',
      data: JSON.stringify({
        type: 'WA_EMBEDDED_SIGNUP',
        event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
        version: 3,
        data: { waba_id: 'waba-coexist' },
      }),
    })

    expect(result?.event).toBe('FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING')
    expect(result?.data.waba_id).toBe('waba-coexist')
  })

  it('aceita FINISH_ONLY_WABA sem exigir phone_number_id no frontend', () => {
    const result = parseMetaSignupMessage({
      origin: 'https://business.facebook.com',
      data: JSON.stringify({ type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH_ONLY_WABA', data: { waba_id: 'waba-3' } }),
    })

    expect(result?.event).toBe('FINISH_ONLY_WABA')
    expect(result?.data).toEqual({ waba_id: 'waba-3', phone_number_id: undefined, business_id: undefined })
  })

  it('normaliza identificadores aninhados em session_info', () => {
    const result = parseMetaSignupMessage({
      origin: 'https://www.facebook.com',
      data: {
        type: 'WA_EMBEDDED_SIGNUP',
        event: 'finish',
        data: { session_info: { waba_id: 'waba-4', phone_number_id: 'phone-4' } },
      },
    })

    expect(result?.event).toBe('FINISH')
    expect(result?.data.waba_id).toBe('waba-4')
    expect(result?.data.phone_number_id).toBe('phone-4')
  })

  it('aceita mensagem encapsulada em payload', () => {
    const result = parseMetaSignupMessage({
      origin: 'https://www.facebook.com',
      data: { payload: { type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH', data: { waba_id: 'waba-5' } } },
    })
    expect(result?.data.waba_id).toBe('waba-5')
  })


  it('aceita payload JSON percent-encoded', () => {
    const payload = encodeURIComponent(JSON.stringify({
      type: 'WA_EMBEDDED_SIGNUP',
      event: 'FINISH',
      data: { waba_id: 'waba-encoded', phone_number_id: 'phone-encoded' },
    }))
    const result = parseMetaSignupMessage({ origin: 'https://www.facebook.com', data: payload })
    expect(result?.data.waba_id).toBe('waba-encoded')
    expect(result?.data.phone_number_id).toBe('phone-encoded')
  })

  it('aceita fallback em query string somente para chaves do Embedded Signup', () => {
    const data = encodeURIComponent(JSON.stringify({ waba_id: 'waba-query', phone_number_id: 'phone-query' }))
    const result = parseMetaSignupMessage({
      origin: 'https://www.facebook.com',
      data: `type=WA_EMBEDDED_SIGNUP&event=FINISH&data=${data}`,
    })
    expect(result?.event).toBe('FINISH')
    expect(result?.data.waba_id).toBe('waba-query')
    expect(result?.data.phone_number_id).toBe('phone-query')
  })

  it('gera diagnóstico sanitizado sem expor payload', () => {
    const diagnostic = inspectMetaSignupEvent({
      origin: 'https://www.facebook.com',
      data: JSON.stringify({ type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH', data: { waba_id: 'secret-waba', phone_number_id: 'secret-phone' } }),
    })

    expect(diagnostic).toEqual(expect.objectContaining({
      stage: 'message',
      event: 'FINISH',
      type: 'WA_EMBEDDED_SIGNUP',
      hasWabaId: true,
      hasPhoneNumberId: true,
    }))
    expect(JSON.stringify(diagnostic)).not.toContain('secret-waba')
    expect(JSON.stringify(diagnostic)).not.toContain('secret-phone')
  })

  it('ignora mensagem interna do SDK do Facebook que contém code', () => {
    const internalMessage = 'cb=f9683195a1fa6eb56&domain=secretaria-ia-whatsapp-iota.vercel.app&is_canvas=false&origin=https%3A%2F%2Fsecretaria-ia-whatsapp-iota.vercel.app&relation=opener&frame=fake&code=fake-oauth-code&base_domain=vercel.app'

    expect(parseMetaSignupMessage({ origin: 'https://www.facebook.com', data: internalMessage })).toBeNull()
    expect(inspectMetaSignupEvent({ origin: 'https://www.facebook.com', data: internalMessage })).toBeNull()
  })

  it('ignora origem não confiável', () => {
    const result = parseMetaSignupMessage({
      origin: 'https://example.com',
      data: { type: 'WA_EMBEDDED_SIGNUP', event: 'FINISH', data: { waba_id: 'x', phone_number_id: 'y' } },
    })

    expect(result).toBeNull()
  })
})
