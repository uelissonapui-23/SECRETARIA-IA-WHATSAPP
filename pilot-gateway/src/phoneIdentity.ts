import type { WAMessage } from 'baileys'

export function phoneFromPnJid(jid: string | null | undefined) {
  if (!jid || (!jid.endsWith('@s.whatsapp.net') && !jid.endsWith('@c.us'))) return null
  const phone = jid.split('@')[0].split(':')[0].replace(/\D/g, '').slice(0, 20)
  return phone.length >= 8 ? phone : null
}

export async function resolvePhoneJid(message: WAMessage, resolveLid?: (lid: string) => Promise<string | null>) {
  const candidates = [message.key.remoteJidAlt, message.key.participantAlt, message.key.remoteJid, message.key.participant]
  const direct = candidates.find((jid) => phoneFromPnJid(jid))
  if (direct) return direct
  const lid = candidates.find((jid) => jid?.endsWith('@lid'))
  return lid && resolveLid ? await resolveLid(lid).catch(() => null) : null
}
