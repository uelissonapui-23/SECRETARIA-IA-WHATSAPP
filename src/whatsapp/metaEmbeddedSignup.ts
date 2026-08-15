import { env } from '../lib/env'

export type MetaSignupData = { waba_id: string; phone_number_id?: string; business_id?: string }
type FacebookLoginResponse = { authResponse?: { code?: string }; status?: string }
type FacebookApi = {
  init: (options: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void
  login: (callback: (response: FacebookLoginResponse) => void, options: Record<string, unknown>) => void
}

declare global { interface Window { FB?: FacebookApi; fbAsyncInit?: () => void } }

let sdkPromise: Promise<void> | null = null

const META_MESSAGE_ORIGINS = new Set([
  'https://www.facebook.com',
  'https://web.facebook.com',
  'https://business.facebook.com',
  'https://facebook.com',
  'https://m.facebook.com',
])

export type MetaSignupMessage = {
  type: 'WA_EMBEDDED_SIGNUP'
  event: string
  data: MetaSignupData
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const result = stringValue(value)
    if (result) return result
  }
  return undefined
}

/**
 * Normaliza o postMessage do Embedded Signup.
 * A Meta pode entregar event.data como JSON em string ou como objeto e, entre
 * versões do fluxo, alguns identificadores aparecem aninhados em `data`.
 */
export function parseMetaSignupMessage(event: Pick<MessageEvent, 'origin' | 'data'>): MetaSignupMessage | null {
  if (!META_MESSAGE_ORIGINS.has(event.origin)) return null

  let payload: unknown = event.data
  if (typeof payload === 'string') {
    try { payload = JSON.parse(payload) } catch { return null }
  }
  if (!payload || typeof payload !== 'object') return null

  const record = payload as Record<string, unknown>
  if (record.type !== 'WA_EMBEDDED_SIGNUP') return null

  const eventName = firstString(record.event)
  if (!eventName) return null

  const rawData = record.data && typeof record.data === 'object'
    ? record.data as Record<string, unknown>
    : {}

  const phone = rawData.phone_number && typeof rawData.phone_number === 'object'
    ? rawData.phone_number as Record<string, unknown>
    : {}
  const waba = rawData.waba && typeof rawData.waba === 'object'
    ? rawData.waba as Record<string, unknown>
    : {}

  const wabaId = firstString(
    rawData.waba_id,
    rawData.wabaId,
    waba.id,
    record.waba_id,
  )
  const phoneNumberId = firstString(
    rawData.phone_number_id,
    rawData.phoneNumberId,
    phone.id,
    record.phone_number_id,
  )
  const businessId = firstString(
    rawData.business_id,
    rawData.businessId,
    record.business_id,
  )

  return {
    type: 'WA_EMBEDDED_SIGNUP',
    event: eventName,
    data: {
      waba_id: wabaId ?? '',
      phone_number_id: phoneNumberId,
      business_id: businessId,
    },
  }
}

export function metaSignupConfigured() {
  return Boolean(env.metaAppId && env.metaConfigId)
}

export function loadMetaSdk() {
  if (window.FB) return Promise.resolve()
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise<void>((resolve, reject) => {
    let settled = false
    const done = (callback: () => void) => {
      if (settled) return
      settled = true
      callback()
    }

    window.fbAsyncInit = () => {
      if (!window.FB) return done(() => reject(new Error('Meta SDK indisponível.')))
      window.FB.init({ appId: env.metaAppId, cookie: true, xfbml: true, version: env.metaGraphVersion })
      done(resolve)
    }

    const existing = document.getElementById('facebook-jssdk') as HTMLScriptElement | null
    if (existing) {
      // Em navegação SPA/PWA o script pode existir, mas FB ainda estar inicializando.
      const deadline = window.setTimeout(() => done(() => reject(new Error('O SDK da Meta demorou demais para inicializar. Atualize a página e tente novamente.'))), 15_000)
      const poll = window.setInterval(() => {
        if (!window.FB) return
        window.clearInterval(poll)
        window.clearTimeout(deadline)
        window.FB.init({ appId: env.metaAppId, cookie: true, xfbml: true, version: env.metaGraphVersion })
        done(resolve)
      }, 100)
      return
    }

    const script = document.createElement('script')
    script.id = 'facebook-jssdk'
    script.async = true
    script.defer = true
    script.crossOrigin = 'anonymous'
    script.src = 'https://connect.facebook.net/pt_BR/sdk.js'
    script.onerror = () => done(() => reject(new Error('Não foi possível carregar o SDK da Meta.')))
    document.head.appendChild(script)
  })

  return sdkPromise
}

export async function startWhatsAppEmbeddedSignup(
  onComplete: (code: string, data: MetaSignupData) => void,
  onStatus: (message: string) => void,
) {
  if (!metaSignupConfigured()) throw new Error('A integração Meta ainda não foi configurada para este ambiente.')
  await loadMetaSdk()

  let signupData: MetaSignupData | null = null
  let authCode = ''
  let completed = false
  let sessionFinished = false
  let watchdog = 0

  const cleanup = () => {
    window.removeEventListener('message', messageListener)
    if (watchdog) window.clearTimeout(watchdog)
  }

  const finishIfReady = () => {
    if (completed || !signupData || !authCode || !signupData.waba_id) return
    completed = true
    cleanup()
    onStatus('Autorização recebida. Vinculando a conta do WhatsApp...')
    onComplete(authCode, signupData)
  }

  const messageListener = (event: MessageEvent) => {
    const message = parseMetaSignupMessage(event)
    if (!message) return

    if (message.event === 'FINISH') {
      sessionFinished = true
      if (!message.data.waba_id) {
        cleanup()
        onStatus('A Meta concluiu o fluxo, mas não informou a conta do WhatsApp. Tente novamente.')
        return
      }
      signupData = message.data
      onStatus(message.data.phone_number_id
        ? 'Conta e número autorizados pela Meta. Finalizando conexão...'
        : 'Conta autorizada pela Meta. Localizando o número selecionado...')
      finishIfReady()
      return
    }

    if (message.event === 'FINISH_ONLY_WABA') {
      sessionFinished = true
      if (!message.data.waba_id) {
        cleanup()
        onStatus('A Meta autorizou a conta, mas não retornou a identificação necessária. Tente novamente.')
        return
      }
      // FINISH_ONLY_WABA é um término válido: o backend pode descobrir o número
      // autorizado pela WABA após trocar o code por token.
      signupData = message.data
      onStatus('Conta do WhatsApp autorizada. Localizando o número disponível...')
      finishIfReady()
      return
    }

    if (message.event === 'CANCEL') {
      cleanup()
      onStatus('Conexão cancelada antes da conclusão.')
      return
    }

    if (message.event === 'ERROR') {
      cleanup()
      onStatus('A Meta informou um erro durante a conexão. Tente novamente.')
    }
  }

  window.addEventListener('message', messageListener)

  // Evita deixar a interface presa para sempre caso a janela seja fechada ou
  // a Meta não envie o postMessage final.
  watchdog = window.setTimeout(() => {
    if (completed) return
    cleanup()
    onStatus(sessionFinished
      ? 'A autorização foi concluída, mas o retorno da Meta ficou incompleto. Tente conectar novamente.'
      : 'A Meta não concluiu a conexão. Feche qualquer janela de login aberta e tente novamente.')
  }, 5 * 60_000)

  onStatus('Abrindo autorização segura da Meta...')

  window.FB!.login((response) => {
    authCode = response.authResponse?.code ?? ''
    if (!authCode) {
      cleanup()
      onStatus('A autorização foi fechada ou não retornou um código válido.')
      return
    }
    onStatus(signupData
      ? 'Código de autorização recebido. Finalizando conexão...'
      : 'Autorização recebida. Aguardando a seleção da conta e do número...')
    finishIfReady()
  }, {
    config_id: env.metaConfigId,
    response_type: 'code',
    override_default_response_type: true,
    // Replica a configuração gerada no painel da Meta: Embedded Signup v4
    // com informações de sessão v3. Não forçamos featureType de coexistência
    // aqui; a configuração criada no painel determina o fluxo autorizado.
    extras: { version: 'v4', sessionInfoVersion: '3' },
  })
}
