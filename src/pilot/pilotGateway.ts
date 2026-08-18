import { supabase } from '../lib/supabase'

export type PilotGatewayStatus = {
  status: 'disconnected'|'connecting'|'qr_ready'|'connected'|'reconnecting'|'error'
  display_phone_number?: string|null
  last_connected_at?: string|null
  last_message_at?: string|null
  last_error?: string|null
  qr_data_url?: string|null
}

export class PilotGatewayError extends Error {
  constructor(public readonly reason: string, public readonly permanent: boolean, message: string) {
    super(message)
    this.name = 'PilotGatewayError'
  }
}

function baseUrl() {
  const value = String(import.meta.env.VITE_PILOT_GATEWAY_URL || '').replace(/\/$/, '')
  if (!value) throw new Error('pilot_gateway_not_configured')
  return value
}
async function request(companyId:string, method:string) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('not_authenticated')
  const response = await fetch(`${baseUrl()}/v1/companies/${encodeURIComponent(companyId)}/session`, { method, headers: { Authorization: `Bearer ${token}` } })
  const payload = await response.json().catch(()=>({})) as { error?: string; reason?: string; role?: string | null }
  if (!response.ok) {
    if (payload.reason === 'not_company_admin') {
      throw new PilotGatewayError(payload.reason, true, payload.role
        ? `Sua função atual nesta empresa é "${payload.role}". Apenas proprietário ou administrador pode gerenciar a conexão.`
        : 'Sua conta não foi reconhecida como proprietária ou administradora desta empresa.')
    }
    if (payload.reason === 'company_not_found') throw new PilotGatewayError(payload.reason, true, 'A empresa selecionada não foi encontrada pelo gateway.')
    if (payload.reason === 'invalid_user_token') throw new PilotGatewayError(payload.reason, true, 'Sua sessão expirou ou não pôde ser validada. Entre novamente no aplicativo.')
    if (payload.reason === 'membership_query_failed' || payload.reason === 'company_query_failed') {
      throw new PilotGatewayError(payload.reason, false, 'O gateway não conseguiu confirmar sua permissão agora. Aguarde alguns instantes e tente novamente.')
    }
    throw new Error(payload.error || `gateway_${response.status}`)
  }
  return payload as PilotGatewayStatus
}
export const pilotGatewayConfigured = () => Boolean(import.meta.env.VITE_PILOT_GATEWAY_URL)
export const getPilotStatus = (companyId:string) => request(companyId,'GET')
export const connectPilot = (companyId:string) => request(companyId,'POST')
export const disconnectPilot = (companyId:string) => request(companyId,'DELETE')
