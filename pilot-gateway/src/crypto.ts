import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { BufferJSON } from 'baileys'
import { config } from './config.js'

const key = Buffer.from(config.encryptionKey, 'base64')
if (key.length !== 32) throw new Error('PILOT_AUTH_ENCRYPTION_KEY must decode to exactly 32 bytes')

export function seal(value: unknown) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const plain = Buffer.from(JSON.stringify(value, BufferJSON.replacer), 'utf8')
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function open<T>(payload: string): T {
  const raw = Buffer.from(payload, 'base64')
  const iv = raw.subarray(0, 12), tag = raw.subarray(12, 28), encrypted = raw.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  return JSON.parse(plain, BufferJSON.reviver) as T
}
