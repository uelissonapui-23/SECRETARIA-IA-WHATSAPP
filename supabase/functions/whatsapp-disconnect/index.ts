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

async function canManageCompany(service: ReturnType<typeof serviceClient>, companyId: string, userId: string) {
  const [{ data: membership, error: membershipError }, { data: company, error: companyError }] = await Promise.all([
    service.from('company_members').select('role').eq('company_id', companyId).eq('user_id', userId).maybeSingle(),
    service.from('companies').select('created_by').eq('id', companyId).maybeSingle(),
  ])

  if (membershipError) throw membershipError
  if (companyError) throw companyError

  const role = typeof membership?.role === 'string' ? membership.role : null
  const isAdminMember = role === 'owner' || role === 'admin'
  const isCreator = company?.created_by === userId

  // `created_by` é a autoridade final para a empresa original. Se um dado antigo
  // perdeu/alterou o vínculo de owner em company_members, restauramos esse vínculo
  // sem conceder acesso a nenhuma outra pessoa.
  if (isCreator && role !== 'owner') {
    const { error: repairError } = await service.from('company_members').upsert({
      company_id: companyId,
      user_id: userId,
      role: 'owner',
    }, { onConflict: 'company_id,user_id' })
    if (repairError) throw repairError
  }

  return { allowed: isAdminMember || isCreator, role, isCreator }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const authHeader = req.headers.get('authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    const service = serviceClient()
    const { data: { user }, error: userError } = await service.auth.getUser(jwt)
    if (userError || !user) return json({ error: 'not_authenticated' }, 401)

    const { company_id } = await req.json()
    if (!company_id) return json({ error: 'company_id_required' }, 400)

    const permission = await canManageCompany(service, company_id, user.id)
    if (!permission.allowed) return json({ error: 'not_company_admin' }, 403)

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
