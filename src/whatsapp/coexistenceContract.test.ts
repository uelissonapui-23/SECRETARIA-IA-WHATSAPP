import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const embeddedSignup = readFileSync(new URL('./metaEmbeddedSignup.ts', import.meta.url), 'utf8')
const connect = readFileSync(new URL('../../supabase/functions/whatsapp-connect/index.ts', import.meta.url), 'utf8')
const webhook = readFileSync(new URL('../../supabase/functions/whatsapp-webhook/index.ts', import.meta.url), 'utf8')

describe('contrato de coexistência do WhatsApp', () => {
  it('abre somente o onboarding do WhatsApp Business app e exige o evento oficial de conclusão', () => {
    expect(embeddedSignup).toContain("featureType: 'whatsapp_business_app_onboarding'")
    expect(embeddedSignup).toContain('FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING')
    expect(embeddedSignup).not.toContain("onComplete(authCode, { waba_id: '' })")
  })

  it('valida no backend que o número continua no WhatsApp Business', () => {
    expect(connect).toContain('is_on_biz_app')
    expect(connect).toContain('platform_type')
    expect(connect).toContain("connection_mode: 'coexistence'")
    expect(connect).toContain("sync_type: syncType")
  })

  it('preserva histórico sem enviar mensagens antigas para a IA e espelha mensagens do app', () => {
    expect(webhook).toContain("source: 'coexistence_history'")
    expect(webhook).toContain("historical: true")
    expect(webhook).toContain("field === 'smb_message_echoes'")
    expect(webhook).toContain("field === 'smb_app_state_sync'")
  })
})
