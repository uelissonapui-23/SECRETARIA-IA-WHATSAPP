import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'

export const admin = createClient(config.supabaseUrl, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
export const anon = createClient(config.supabaseUrl, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

export type AuthorizationResult =
  | { ok: true; userId: string; role: 'owner' | 'admin' }
  | { ok: false; reason: 'invalid_user_token' | 'membership_query_failed' | 'company_query_failed' | 'not_company_admin'; role?: string | null }

export async function authorize(token: string, companyId: string): Promise<AuthorizationResult> {
  const { data: { user }, error: userError } = await anon.auth.getUser(token)
  if (userError || !user) {
    console.warn('[pilot-gateway] auth denied', {
      reason: 'invalid_user_token',
      message: userError?.message ?? null,
    })
    return { ok: false, reason: 'invalid_user_token' }
  }

  const [{ data: membership, error: membershipError }, { data: company, error: companyError }] = await Promise.all([
    admin
      .from('company_members')
      .select('role')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .maybeSingle(),
    admin
      .from('companies')
      .select('created_by')
      .eq('id', companyId)
      .maybeSingle(),
  ])

  if (membershipError) {
    console.error('[pilot-gateway] membership query failed', {
      company_id: companyId,
      code: membershipError.code,
      message: membershipError.message,
    })
    return { ok: false, reason: 'membership_query_failed' }
  }

  if (companyError) {
    console.error('[pilot-gateway] company query failed', {
      company_id: companyId,
      code: companyError.code,
      message: companyError.message,
    })
    return { ok: false, reason: 'company_query_failed' }
  }

  // A empresa já possui trigger para criar o membership owner, mas mantemos
  // este fallback porque contas antigas podem ter sido criadas antes do reparo.
  const role = membership?.role ?? (company?.created_by === user.id ? 'owner' : null)

  if (role !== 'owner' && role !== 'admin') {
    console.warn('[pilot-gateway] auth denied', {
      reason: 'not_company_admin',
      company_id: companyId,
      role,
      membership_found: Boolean(membership),
      creator_match: company?.created_by === user.id,
    })
    return { ok: false, reason: 'not_company_admin', role }
  }

  console.info('[pilot-gateway] auth allowed', {
    company_id: companyId,
    role,
    membership_found: Boolean(membership),
  })

  return { ok: true, userId: user.id, role }
}
