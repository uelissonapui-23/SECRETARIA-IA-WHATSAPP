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

async function graph(path: string, token: string, init?: RequestInit) {
  const version = Deno.env.get('META_GRAPH_VERSION') ?? 'v26.0'
  const response = await fetch(`https://graph.facebook.com/${version}/${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data?.error?.message ?? `Meta Graph API ${response.status}`)
  return data
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

    const { company_id, code, waba_id, phone_number_id, business_id } = await req.json()
    if (!company_id || !code || !waba_id || !phone_number_id) return json({ error: 'missing_connection_data' }, 400)

    const { data: membership } = await service.from('company_members').select('role').eq('company_id', company_id).eq('user_id', user.id).maybeSingle()
    if (!membership || !['owner', 'admin'].includes(membership.role)) return json({ error: 'not_company_admin' }, 403)

    const appId = Deno.env.get('META_APP_ID') ?? ''
    const appSecret = Deno.env.get('META_APP_SECRET') ?? ''
    if (!appId || !appSecret) return json({ error: 'meta_server_not_configured' }, 503)

    const version = Deno.env.get('META_GRAPH_VERSION') ?? 'v26.0'
    const tokenUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`)
    tokenUrl.searchParams.set('client_id', appId)
    tokenUrl.searchParams.set('client_secret', appSecret)
    tokenUrl.searchParams.set('code', code)
    const tokenResponse = await fetch(tokenUrl)
    const tokenPayload = await tokenResponse.json().catch(() => ({}))
    if (!tokenResponse.ok || !tokenPayload.access_token) throw new Error(tokenPayload?.error?.message ?? 'Falha ao trocar código da Meta')
    const accessToken = tokenPayload.access_token as string

    await graph(`${waba_id}/subscribed_apps`, accessToken, { method: 'POST', body: '{}' })
    const phone = await graph(`${phone_number_id}?fields=id,display_phone_number,verified_name,quality_rating`, accessToken)

    const now = new Date().toISOString()
    const { data: connection, error: connectionError } = await service.from('whatsapp_connections').upsert({
      company_id,
      waba_id,
      phone_number_id,
      business_id: business_id ?? null,
      display_phone_number: phone.display_phone_number ?? null,
      phone_number_name: phone.verified_name ?? null,
      quality_rating: phone.quality_rating ?? null,
      status: 'connected',
      connected_at: now,
      activation_at: now,
      disconnected_at: null,
      disconnected_by: null,
      connected_by: user.id,
      last_error: null,
      connection_mode: 'embedded_signup',
      updated_at: now,
    }, { onConflict: 'company_id' }).select('id,company_id,status,display_phone_number,phone_number_name,connected_at,activation_at').single()
    if (connectionError) throw connectionError

    const { error: tokenError } = await service.rpc('whatsapp_store_access_token', { target_connection_id: connection.id, access_token: accessToken })
    if (tokenError) throw tokenError

    await service.from('companies').update({ monitoring_started_at: now, updated_at: now }).eq('id', company_id)
    await service.from('audit_logs').insert({ company_id, actor_user_id: user.id, action: 'whatsapp.connected', entity_type: 'whatsapp_connection', entity_id: connection.id, metadata: { waba_id, phone_number_id } })

    return json({ connection })
  } catch (error) {
    console.error('whatsapp-connect', error)
    return json({ error: error instanceof Error ? error.message : 'connection_failed' }, 500)
  }
})
