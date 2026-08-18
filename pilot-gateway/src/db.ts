import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'
import { createAuthorize } from './authorization.js'

export const admin = createClient(config.supabaseUrl, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
export const anon = createClient(config.supabaseUrl, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

export const authorize = createAuthorize({
  // Valida o JWT diretamente pelo cliente de servidor. Isso evita depender da
  // publishable/anon key para autenticar uma chamada que já chegou ao gateway.
  async getUser(token) {
    const { data: { user }, error } = await admin.auth.getUser(token)
    return { data: user ? { id: user.id } : null, error }
  },

  async getMembership(companyId, userId) {
    const { data, error } = await admin
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', userId)
    .maybeSingle()
    return { data, error }
  },

  // Defesa para empresas antigas: a fonte de verdade histórica continua sendo
  // companies.created_by. A migration de reparo deveria manter company_members,
  // mas este fallback evita falso 403 durante o piloto sem ampliar acesso a terceiros.
  async getCompany(companyId) {
    const { data, error } = await admin
    .from('companies')
    .select('created_by')
    .eq('id', companyId)
    .maybeSingle()
    return { data, error }
  },
  log(level, event, details) {
    console[level](`[pilot-gateway] ${event}`, details)
  },
})
