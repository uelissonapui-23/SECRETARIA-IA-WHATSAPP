import type { WAMessage } from 'baileys'
import { admin } from './db.js'
import { config } from './config.js'
import { phoneFromPnJid, resolvePhoneJid } from './phoneIdentity.js'

function textOf(message: WAMessage) {
  const m = message.message
  return m?.conversation || m?.extendedTextMessage?.text || m?.imageMessage?.caption || m?.videoMessage?.caption || null
}
export async function ingestIncoming(companyId: string, message: WAMessage, resolveLid?: (lid: string) => Promise<string | null>) {
  if (!message.key.id || message.key.fromMe) return
  const jid = message.key.remoteJid || ''
  if (!jid || jid === 'status@broadcast' || jid.endsWith('@g.us') || jid.endsWith('@newsletter')) return
  const body = textOf(message)?.trim()
  if (!body) return // piloto V1: somente texto/caption; mídia/áudio ficam fora

  const phoneJid = await resolvePhoneJid(message, resolveLid)
  const phone = phoneFromPnJid(phoneJid)
  const name = message.pushName?.trim() || phone || 'Contato WhatsApp'
  const whatsappId = `pilot:${jid}`
  const { data: existing, error: lookupError } = await admin.from('contacts').select('id,name,phone').eq('company_id', companyId).eq('whatsapp_id', whatsappId).maybeSingle()
  if (lookupError) throw lookupError
  let contact = existing
  let contactError = null
  if (existing) {
    const updates: Record<string, unknown> = {}
    if (phone && phone !== existing.phone) updates.phone = phone
    if ((!existing.name || existing.name === 'Contato WhatsApp') && name !== 'Contato WhatsApp') updates.name = name
    if (Object.keys(updates).length) {
      const result = await admin.from('contacts').update(updates).eq('id', existing.id).select('id,name,phone').single()
      contact = result.data; contactError = result.error
    }
  } else {
    const result = await admin.from('contacts').insert({ company_id: companyId, whatsapp_id: whatsappId, name, phone }).select('id,name,phone').single()
    contact = result.data; contactError = result.error
  }
  if (contactError || !contact) throw contactError || new Error('contact_not_created')

  const at = message.messageTimestamp ? new Date(Number(message.messageTimestamp) * 1000) : new Date()
  const { data: conversationId, error: conversationError } = await admin.rpc('whatsapp_touch_conversation', {
    target_company_id: companyId, target_contact_id: contact.id, target_message_at: at.toISOString(),
  })
  if (conversationError || !conversationId) throw conversationError || new Error('conversation_not_created')

  const { data: inserted, error: messageError } = await admin.from('messages').insert({
    company_id: companyId,
    conversation_id: conversationId,
    contact_id: contact.id,
    provider_message_id: `pilot:${message.key.id}`,
    direction: 'inbound',
    message_type: 'text',
    body_text: body.slice(0, 4000),
    provider_timestamp: at.toISOString(),
    raw_payload: { _secretaria_source: 'pilot_gateway', remote_jid: jid, phone_jid: phoneJid, message_id: message.key.id },
    eligible_for_ai: true,
  }).select('id').single()

  if (messageError?.code === '23505') return
  if (messageError || !inserted) throw messageError || new Error('message_not_created')

  await admin.from('message_jobs').upsert({ company_id: companyId, message_id: inserted.id }, { onConflict: 'message_id', ignoreDuplicates: true })
  await admin.from('pilot_whatsapp_sessions').update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('company_id', companyId)

  const response = await fetch(`${config.supabaseUrl}/functions/v1/process-message`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-worker-secret': config.workerSecret },
    body: JSON.stringify({ message_id: inserted.id, source: 'message' }),
  })
  if (!response.ok) throw new Error(`analysis_failed:${response.status}`)
}
