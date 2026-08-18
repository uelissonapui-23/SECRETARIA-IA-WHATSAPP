import type { WAMessage } from 'baileys'
import { admin } from './db.js'
import { config } from './config.js'

function textOf(message: WAMessage) {
  const m = message.message
  return m?.conversation || m?.extendedTextMessage?.text || m?.imageMessage?.caption || m?.videoMessage?.caption || null
}
function phoneOf(jid: string) { return jid.split('@')[0].replace(/\D/g, '').slice(0, 20) }

export async function ingestIncoming(companyId: string, message: WAMessage) {
  if (!message.key.id || message.key.fromMe) return
  const jid = message.key.remoteJid || ''
  if (!jid || jid === 'status@broadcast' || jid.endsWith('@g.us') || jid.endsWith('@newsletter')) return
  const body = textOf(message)?.trim()
  if (!body) return // piloto V1: somente texto/caption; mídia/áudio ficam fora

  const phone = phoneOf(jid)
  const name = message.pushName?.trim() || phone || 'Contato WhatsApp'
  const { data: contact, error: contactError } = await admin.from('contacts').upsert({
    company_id: companyId, whatsapp_id: `pilot:${jid}`, name, phone: phone || null,
  }, { onConflict: 'company_id,whatsapp_id' }).select('id').single()
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
    raw_payload: { _secretaria_source: 'pilot_gateway', remote_jid: jid, message_id: message.key.id },
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
