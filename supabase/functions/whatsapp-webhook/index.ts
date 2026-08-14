import { createClient } from 'npm:@supabase/supabase-js@2'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

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
        const value = change.value ?? {}
        const phoneNumberId = value.metadata?.phone_number_id
        if (!phoneNumberId) continue

        const { data: connection } = await supabase.from('whatsapp_connections')
          .select('id,company_id,activation_at,connected_at')
          .eq('phone_number_id', phoneNumberId).eq('status', 'connected').maybeSingle()
        if (!connection) continue

        await supabase.from('whatsapp_connections').update({ last_webhook_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq('id', connection.id)
        const activation = connection.activation_at ?? connection.connected_at

        for (const message of value.messages ?? []) {
          const messageTimestamp = new Date(Number(message.timestamp) * 1000)
          if (activation && messageTimestamp < new Date(activation)) continue

          const waId = message.from
          if (!waId || !message.id) continue
          const contactName = (value.contacts ?? []).find((c: { wa_id?: string }) => c.wa_id === waId)?.profile?.name ?? null
          const { data: contact, error: contactError } = await supabase.from('contacts').upsert({ company_id: connection.company_id, whatsapp_id: waId, phone: waId, name: contactName }, { onConflict: 'company_id,whatsapp_id' }).select().single()
          if (contactError) throw contactError

          const { data: conversation, error: conversationError } = await supabase.from('conversations').upsert({ company_id: connection.company_id, contact_id: contact.id, last_message_at: messageTimestamp.toISOString() }, { onConflict: 'company_id,contact_id' }).select().single()
          if (conversationError) throw conversationError

          const bodyText = message.type === 'text' ? message.text?.body ?? null : null
          const eligible = message.type === 'text' && Boolean(bodyText)
          const { data: inserted, error: messageError } = await supabase.from('messages').upsert({
            company_id: connection.company_id,
            conversation_id: conversation.id,
            contact_id: contact.id,
            provider_message_id: message.id,
            direction: 'inbound',
            message_type: message.type,
            body_text: bodyText,
            provider_timestamp: messageTimestamp.toISOString(),
            raw_payload: message,
            eligible_for_ai: eligible,
          }, { onConflict: 'company_id,provider_message_id', ignoreDuplicates: true }).select('id,eligible_for_ai').maybeSingle()
          if (messageError) throw messageError

          if (inserted?.eligible_for_ai) {
            await supabase.from('message_jobs').upsert({ company_id: connection.company_id, message_id: inserted.id }, { onConflict: 'message_id', ignoreDuplicates: true })
          }
          if (inserted) await supabase.rpc('whatsapp_increment_received', { target_company_id: connection.company_id })
        }
      }
    }
    return json({ received: true })
  } catch (error) {
    console.error('whatsapp-webhook', error)
    return json({ received: false, error: 'internal_error' }, 500)
  }
})
