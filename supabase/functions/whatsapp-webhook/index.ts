import { createClient } from 'npm:@supabase/supabase-js@2'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

async function hmacHex(secret: string, body: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2,'0')).join('')
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const verifyToken = Deno.env.get('META_VERIFY_TOKEN') ?? ''

  if (req.method === 'GET') {
    if (url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === verifyToken) {
      return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 })
    }
    return new Response('Forbidden', { status: 403 })
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const rawBody = await req.text()
  const appSecret = Deno.env.get('META_APP_SECRET') ?? ''
  const signature = req.headers.get('x-hub-signature-256') ?? ''
  if (appSecret) {
    const expected = `sha256=${await hmacHex(appSecret, rawBody)}`
    if (signature !== expected) return new Response('Invalid signature', { status: 401 })
  }

  const payload = JSON.parse(rawBody)
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SECRET_KEY')!)

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {}
      const phoneNumberId = value.metadata?.phone_number_id
      if (!phoneNumberId) continue

      const { data: connection } = await supabase.from('whatsapp_connections').select('company_id,connected_at').eq('phone_number_id', phoneNumberId).eq('status','connected').maybeSingle()
      if (!connection) continue

      const companyId = connection.company_id
      for (const message of value.messages ?? []) {
        const messageTimestamp = new Date(Number(message.timestamp) * 1000)
        if (connection.connected_at && messageTimestamp < new Date(connection.connected_at)) continue

        const waId = message.from
        const contactName = (value.contacts ?? []).find((c: any) => c.wa_id === waId)?.profile?.name ?? null
        const { data: contact, error: contactError } = await supabase.from('contacts').upsert({ company_id: companyId, whatsapp_id: waId, phone: waId, name: contactName }, { onConflict: 'company_id,whatsapp_id' }).select().single()
        if (contactError) throw contactError

        const { data: conversation, error: conversationError } = await supabase.from('conversations').upsert({ company_id: companyId, contact_id: contact.id, last_message_at: messageTimestamp.toISOString() }, { onConflict: 'company_id,contact_id' }).select().single()
        if (conversationError) throw conversationError

        const bodyText = message.type === 'text' ? message.text?.body ?? null : null
        const eligible = message.type === 'text'
        const { data: inserted, error: messageError } = await supabase.from('messages').upsert({
          company_id: companyId,
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
          await supabase.from('message_jobs').upsert({ company_id: companyId, message_id: inserted.id }, { onConflict: 'message_id', ignoreDuplicates: true })
        }
      }
    }
  }

  return json({ received: true })
})
