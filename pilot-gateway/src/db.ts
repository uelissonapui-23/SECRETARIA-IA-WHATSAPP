import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'

export const admin = createClient(config.supabaseUrl, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
export const anon = createClient(config.supabaseUrl, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

export type AuthorizationResult =
  | { allowed: true; userId: string; role: string }
  | { allowed: false; reason: 'invalid_user_token' | 'company_not_found' | 'not_company_admin'; userId?: string; role?: string | null }

export async function authorize(token: string, companyId: string): Promise<AuthorizationResult> {
  // Valida o JWT do usuário no backend. Usamos o cliente administrativo apenas
  // no servidor; a secret key nunca é enviada ao navegador.
  const { data: { user }, error: userError } = await admin.auth.getUser(token)
  if (userError || !user) {
    console.warn('[pilot-gateway] authorization denied', {
      companyId,
      reason: 'invalid_user_token',
      authError: userError?.message ?? null,
    })
    return { allowed: false, reason: 'invalid_user_token' }
  }

  const [{ data: membership, error: membershipError }, { data: company, error: companyError }] = await Promise.all([
    admin.from('company_members').select('role').eq('company_id', companyId).eq('user_id', user.id).maybeSingle(),
    admin.from('companies').select('id,created_by').eq('id', companyId).maybeSingle(),
  ])

  if (membershipError) {
    console.error('[pilot-gateway] membership lookup failed', {
      companyId,
      userId: user.id,
      code: membershipError.code,
      message: membershipError.message,
    })
  }
  if (companyError) {
    console.error('[pilot-gateway] company lookup failed', {
      companyId,
      userId: user.id,
      code: companyError.code,
      message: companyError.message,
    })
  }

  if (!company) {
    console.warn('[pilot-gateway] authorization denied', {
      companyId,
      userId: user.id,
      reason: 'company_not_found',
    })
    return { allowed: false, reason: 'company_not_found', userId: user.id }
  }

  // created_by é a fonte de verdade de propriedade da empresa. O fallback
  // evita falso 403 caso uma base antiga tenha perdido o vínculo em
  // company_members; a migration de reparo continua sendo a correção permanente.
  const role = membership?.role ?? (company.created_by === user.id ? 'owner' : null)
  const allowed = role === 'owner' || role === 'admin'

  console.info('[pilot-gateway] authorization check', {
    companyId,
    userId: user.id,
    role,
    allowed,
    creatorFallback: !membership && company.created_by === user.id,
  })

  if (!allowed) {
    return { allowed: false, reason: 'not_company_admin', userId: user.id, role }
  }

  return { allowed: true, userId: user.id, role }
}
