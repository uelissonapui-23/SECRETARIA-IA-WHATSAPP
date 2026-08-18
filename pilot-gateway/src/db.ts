import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'

export const admin = createClient(config.supabaseUrl, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
export const anon = createClient(config.supabaseUrl, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

type AccessResult = { userId: string; role: string } | null

export async function authorize(token: string, companyId: string): Promise<AccessResult> {
  // Valida o JWT diretamente pelo cliente de servidor. Isso evita depender da
  // publishable/anon key para autenticar uma chamada que já chegou ao gateway.
  const { data: { user }, error: userError } = await admin.auth.getUser(token)
  if (userError || !user) {
    console.warn('[pilot-gateway] auth-user-rejected', {
      company_id: companyId,
      reason: userError?.message ?? 'user_not_found',
    })
    return null
  }

  const { data: membership, error: membershipError } = await admin
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError) {
    console.error('[pilot-gateway] membership-query-failed', {
      company_id: companyId,
      user_id: user.id,
      code: membershipError.code,
      message: membershipError.message,
    })
    return null
  }

  if (membership && ['owner', 'admin'].includes(membership.role)) {
    return { userId: user.id, role: membership.role }
  }

  // Defesa para empresas antigas: a fonte de verdade histórica continua sendo
  // companies.created_by. A migration de reparo deveria manter company_members,
  // mas este fallback evita falso 403 durante o piloto sem ampliar acesso a terceiros.
  const { data: company, error: companyError } = await admin
    .from('companies')
    .select('created_by')
    .eq('id', companyId)
    .maybeSingle()

  if (companyError) {
    console.error('[pilot-gateway] company-owner-query-failed', {
      company_id: companyId,
      user_id: user.id,
      code: companyError.code,
      message: companyError.message,
    })
    return null
  }

  if (company?.created_by === user.id) {
    console.warn('[pilot-gateway] owner-fallback-used', { company_id: companyId, user_id: user.id })
    return { userId: user.id, role: 'owner' }
  }

  console.warn('[pilot-gateway] access-forbidden', {
    company_id: companyId,
    user_id: user.id,
    role: membership?.role ?? null,
  })
  return null
}
