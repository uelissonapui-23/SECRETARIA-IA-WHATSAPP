import test from 'node:test'
import assert from 'node:assert/strict'
import type { WAMessage } from 'baileys'
import { phoneFromPnJid, resolvePhoneJid } from './phoneIdentity.js'

const message = (key: WAMessage['key']) => ({ key } as WAMessage)

test('never treats an internal LID as a phone number', () => {
  assert.equal(phoneFromPnJid('2586174355962@lid'), null)
})

test('uses the alternate WhatsApp phone JID when present', async () => {
  const jid = await resolvePhoneJid(message({ remoteJid: '2586174355962@lid', remoteJidAlt: '5597991234567@s.whatsapp.net' }))
  assert.equal(phoneFromPnJid(jid), '5597991234567')
})

test('resolves a LID through the authenticated WhatsApp mapping', async () => {
  const jid = await resolvePhoneJid(message({ remoteJid: '2586174355962@lid' }), async () => '5597991234567@s.whatsapp.net')
  assert.equal(phoneFromPnJid(jid), '5597991234567')
})
