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
  const traceId = crypto.randomUUID().slice(0, 8)
  const log = (step: string, details: Record<string, unknown> = {}) => console.log(`[whatsapp-connect:${traceId}] ${step}`, details)
  const fail = (step: string, message: string, status = 500, details: Record<string, unknown> = {}) => {
    console.error(`[whatsapp-connect:${traceId}] ${step}`, { ...details, message })
    return json({ error: message, step, trace_id: traceId }, status)
  }
  log('request-received', { method: req.method })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const authHeader = req.headers.get('authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    const service = serviceClient()
    const { data: { user }, error: userError } = await service.auth.getUser(jwt)
    if (userError || !user) return fail('auth', 'not_authenticated', 401)

    const { company_id, code, waba_id, phone_number_id: requestedPhoneNumberId, business_id } = await req.json()
    if (!company_id || !code) return fail('request-validation', 'missing_connection_data', 400, { has_company_id: Boolean(company_id), has_code: Boolean(code) })
    log('request-validated', { company_id, has_waba_id: Boolean(waba_id), has_phone_number_id: Boolean(requestedPhoneNumberId), has_business_id: Boolean(business_id) })

    const { data: membership } = await service.from('company_members').select('role').eq('company_id', company_id).eq('user_id', user.id).maybeSingle()
    if (!membership || !['owner', 'admin'].includes(membership.role)) return fail('membership', 'not_company_admin', 403)
    log('membership-ok', { role: membership.role })

    const appId = Deno.env.get('META_APP_ID') ?? ''
    const appSecret = Deno.env.get('META_APP_SECRET') ?? ''
    if (!appId || !appSecret) return fail('server-config', 'meta_server_not_configured', 503, { has_app_id: Boolean(appId), has_app_secret: Boolean(appSecret) })

    const version = Deno.env.get('META_GRAPH_VERSION') ?? 'v26.0'
    const tokenUrl = new URL(`https://graph.facebook.com/${version}/oauth/access_token`)
    tokenUrl.searchParams.set('client_id', appId)
    tokenUrl.searchParams.set('client_secret', appSecret)
    tokenUrl.searchParams.set('code', code)
    log('oauth-exchange-start')
    const tokenResponse = await fetch(tokenUrl)
    const tokenPayload = await tokenResponse.json().catch(() => ({}))
    if (!tokenResponse.ok || !tokenPayload.access_token) return fail('oauth-exchange', tokenPayload?.error?.message ?? 'Falha ao trocar código da Meta', tokenResponse.status || 502, { meta_status: tokenResponse.status, meta_error_code: tokenPayload?.error?.code ?? null, meta_error_subcode: tokenPayload?.error?.error_subcode ?? null })
    log('oauth-exchange-ok', { token_type: tokenPayload.token_type ?? null, expires_in: tokenPayload.expires_in ?? null })
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
      log('debug-token-start')
      const debugResponse = await fetch(debugUrl)
      const debugPayload = await debugResponse.json().catch(() => ({}))
      if (!debugResponse.ok) return fail('debug-token', debugPayload?.error?.message ?? 'Não foi possível validar a autorização da Meta', debugResponse.status || 502, { meta_status: debugResponse.status, meta_error_code: debugPayload?.error?.code ?? null })

      const scopes = Array.isArray(debugPayload?.data?.granular_scopes) ? debugPayload.data.granular_scopes : []
      const targetIds = [...new Set(scopes
        .filter((scope: { scope?: string }) => scope?.scope === 'whatsapp_business_management' || scope?.scope === 'whatsapp_business_messaging')
        .flatMap((scope: { target_ids?: unknown }) => Array.isArray(scope?.target_ids) ? scope.target_ids : [])
        .map((id: unknown) => String(id ?? '').trim())
        .filter(Boolean))]

      log('debug-token-ok', { granular_scope_count: scopes.length, whatsapp_target_count: targetIds.length })
      if (targetIds.length === 0) return fail('waba-resolution', 'A Meta autorizou o login, mas não informou qual conta do WhatsApp foi concedida. Revise o acesso à Conta do WhatsApp na configuração do Facebook Login for Business.', 409)
      if (targetIds.length > 1) return fail('waba-resolution', 'A autorização contém mais de uma conta do WhatsApp. Deixe apenas a conta que deseja conectar nesta configuração e tente novamente.', 409, { whatsapp_target_count: targetIds.length })
      resolvedWabaId = targetIds[0]
    }
    log('waba-resolved', { waba_id: resolvedWabaId })

    log('subscribe-app-start', { waba_id: resolvedWabaId })
    await graph(`${resolvedWabaId}/subscribed_apps`, accessToken, { method: 'POST', body: '{}' })

    log('subscribe-app-ok', { waba_id: resolvedWabaId })

    // Em alguns términos válidos do Embedded Signup v4 (FINISH_ONLY_WABA),
    // a Meta retorna a WABA sem phone_number_id no postMessage. Nesse caso,
    // resolvemos o número pelo Graph API depois da troca segura do code.
    let phoneNumberId = typeof requestedPhoneNumberId === 'string' && requestedPhoneNumberId.trim()
      ? requestedPhoneNumberId.trim()
      : ''

    if (!phoneNumberId) {
      log('phone-resolution-start', { waba_id: resolvedWabaId })
      const phoneList = await graph(`${resolvedWabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating`, accessToken)
      const phones = Array.isArray(phoneList?.data) ? phoneList.data : []
      log('phone-list-ok', { phone_count: phones.length })
      if (phones.length === 0) return fail('phone-resolution', 'Nenhum número do WhatsApp foi encontrado nesta conta. Conclua a seleção/registro do número na Meta e tente novamente.', 409)
      if (phones.length > 1) return fail('phone-resolution', 'A conta possui mais de um número. Reabra a conexão e selecione explicitamente o número que deseja vincular.', 409, { phone_count: phones.length })
      phoneNumberId = String(phones[0].id ?? '')
      if (!phoneNumberId) return fail('phone-resolution', 'A Meta não retornou a identificação do número selecionado.', 409)
    }

    log('phone-resolved', { phone_number_id: phoneNumberId })
    const phone = await graph(`${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating`, accessToken)

    log('phone-details-ok', { has_display_phone_number: Boolean(phone.display_phone_number), has_verified_name: Boolean(phone.verified_name) })
    const now = new Date().toISOString()
    log('database-save-start', { company_id })
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
    if (connectionError) return fail('database-upsert', connectionError.message, 500, { code: connectionError.code ?? null })
    log('database-upsert-ok', { connection_id: connection.id })

    const { error: tokenError } = await service.rpc('whatsapp_store_access_token', { target_connection_id: connection.id, access_token: accessToken })
    if (tokenError) return fail('token-store', tokenError.message, 500, { code: tokenError.code ?? null })
    log('token-store-ok', { connection_id: connection.id })

    await service.from('companies').update({ monitoring_started_at: now, updated_at: now }).eq('id', company_id)
    await service.from('audit_logs').insert({ company_id, actor_user_id: user.id, action: 'whatsapp.connected', entity_type: 'whatsapp_connection', entity_id: connection.id, metadata: { waba_id: resolvedWabaId, phone_number_id: phoneNumberId } })

    log('connection-complete', { connection_id: connection.id })
    return json({ connection, trace_id: traceId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'connection_failed'
    console.error(`[whatsapp-connect:${traceId}] unhandled-error`, { message, name: error instanceof Error ? error.name : typeof error })
    return json({ error: message, step: 'unhandled-error', trace_id: traceId }, 500)
  }
})
