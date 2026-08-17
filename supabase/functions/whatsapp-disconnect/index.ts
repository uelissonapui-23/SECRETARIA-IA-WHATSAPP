import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

function serviceClient() {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente')
  return createClient(Deno.env.get('SUPABASE_URL')!, key, { auth: { persistSession: false } })
}

function authenticatedClient(authHeader: string) {
  const key = Deno.env.get('SUPABASE_ANON_KEY')
  if (!key) throw new Error('SUPABASE_ANON_KEY ausente')
  return createClient(Deno.env.get('SUPABASE_URL')!, key, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function canManageCompany(authHeader: string, companyId: string) {
  const client = authenticatedClient(authHeader)
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  const { data: { user }, error: userError } = await client.auth.getUser(jwt)
  if (userError || !user) {
    return { allowed: false, role: null as string | null, user: null, error: 'not_authenticated' }
  }

  // Usa a função canônica do banco com auth.uid() do JWT do usuário.
  // Assim frontend, RLS e Edge Function obedecem à MESMA regra de papel.
  const { data: roleValue, error: roleError } = await client
    .rpc('company_role_for', { target_company_id: companyId })

  if (roleError) {
    return { allowed: false, role: null as string | null, user, error: roleError.message }
  }

  const role = typeof roleValue === 'string' ? roleValue : null
  return { allowed: role === 'owner' || role === 'admin', role, user, error: null as string | null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const authHeader = req.headers.get('authorization') ?? ''
    if (!/^Bearer\s+\S+/i.test(authHeader)) return json({ error: 'not_authenticated' }, 401)

    const { company_id } = await req.json()
    if (!company_id) return json({ error: 'company_id_required' }, 400)

    const permission = await canManageCompany(authHeader, company_id)
    if (!permission.user) return json({ error: 'not_authenticated' }, 401)
    if (!permission.allowed) return json({ error: 'not_company_admin' }, 403)
    const user = permission.user
    const service = serviceClient()

    const { data: connection } = await service.from('whatsapp_connections').select('*').eq('company_id', company_id).maybeSingle()
    if (!connection) return json({ ok: true })

    const now = new Date().toISOString()
    await service.rpc('whatsapp_delete_access_token', { target_connection_id: connection.id })
    const { error } = await service.from('whatsapp_connections').update({
      status: 'disconnected', disconnected_at: now, disconnected_by: user.id, last_error: null, updated_at: now,
    }).eq('id', connection.id)
    if (error) throw error
    await service.from('audit_logs').insert({ company_id, actor_user_id: user.id, action: 'whatsapp.disconnected', entity_type: 'whatsapp_connection', entity_id: connection.id })
    return json({ ok: true })
  } catch (error) {
    console.error('whatsapp-disconnect', error)
    return json({ error: error instanceof Error ? error.message : 'disconnect_failed' }, 500)
  }
})
