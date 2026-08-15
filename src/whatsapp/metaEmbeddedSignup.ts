import { env } from '../lib/env'

export type MetaSignupData = { waba_id: string; phone_number_id?: string; business_id?: string }
type FacebookLoginResponse = { authResponse?: { code?: string }; status?: string }
type FacebookApi = {
  init: (options: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void
  login: (callback: (response: FacebookLoginResponse) => void, options: Record<string, unknown>) => void
}

declare global { interface Window { FB?: FacebookApi; fbAsyncInit?: () => void } }

let sdkPromise: Promise<void> | null = null

export type MetaSignupMessage = {
  type: 'WA_EMBEDDED_SIGNUP'
  event: string
  data: MetaSignupData
}

export type MetaSignupDiagnostic = {
  stage: 'sdk-ready' | 'message' | 'login-callback' | 'authorization-without-session' | 'complete'
  origin?: string
  type?: string
  event?: string
  payloadKind?: 'object' | 'json-string' | 'string' | 'other'
  hasWabaId?: boolean
  hasPhoneNumberId?: boolean
  hasBusinessId?: boolean
  hasAuthorizationCode?: boolean
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

function isTrustedMetaOrigin(origin: string) {
  try {
    const url = new URL(origin)
    return url.protocol === 'https:' && (url.hostname === 'facebook.com' || url.hostname.endsWith('.facebook.com'))
  } catch {
    return false
  }
}

function payloadObject(value: unknown): { record: Record<string, unknown> | null; payloadKind: MetaSignupDiagnostic['payloadKind'] } {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object'
        ? { record: parsed as Record<string, unknown>, payloadKind: 'json-string' }
        : { record: null, payloadKind: 'string' }
    } catch {
      return { record: null, payloadKind: 'string' }
    }
  }
  if (value && typeof value === 'object') return { record: value as Record<string, unknown>, payloadKind: 'object' }
  return { record: null, payloadKind: 'other' }
}

function nestedRecord(record: Record<string, unknown>, key: string) {
  const value = record[key]
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function unwrapSignupRecord(record: Record<string, unknown>) {
  if (record.type === 'WA_EMBEDDED_SIGNUP') return record

  // Algumas camadas do SDK/browser podem encapsular a mensagem original.
  for (const key of ['data', 'payload', 'message']) {
    const candidate = nestedRecord(record, key)
    if (candidate.type === 'WA_EMBEDDED_SIGNUP') return candidate
  }
  return record
}

/**
 * Normaliza o postMessage do Embedded Signup sem registrar conteúdo sensível.
 * Suporta payload JSON/string, objeto e alguns encapsulamentos observados entre
 * versões do SDK. Origens são aceitas somente em subdomínios HTTPS do Facebook.
 */
export function parseMetaSignupMessage(event: Pick<MessageEvent, 'origin' | 'data'>): MetaSignupMessage | null {
  if (!isTrustedMetaOrigin(event.origin)) return null

  const { record: rawRecord } = payloadObject(event.data)
  if (!rawRecord) return null
  const record = unwrapSignupRecord(rawRecord)
  if (record.type !== 'WA_EMBEDDED_SIGNUP') return null

  const eventName = firstString(record.event)?.toUpperCase()
  if (!eventName) return null

  const rawData = nestedRecord(record, 'data')
  const sessionInfo = Object.keys(nestedRecord(rawData, 'session_info')).length
    ? nestedRecord(rawData, 'session_info')
    : nestedRecord(rawData, 'sessionInfo')
  const deepData = Object.keys(nestedRecord(rawData, 'data')).length ? nestedRecord(rawData, 'data') : {}
  const phone = nestedRecord(rawData, 'phone_number')
  const waba = nestedRecord(rawData, 'waba')

  const wabaId = firstString(
    rawData.waba_id,
    rawData.wabaId,
    waba.id,
    sessionInfo.waba_id,
    sessionInfo.wabaId,
    deepData.waba_id,
    deepData.wabaId,
    record.waba_id,
  )
  const phoneNumberId = firstString(
    rawData.phone_number_id,
    rawData.phoneNumberId,
    phone.id,
    sessionInfo.phone_number_id,
    sessionInfo.phoneNumberId,
    deepData.phone_number_id,
    deepData.phoneNumberId,
    record.phone_number_id,
  )
  const businessId = firstString(
    rawData.business_id,
    rawData.businessId,
    sessionInfo.business_id,
    sessionInfo.businessId,
    deepData.business_id,
    deepData.businessId,
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

export function inspectMetaSignupEvent(event: Pick<MessageEvent, 'origin' | 'data'>): MetaSignupDiagnostic | null {
  if (!isTrustedMetaOrigin(event.origin)) return null
  const { record: rawRecord, payloadKind } = payloadObject(event.data)
  if (!rawRecord) return { stage: 'message', origin: event.origin, payloadKind }
  const record = unwrapSignupRecord(rawRecord)
  const parsed = parseMetaSignupMessage(event)

  return {
    stage: 'message',
    origin: event.origin,
    payloadKind,
    type: firstString(record.type),
    event: firstString(record.event)?.toUpperCase(),
    hasWabaId: Boolean(parsed?.data.waba_id),
    hasPhoneNumberId: Boolean(parsed?.data.phone_number_id),
    hasBusinessId: Boolean(parsed?.data.business_id),
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
  onDiagnostic?: (diagnostic: MetaSignupDiagnostic) => void,
) {
  if (!metaSignupConfigured()) throw new Error('A integração Meta ainda não foi configurada para este ambiente.')
  await loadMetaSdk()
  onDiagnostic?.({ stage: 'sdk-ready' })

  let signupData: MetaSignupData | null = null
  let authCode = ''
  let completed = false
  let sessionFinished = false
  let watchdog = 0
  let postAuthWatchdog = 0

  const cleanup = () => {
    window.removeEventListener('message', messageListener)
    if (watchdog) window.clearTimeout(watchdog)
    if (postAuthWatchdog) window.clearTimeout(postAuthWatchdog)
  }

  const finishIfReady = () => {
    if (completed || !signupData || !authCode || !signupData.waba_id) return
    completed = true
    onDiagnostic?.({
      stage: 'complete',
      event: sessionFinished ? 'FINISH' : undefined,
      hasWabaId: true,
      hasPhoneNumberId: Boolean(signupData.phone_number_id),
      hasBusinessId: Boolean(signupData.business_id),
      hasAuthorizationCode: true,
    })
    cleanup()
    onStatus('Autorização recebida. Vinculando a conta do WhatsApp...')
    onComplete(authCode, signupData)
  }

  const messageListener = (event: MessageEvent) => {
    const diagnostic = inspectMetaSignupEvent(event)
    if (diagnostic) {
      onDiagnostic?.(diagnostic)
      // Diagnóstico intencionalmente sanitizado: nunca imprime event.data/code/token.
      console.info('[Meta Embedded Signup]', diagnostic)
    }

    const message = parseMetaSignupMessage(event)
    if (!message) return

    if (message.event === 'FINISH' || message.event === 'FINISH_ONLY_WABA') {
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

    if (message.event === 'CANCEL') {
      cleanup()
      onStatus('Conexão cancelada antes da conclusão.')
      return
    }

    if (message.event === 'ERROR') {
      cleanup()
      onStatus('A Meta informou um erro durante a conexão. Tente novamente.')
      return
    }

    onStatus(`Retorno da Meta recebido (${message.event}). Aguardando conclusão do cadastro...`)
  }

  window.addEventListener('message', messageListener)

  watchdog = window.setTimeout(() => {
    if (completed) return
    cleanup()
    onStatus(sessionFinished
      ? 'A autorização foi concluída, mas o retorno da Meta ficou incompleto. Tente conectar novamente.'
      : 'A Meta não concluiu a conexão dentro do tempo esperado. Tente novamente.')
  }, 90_000)

  onStatus('Abrindo autorização segura da Meta...')

  window.FB!.login((response) => {
    authCode = response.authResponse?.code ?? ''
    onDiagnostic?.({
      stage: 'login-callback',
      hasAuthorizationCode: Boolean(authCode),
      hasWabaId: Boolean(signupData?.waba_id),
      hasPhoneNumberId: Boolean(signupData?.phone_number_id),
    })

    if (!authCode) {
      cleanup()
      onStatus('A autorização foi fechada ou não retornou um código válido.')
      return
    }

    onStatus(signupData
      ? 'Código de autorização recebido. Finalizando conexão...'
      : 'Autorização recebida. Aguardando a seleção da conta e do número...')
    finishIfReady()

    // Se o OAuth devolver o code, mas a Meta não enviar WA_EMBEDDED_SIGNUP,
    // não deixamos a interface presa indefinidamente. Esse diagnóstico separa
    // claramente problema de OAuth de problema do postMessage do Embedded Signup.
    if (!signupData) {
      postAuthWatchdog = window.setTimeout(() => {
        if (completed || signupData) return
        onDiagnostic?.({ stage: 'authorization-without-session', hasAuthorizationCode: true, hasWabaId: false, hasPhoneNumberId: false })
        cleanup()
        onStatus('A Meta autorizou o login, mas não enviou os dados da conta/número do Cadastro Incorporado. Reabra a conexão para tentar novamente.')
      }, 20_000)
    }
  }, {
    config_id: env.metaConfigId,
    response_type: 'code',
    override_default_response_type: true,
    // Configuração exibida pelo próprio Embedded Signup Builder da Meta para
    // este projeto: versão v4 e session info v3.
    extras: { version: 'v4', sessionInfoVersion: '3' },
  })
}
