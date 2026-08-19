import makeWASocket, { Browsers, DisconnectReason, type WASocket } from 'baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import QRCode from 'qrcode'
import { dbAuthState } from './authState.js'
import { admin } from './db.js'
import { ingestIncoming } from './ingest.js'
import { config } from './config.js'

type Runtime = { socket: WASocket; qrDataUrl: string | null; reconnects: number; closing: boolean; connection: 'connecting' | 'open' | 'closed' }
const runtimes = new Map<string, Runtime>()
const logger = pino({ level: process.env.LOG_LEVEL || 'warn' })

async function patch(companyId: string, values: Record<string, unknown>) {
  const { error } = await admin.from('pilot_whatsapp_sessions').upsert({ company_id: companyId, gateway_instance: config.instance, updated_at: new Date().toISOString(), ...values }, { onConflict: 'company_id' })
  if (error) logger.error({ companyId, code: error.code, message: error.message }, 'pilot session status persistence failed')
  return !error
}

export async function startSession(companyId: string) {
  const existing = runtimes.get(companyId)
  if (existing) {
    if (existing.connection === 'open') {
      const jid = existing.socket.user?.id || null
      await patch(companyId, { status: 'connected', whatsapp_jid: jid, display_phone_number: jid?.split(':')[0] || null, last_connected_at: new Date().toISOString(), last_error: null })
    } else {
      await patch(companyId, { status: 'connecting', last_error: null })
    }
    return
  }
  await patch(companyId, { status: 'connecting', last_error: null })
  const auth = await dbAuthState(companyId)
  const socket = makeWASocket({ auth: auth.state, logger, browser: Browsers.ubuntu('Secretaria IA Pilot'), markOnlineOnConnect: false, syncFullHistory: false, generateHighQualityLinkPreview: false })
  const runtime: Runtime = { socket, qrDataUrl: null, reconnects: 0, closing: false, connection: 'connecting' }
  runtimes.set(companyId, runtime)

  socket.ev.on('creds.update', auth.saveCreds)
  socket.ev.on('messages.upsert', async ({ messages, type }) => {
    logger.info({
      companyId,
      type,
      count: messages.length,
      fromMe: messages.filter((message) => message.key.fromMe).length,
      direct: messages.filter((message) => {
        const jid = message.key.remoteJid || ''
        return Boolean(jid) && !jid.endsWith('@g.us') && jid !== 'status@broadcast' && !jid.endsWith('@newsletter')
      }).length,
      withText: messages.filter((message) => Boolean(
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text ||
        message.message?.imageMessage?.caption ||
        message.message?.videoMessage?.caption
      )).length,
    }, 'pilot messages upsert')
    if (type !== 'notify') {
      logger.info({ companyId, type, count: messages.length }, 'pilot messages ignored because event is not new')
      return
    }
    for (const message of messages) {
      try {
        await ingestIncoming(companyId, message)
        logger.info({ companyId }, 'pilot message ingest completed')
      }
      catch (error) { logger.error({ companyId, err: String(error) }, 'pilot message ingest failed') }
    }
  })
  socket.ev.on('connection.update', async ({ connection, qr, lastDisconnect }) => {
    if (connection) logger.info({ companyId, connection }, 'pilot connection update')
    if (qr) {
      runtime.qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 320 })
      await patch(companyId, { status: 'qr_ready' })
    }
    if (connection === 'open') {
      runtime.qrDataUrl = null; runtime.reconnects = 0; runtime.connection = 'open'
      const jid = socket.user?.id || null
      await patch(companyId, { status: 'connected', whatsapp_jid: jid, display_phone_number: jid?.split(':')[0] || null, last_connected_at: new Date().toISOString(), last_error: null })
    }
    if (connection === 'close') {
      runtime.connection = 'closed'
      runtimes.delete(companyId)
      if (runtime.closing) return
      const code = lastDisconnect?.error instanceof Boom ? lastDisconnect.error.output.statusCode : 0
      if (code === DisconnectReason.loggedOut) {
        await auth.clear(); await patch(companyId, { status: 'disconnected', whatsapp_jid: null, display_phone_number: null, last_error: 'logged_out' }); return
      }
      await patch(companyId, { status: 'reconnecting', last_error: `connection_closed:${code || 'unknown'}` })
      const delay = Math.min(30000, 1000 * 2 ** Math.min(runtime.reconnects, 5))
      setTimeout(() => { void startSession(companyId) }, delay)
    }
  })
}

export async function stopSession(companyId: string, erase = true) {
  const runtime = runtimes.get(companyId)
  if (runtime) { runtime.closing = true; runtime.socket.end(undefined); runtimes.delete(companyId) }
  if (erase) { const auth = await dbAuthState(companyId); await auth.clear() }
  await patch(companyId, { status: 'disconnected', whatsapp_jid: null, display_phone_number: null, last_error: null })
}

export async function status(companyId: string) {
  const { data, error } = await admin.from('pilot_whatsapp_sessions').select('status,display_phone_number,last_connected_at,last_message_at,last_error').eq('company_id', companyId).maybeSingle()
  if (error) logger.error({ companyId, code: error.code, message: error.message }, 'pilot session status query failed')
  const runtime = runtimes.get(companyId)
  if (runtime?.connection === 'open') {
    const jid = runtime.socket.user?.id || null
    if (data?.status !== 'connected') void patch(companyId, { status: 'connected', whatsapp_jid: jid, display_phone_number: jid?.split(':')[0] || null, last_error: null })
    return { ...(data || {}), status: 'connected', display_phone_number: data?.display_phone_number || jid?.split(':')[0] || null, qr_data_url: null }
  }
  if (runtime) return { ...(data || {}), status: runtime.qrDataUrl ? 'qr_ready' : 'connecting', qr_data_url: runtime.qrDataUrl }
  return { ...(data || { status: 'disconnected' }), qr_data_url: null }
}

export async function restoreAll() {
  const { data } = await admin.from('pilot_whatsapp_auth').select('company_id')
  for (const row of data || []) { try { await startSession(row.company_id) } catch (error) { logger.error({ companyId: row.company_id, err: String(error) }, 'restore failed') } }
}
