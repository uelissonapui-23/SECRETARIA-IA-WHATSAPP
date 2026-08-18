import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } })

type ImportedMessage = {
  direction: 'inbound' | 'outbound'
  body: string
  timestamp?: string | null
  author?: string | null
}

type ImportInput = {
  company_id?: string
  action?: 'import' | 'clear'
  contact_name?: string
  contact_phone?: string
  messages?: ImportedMessage[]
  analyze_last_inbound?: boolean
}

function cleanPhone(value: string) {
  return value.replace(/\D/g, '').slice(0, 20)
}

function cleanText(value: unknown, limit: number) {
  return String(value ?? '').trim().slice(0, limit)
}

async function verifyAccess(url: string, anon: string, token: string, companyId: string) {
  // A autorização deve usar o próprio JWT do usuário e as políticas RLS,
  // exatamente como o frontend faz. Isso evita depender da service-role
  // para descobrir o papel do usuário e evita falsos 403 caso uma chave
  // administrativa seja rotacionada/indisponível.
  const authClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })

  const { data: { user }, error: userError } = await authClient.auth.getUser(token)
  if (userError || !user) {
    console.warn('[validation-import] auth-user-failed', { message: userError?.message ?? 'user_not_found' })
    return { allowed: false, user: null as null | { id: string }, role: null as string | null, reason: 'unauthorized' }
  }

  const { data: membership, error: membershipError } = await authClient
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError) {
    console.error('[validation-import] membership-query-failed', {
      company_id: companyId,
      user_id: user.id,
      code: membershipError.code,
      message: membershipError.message,
    })
    return { allowed: false, user, role: null as string | null, reason: 'membership_query_failed' }
  }

  const role = membership?.role ?? null
  console.info('[validation-import] membership-check', {
    company_id: companyId,
    user_id: user.id,
    role,
    allowed: role === 'owner' || role === 'admin',
  })
  return { allowed: role === 'owner' || role === 'admin', user, role, reason: role ? 'role_not_allowed' : 'membership_not_found' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'unauthorized' }, 401)

    const input = await req.json().catch(() => ({})) as ImportInput
    const companyId = cleanText(input.company_id, 80)
    if (!companyId) return json({ error: 'company_id_required' }, 400)

    const url = Deno.env.get('SUPABASE_URL') ?? ''
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? ''
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? ''
    if (!url || !anon || !service) return json({ error: 'server_not_configured' }, 503)

    const access = await verifyAccess(url, anon, token, companyId)
    if (!access.user) return json({ error: 'unauthorized' }, 401)
    if (!access.allowed) {
      if (access.reason === 'membership_query_failed') return json({ error: 'membership_query_failed' }, 500)
      return json({ error: 'not_company_admin', role: access.role }, 403)
    }

    const admin = createClient(url, service, { auth: { persistSession: false } })

    if (input.action === 'clear') {
      const { data: contacts, error: contactsError } = await admin.from('contacts')
        .select('id')
        .eq('company_id', companyId)
        .like('whatsapp_id', 'validation:%')
      if (contactsError) return json({ error: 'validation_cleanup_failed' }, 500)
      const ids = (contacts ?? []).map((item) => item.id)
      if (ids.length > 0) {
        const { error: deleteError } = await admin.from('contacts').delete().eq('company_id', companyId).in('id', ids)
        if (deleteError) return json({ error: 'validation_cleanup_failed' }, 500)
      }
      await admin.from('audit_logs').insert({ company_id: companyId, actor_user_id: access.user.id, action: 'validation_data_cleared', entity_type: 'validation', metadata: { contacts_removed: ids.length } })
      return json({ ok: true, contacts_removed: ids.length })
    }

    const incoming = Array.isArray(input.messages) ? input.messages.slice(-200) : []
    const messages = incoming
      .map((message) => ({
        direction: message.direction === 'outbound' ? 'outbound' as const : 'inbound' as const,
        body: cleanText(message.body, 4000),
        timestamp: message.timestamp ? String(message.timestamp) : null,
        author: cleanText(message.author, 120) || null,
      }))
      .filter((message) => message.body)

    if (messages.length === 0) return json({ error: 'messages_required' }, 400)

    const contactName = cleanText(input.contact_name, 120) || 'Cliente de teste'
    const phone = cleanPhone(input.contact_phone ?? '')
    const stableKey = phone || contactName.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || crypto.randomUUID().slice(0, 8)
    const validationWaId = `validation:${stableKey}`

    const contactPayload: Record<string, unknown> = { company_id: companyId, whatsapp_id: validationWaId, name: contactName }
    if (phone) contactPayload.phone = phone
    const { data: contact, error: contactError } = await admin.from('contacts')
      .upsert(contactPayload, { onConflict: 'company_id,whatsapp_id' })
      .select('id')
      .single()
    if (contactError || !contact) return json({ error: 'contact_import_failed' }, 500)

    const sessionId = crypto.randomUUID()
    const latestTimestamp = messages.map((message) => message.timestamp ? new Date(message.timestamp) : new Date()).sort((a, b) => b.getTime() - a.getTime())[0] ?? new Date()
    const { data: conversationId, error: conversationError } = await admin.rpc('whatsapp_touch_conversation', {
      target_company_id: companyId,
      target_contact_id: contact.id,
      target_message_at: latestTimestamp.toISOString(),
    })
    if (conversationError || !conversationId) return json({ error: 'conversation_import_failed' }, 500)

    const analyzeIndex = input.analyze_last_inbound === false ? -1 : messages.map((message, index) => ({ message, index })).filter(({ message }) => message.direction === 'inbound').at(-1)?.index ?? -1
    const insertedIds: string[] = []
    let analysisMessageId: string | null = null

    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index]
      const parsedTimestamp = message.timestamp ? new Date(message.timestamp) : new Date(Date.now() - (messages.length - index) * 1000)
      const at = Number.isNaN(parsedTimestamp.getTime()) ? new Date() : parsedTimestamp
      const eligible = index === analyzeIndex
      const { data: inserted, error: insertError } = await admin.from('messages').insert({
        company_id: companyId,
        conversation_id: conversationId,
        contact_id: contact.id,
        provider_message_id: `validation:${sessionId}:${index}`,
        direction: message.direction,
        message_type: 'text',
        body_text: message.body,
        provider_timestamp: at.toISOString(),
        raw_payload: { _secretaria_source: 'validation_import', validation_session_id: sessionId, author: message.author },
        eligible_for_ai: eligible,
      }).select('id').single()
      if (insertError || !inserted) return json({ error: 'message_import_failed', imported: insertedIds.length }, 500)
      insertedIds.push(inserted.id)
      if (eligible) analysisMessageId = inserted.id
    }

    let analysis: Record<string, unknown> | null = null
    if (analysisMessageId) {
      const { error: jobError } = await admin.from('message_jobs').upsert({ company_id: companyId, message_id: analysisMessageId }, { onConflict: 'message_id', ignoreDuplicates: true })
      if (jobError) return json({ error: 'analysis_queue_failed', imported: insertedIds.length }, 500)

      const workerSecret = Deno.env.get('WORKER_SECRET') ?? ''
      if (!workerSecret) return json({ error: 'worker_not_configured', imported: insertedIds.length }, 503)
      const response = await fetch(`${url}/functions/v1/process-message`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-worker-secret': workerSecret },
        body: JSON.stringify({ message_id: analysisMessageId, source: 'message' }),
      })
      analysis = await response.json().catch(() => ({ ok: response.ok })) as Record<string, unknown>
      if (!response.ok) return json({ error: 'analysis_failed', imported: insertedIds.length, analysis }, 502)
    }

    await admin.from('audit_logs').insert({
      company_id: companyId,
      actor_user_id: access.user.id,
      action: 'validation_conversation_imported',
      entity_type: 'validation',
      entity_id: analysisMessageId,
      metadata: { session_id: sessionId, messages_imported: insertedIds.length, analyzed_last_inbound: Boolean(analysisMessageId), source: 'whatsapp_export_or_manual' },
    })

    return json({ ok: true, session_id: sessionId, imported: insertedIds.length, analyzed: Boolean(analysisMessageId), analysis })
  } catch (error) {
    console.error('validation-import', error)
    return json({ error: 'internal_error' }, 500)
  }
})
