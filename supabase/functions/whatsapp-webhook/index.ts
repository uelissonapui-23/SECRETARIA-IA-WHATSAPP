import { createClient } from 'npm:@supabase/supabase-js@2'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

type Service = ReturnType<typeof createClient>
type Connection = { id: string; company_id: string; phone_number_id: string | null; waba_id: string | null; activation_at: string | null; connected_at: string | null; status: string }

function serviceClient() {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente')
  return createClient(Deno.env.get('SUPABASE_URL')!, key, { auth: { persistSession: false } })
}

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
}

function messageTime(timestamp: unknown) {
  const numeric = Number(timestamp)
  return Number.isFinite(numeric) && numeric > 0 ? new Date(numeric * 1000) : new Date()
}

async function connectionByPhone(supabase: Service, phoneNumberId: string) {
  const { data } = await supabase.from('whatsapp_connections')
    .select('id,company_id,phone_number_id,waba_id,activation_at,connected_at,status')
    .eq('phone_number_id', phoneNumberId)
    .in('status', ['connected', 'paused'])
    .maybeSingle()
  return data as Connection | null
}

async function touchConnection(supabase: Service, connectionId: string) {
  const now = new Date().toISOString()
  await supabase.from('whatsapp_connections').update({ last_webhook_at: now, last_error: null, updated_at: now }).eq('id', connectionId)
}

async function ensureContact(supabase: Service, companyId: string, waId: string, name?: string | null) {
  const payload: Record<string, unknown> = { company_id: companyId, whatsapp_id: waId, phone: waId }
  if (name) payload.name = name
  const { data, error } = await supabase.from('contacts').upsert(payload, { onConflict: 'company_id,whatsapp_id' }).select('id').single()
  if (error) throw error
  return data.id as string
}

async function ensureConversation(supabase: Service, companyId: string, contactId: string, at: Date) {
  const { data, error } = await supabase.rpc('whatsapp_touch_conversation', {
    target_company_id: companyId,
    target_contact_id: contactId,
    target_message_at: at.toISOString(),
  })
  if (error) throw error
  return data as string
}

async function storeMessage(
  supabase: Service,
  connection: Connection,
  message: Record<string, any>,
  options: { customerWaId: string; direction: 'inbound' | 'outbound'; contactName?: string | null; historical?: boolean; source: string },
) {
  if (!message?.id || !options.customerWaId) return null
  const at = messageTime(message.timestamp)
  const contactId = await ensureContact(supabase, connection.company_id, options.customerWaId, options.contactName)
  const conversationId = await ensureConversation(supabase, connection.company_id, contactId, at)
  const bodyText = message.type === 'text' ? message.text?.body ?? null : null
  const activation = connection.activation_at ?? connection.connected_at
  const afterActivation = !activation || at >= new Date(activation)
  const eligible = !options.historical && options.direction === 'inbound' && afterActivation && message.type === 'text' && Boolean(bodyText)

  const { data: inserted, error } = await supabase.from('messages').upsert({
    company_id: connection.company_id,
    conversation_id: conversationId,
    contact_id: contactId,
    provider_message_id: message.id,
    direction: options.direction,
    message_type: message.type ?? 'unknown',
    body_text: bodyText,
    provider_timestamp: at.toISOString(),
    raw_payload: { ...message, _secretaria_source: options.source },
    eligible_for_ai: eligible,
  }, { onConflict: 'company_id,provider_message_id', ignoreDuplicates: true }).select('id,eligible_for_ai').maybeSingle()
  if (error) throw error

  if (inserted?.eligible_for_ai) {
    await supabase.from('message_jobs').upsert({ company_id: connection.company_id, message_id: inserted.id }, { onConflict: 'message_id', ignoreDuplicates: true })
  }
  if (inserted && options.direction === 'inbound' && !options.historical) {
    await supabase.rpc('whatsapp_increment_received', { target_company_id: connection.company_id })
  }
  return inserted
}

async function handleMessages(supabase: Service, connection: Connection, value: Record<string, any>) {
  const activation = connection.activation_at ?? connection.connected_at
  for (const message of value.messages ?? []) {
    const at = messageTime(message.timestamp)
    if (activation && at < new Date(activation)) continue
    const waId = String(message.from ?? '')
    if (!waId) continue
    const name = (value.contacts ?? []).find((item: { wa_id?: string }) => item.wa_id === waId)?.profile?.name ?? null
    await storeMessage(supabase, connection, message, { customerWaId: waId, direction: 'inbound', contactName: name, source: 'cloud_api_inbound' })
  }
}

async function handleEchoes(supabase: Service, connection: Connection, value: Record<string, any>) {
  for (const message of value.message_echoes ?? []) {
    const customerWaId = String(message.to ?? '')
    if (!customerWaId) continue
    await storeMessage(supabase, connection, message, { customerWaId, direction: 'outbound', historical: false, source: 'whatsapp_business_app_echo' })
  }
}

async function handleHistory(supabase: Service, connection: Connection, value: Record<string, any>) {
  let maxProgress = 0
  const historyChunks = Array.isArray(value.history) ? value.history : []

  for (const chunk of historyChunks) {
    const progress = Number(chunk?.metadata?.progress ?? 0)
    if (Number.isFinite(progress)) maxProgress = Math.max(maxProgress, Math.min(100, progress))
    for (const thread of chunk?.threads ?? []) {
      const threadWaId = String(thread?.id ?? '')
      if (!threadWaId) continue
      for (const message of thread?.messages ?? []) {
        const fromMe = message?.history_context?.from_me === true
        const customerWaId = fromMe ? threadWaId : String(message?.from ?? threadWaId)
        await storeMessage(supabase, connection, message, {
          customerWaId,
          direction: fromMe ? 'outbound' : 'inbound',
          historical: true,
          source: 'coexistence_history',
        })
      }
    }
  }

  const errors = Array.isArray(value.errors) ? value.errors : []
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (errors.length) {
    update.history_sync_status = 'failed'
    update.history_sync_last_error = String(errors[0]?.message ?? errors[0]?.title ?? 'history_sync_rejected').slice(0, 500)
  } else if (maxProgress >= 100) {
    update.history_sync_status = 'completed'
    update.history_sync_progress = 100
    update.history_sync_completed_at = new Date().toISOString()
    update.history_sync_last_error = null
  } else {
    update.history_sync_status = 'in_progress'
    update.history_sync_progress = maxProgress
  }
  await supabase.from('whatsapp_connections').update(update).eq('id', connection.id)
}

async function handleStateSync(supabase: Service, connection: Connection, value: Record<string, any>) {
  for (const item of value.state_sync ?? []) {
    if (item?.type !== 'contact' || !item?.contact) continue
    const contact = item.contact
    const waId = String(contact.wa_id ?? contact.phone_number ?? contact.phone ?? '')
    if (!waId) continue
    const fullName = typeof contact.full_name === 'string' ? contact.full_name : null
    // Por segurança, remoções na agenda do aparelho não apagam histórico da Secretária.
    await ensureContact(supabase, connection.company_id, waId, fullName)
  }
  await supabase.from('whatsapp_connections').update({ contacts_sync_status: 'received', updated_at: new Date().toISOString() }).eq('id', connection.id)
}

async function handleAccountUpdate(supabase: Service, entryId: string, value: Record<string, any>) {
  const event = String(value.event ?? value.account_update?.event ?? '')
  if (event !== 'PARTNER_REMOVED') return
  const { data: connection } = await supabase.from('whatsapp_connections').select('id,company_id').eq('waba_id', entryId).maybeSingle()
  if (!connection) return
  const now = new Date().toISOString()
  await supabase.from('whatsapp_connections').update({ status: 'disconnected', disconnected_at: now, last_error: 'partner_removed', updated_at: now }).eq('id', connection.id)
  await supabase.from('audit_logs').insert({ company_id: connection.company_id, action: 'whatsapp.partner_removed', entity_type: 'whatsapp_connection', entity_id: connection.id })
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const verifyToken = Deno.env.get('META_VERIFY_TOKEN') ?? ''

  if (req.method === 'GET') {
    if (verifyToken && url.searchParams.get('hub.mode') === 'subscribe' && safeEqual(url.searchParams.get('hub.verify_token') ?? '', verifyToken)) {
      return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const rawBody = await req.text()
    const appSecret = Deno.env.get('META_APP_SECRET') ?? ''
    const signature = req.headers.get('x-hub-signature-256') ?? ''
    if (!appSecret) return json({ error: 'webhook_not_configured' }, 503)
    const expected = `sha256=${await hmacHex(appSecret, rawBody)}`
    if (!safeEqual(signature, expected)) return new Response('Invalid signature', { status: 401 })

    const payload = JSON.parse(rawBody)
    if (payload.object !== 'whatsapp_business_account') return json({ received: true, ignored: true })

    const supabase = serviceClient()
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const field = String(change.field ?? '')
        const value = change.value ?? {}

        if (field === 'account_update') {
          await handleAccountUpdate(supabase, String(entry.id ?? ''), value)
          continue
        }

        const phoneNumberId = String(value.metadata?.phone_number_id ?? '')
        if (!phoneNumberId) continue
        const connection = await connectionByPhone(supabase, phoneNumberId)
        if (!connection || connection.status !== 'connected') continue
        await touchConnection(supabase, connection.id)

        if (field === 'messages' || Array.isArray(value.messages)) await handleMessages(supabase, connection, value)
        else if (field === 'smb_message_echoes') await handleEchoes(supabase, connection, value)
        else if (field === 'history') await handleHistory(supabase, connection, value)
        else if (field === 'smb_app_state_sync') await handleStateSync(supabase, connection, value)
      }
    }
    return json({ received: true })
  } catch (error) {
    console.error('whatsapp-webhook', error)
    return json({ received: false, error: 'internal_error' }, 500)
  }
})
