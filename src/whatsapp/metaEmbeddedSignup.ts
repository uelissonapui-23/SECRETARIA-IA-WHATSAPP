import { env } from '../lib/env'

type MetaSignupData = { waba_id: string; phone_number_id: string; business_id?: string }
type FacebookLoginResponse = { authResponse?: { code?: string } }
type FacebookApi = {
  init: (options: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void
  login: (callback: (response: FacebookLoginResponse) => void, options: Record<string, unknown>) => void
}

declare global { interface Window { FB?: FacebookApi; fbAsyncInit?: () => void } }

let sdkPromise: Promise<void> | null = null

export function metaSignupConfigured() {
  return Boolean(env.metaAppId && env.metaConfigId)
}

export function loadMetaSdk() {
  if (window.FB) return Promise.resolve()
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise<void>((resolve, reject) => {
    window.fbAsyncInit = () => {
      if (!window.FB) return reject(new Error('Meta SDK indisponível.'))
      window.FB.init({ appId: env.metaAppId, cookie: true, xfbml: true, version: env.metaGraphVersion })
      resolve()
    }
    const existing = document.getElementById('facebook-jssdk')
    if (existing) return
    const script = document.createElement('script')
    script.id = 'facebook-jssdk'
    script.async = true
    script.defer = true
    script.crossOrigin = 'anonymous'
    script.src = 'https://connect.facebook.net/pt_BR/sdk.js'
    script.onerror = () => reject(new Error('Não foi possível carregar o SDK da Meta.'))
    document.head.appendChild(script)
  })
  return sdkPromise
}

export async function startWhatsAppEmbeddedSignup(onComplete: (code: string, data: MetaSignupData) => void, onStatus: (message: string) => void) {
  if (!metaSignupConfigured()) throw new Error('A integração Meta ainda não foi configurada para este ambiente.')
  await loadMetaSdk()

  let signupData: MetaSignupData | null = null
  let authCode = ''
  let completed = false

  const finishIfReady = () => {
    if (!completed && signupData && authCode) {
      completed = true
      window.removeEventListener('message', messageListener)
      onComplete(authCode, signupData)
    }
  }

  const messageListener = (event: MessageEvent) => {
    if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') return
    let payload: unknown = event.data
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload) } catch { return }
    }
    const data = payload as { type?: string; event?: string; data?: MetaSignupData }
    if (data.type !== 'WA_EMBEDDED_SIGNUP') return
    if (data.event === 'FINISH' || data.event === 'FINISH_ONLY_WABA') {
      if (data.data?.waba_id && data.data?.phone_number_id) {
        signupData = data.data
        onStatus('WhatsApp autorizado. Finalizando conexão...')
        finishIfReady()
      }
    } else if (data.event === 'CANCEL') {
      onStatus('Conexão cancelada antes da conclusão.')
    } else if (data.event === 'ERROR') {
      onStatus('A Meta informou um erro durante a conexão.')
    }
  }

  window.addEventListener('message', messageListener)
  window.FB!.login((response) => {
    authCode = response.authResponse?.code ?? ''
    if (!authCode) {
      window.removeEventListener('message', messageListener)
      onStatus('A autorização foi fechada ou não retornou um código válido.')
      return
    }
    finishIfReady()
  }, {
    config_id: env.metaConfigId,
    response_type: 'code',
    override_default_response_type: true,
    extras: {
      setup: {},
      featureType: 'whatsapp_business_app_onboarding',
      sessionInfoVersion: '3',
    },
  })
}
