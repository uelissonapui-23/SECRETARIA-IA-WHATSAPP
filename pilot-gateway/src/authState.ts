import { initAuthCreds, type AuthenticationCreds, type AuthenticationState, type SignalDataTypeMap } from 'baileys'
import { admin } from './db.js'
import { open, seal } from './crypto.js'

type Stored = { creds: AuthenticationCreds; keys: Record<string, Record<string, unknown>> }

export async function dbAuthState(companyId: string): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void>; clear: () => Promise<void> }> {
  const { data } = await admin.from('pilot_whatsapp_auth').select('encrypted_state').eq('company_id', companyId).maybeSingle()
  let stored: Stored = data?.encrypted_state ? open<Stored>(data.encrypted_state) : { creds: initAuthCreds(), keys: {} }

  async function persist() {
    await admin.from('pilot_whatsapp_auth').upsert({ company_id: companyId, encrypted_state: seal(stored), state_version: 1, updated_at: new Date().toISOString() })
  }

  const state: AuthenticationState = {
    creds: stored.creds,
    keys: {
      get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
        const bucket = stored.keys[type] || {}
        const result: Record<string, SignalDataTypeMap[T]> = {}
        for (const id of ids) if (bucket[id] !== undefined) result[id] = bucket[id] as SignalDataTypeMap[T]
        return result
      },
      set: async (data) => {
        for (const [type, entries] of Object.entries(data)) {
          const bucket = stored.keys[type] || (stored.keys[type] = {})
          for (const [id, value] of Object.entries(entries || {})) {
            if (value === null || value === undefined) delete bucket[id]
            else bucket[id] = value
          }
        }
        await persist()
      },
    },
  }

  return {
    state,
    saveCreds: async () => { stored.creds = state.creds; await persist() },
    clear: async () => { stored = { creds: initAuthCreds(), keys: {} }; await admin.from('pilot_whatsapp_auth').delete().eq('company_id', companyId) },
  }
}
