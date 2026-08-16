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

    const { company_id, code, waba_id, phone_number_id: requestedPhoneNumberId, business_id } = await req.json()
    if (!company_id || !code) return json({ error: 'missing_connection_data' }, 400)

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

    // O postMessage WA_EMBEDDED_SIGNUP nem sempre chega ao opener nas versões
    // atuais do Login for Business. Quando o frontend recebe somente o `code`,
    // descobrimos a WABA explicitamente autorizada a partir dos granular_scopes
    // do token, sem confiar em IDs enviados pelo navegador.
    let resolvedWabaId = typeof waba_id === 'string' && waba_id.trim() ? waba_id.trim() : ''
    if (!resolvedWabaId) {
      const debugUrl = new URL(`https://graph.facebook.com/${version}/debug_token`)
      debugUrl.searchParams.set('input_token', accessToken)
      debugUrl.searchParams.set('access_token', `${appId}|${appSecret}`)
      const debugResponse = await fetch(debugUrl)
      const debugPayload = await debugResponse.json().catch(() => ({}))
      if (!debugResponse.ok) throw new Error(debugPayload?.error?.message ?? 'Não foi possível validar a autorização da Meta')

      const scopes = Array.isArray(debugPayload?.data?.granular_scopes) ? debugPayload.data.granular_scopes : []
      const targetIds = [...new Set(scopes
        .filter((scope: { scope?: string }) => scope?.scope === 'whatsapp_business_management' || scope?.scope === 'whatsapp_business_messaging')
        .flatMap((scope: { target_ids?: unknown }) => Array.isArray(scope?.target_ids) ? scope.target_ids : [])
        .map((id: unknown) => String(id ?? '').trim())
        .filter(Boolean))]

      if (targetIds.length === 0) return json({ error: 'A Meta autorizou o login, mas não informou qual conta do WhatsApp foi concedida. Revise o acesso à Conta do WhatsApp na configuração do Facebook Login for Business.' }, 409)
      if (targetIds.length > 1) return json({ error: 'A autorização contém mais de uma conta do WhatsApp. Deixe apenas a conta que deseja conectar nesta configuração e tente novamente.' }, 409)
      resolvedWabaId = targetIds[0]
    }

    await graph(`${resolvedWabaId}/subscribed_apps`, accessToken, { method: 'POST', body: '{}' })

    // Em alguns términos válidos do Embedded Signup v4 (FINISH_ONLY_WABA),
    // a Meta retorna a WABA sem phone_number_id no postMessage. Nesse caso,
    // resolvemos o número pelo Graph API depois da troca segura do code.
    let phoneNumberId = typeof requestedPhoneNumberId === 'string' && requestedPhoneNumberId.trim()
      ? requestedPhoneNumberId.trim()
      : ''

    if (!phoneNumberId) {
      const phoneList = await graph(`${resolvedWabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating`, accessToken)
      const phones = Array.isArray(phoneList?.data) ? phoneList.data : []
      if (phones.length === 0) return json({ error: 'Nenhum número do WhatsApp foi encontrado nesta conta. Conclua a seleção/registro do número na Meta e tente novamente.' }, 409)
      if (phones.length > 1) return json({ error: 'A conta possui mais de um número. Reabra a conexão e selecione explicitamente o número que deseja vincular.' }, 409)
      phoneNumberId = String(phones[0].id ?? '')
      if (!phoneNumberId) return json({ error: 'A Meta não retornou a identificação do número selecionado.' }, 409)
    }

    const phone = await graph(`${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating`, accessToken)

    const now = new Date().toISOString()
    const { data: connection, error: connectionError } = await service.from('whatsapp_connections').upsert({
      company_id,
      waba_id: resolvedWabaId,
      phone_number_id: phoneNumberId,
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
    await service.from('audit_logs').insert({ company_id, actor_user_id: user.id, action: 'whatsapp.connected', entity_type: 'whatsapp_connection', entity_id: connection.id, metadata: { waba_id: resolvedWabaId, phone_number_id: phoneNumberId } })

    return json({ connection })
  } catch (error) {
    console.error('whatsapp-connect', error)
    return json({ error: error instanceof Error ? error.message : 'connection_failed' }, 500)
  }
})
