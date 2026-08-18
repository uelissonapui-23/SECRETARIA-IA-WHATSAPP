import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'

export const admin = createClient(config.supabaseUrl, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
export const anon = createClient(config.supabaseUrl, config.anonKey, { auth: { persistSession: false, autoRefreshToken: false } })

export async function authorize(token: string, companyId: string) {
  const { data: { user }, error } = await anon.auth.getUser(token)
  if (error || !user) return null
  const { data: membership } = await admin.from('company_members').select('role').eq('company_id', companyId).eq('user_id', user.id).maybeSingle()
  if (!membership || !['owner','admin'].includes(membership.role)) return null
  return { userId: user.id, role: membership.role as string }
}
