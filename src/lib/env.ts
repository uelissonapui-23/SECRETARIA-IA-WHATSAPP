const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
const metaAppId = import.meta.env.VITE_META_APP_ID?.trim()
const metaConfigId = import.meta.env.VITE_META_CONFIG_ID?.trim()
const metaGraphVersion = import.meta.env.VITE_META_GRAPH_VERSION?.trim()

export const env = {
  supabaseUrl: url ?? '',
  supabasePublishableKey: publishableKey ?? '',
  metaAppId: metaAppId ?? '',
  metaConfigId: metaConfigId ?? '',
  metaGraphVersion: metaGraphVersion || 'v26.0',
}

export const envReady = Boolean(env.supabaseUrl && env.supabasePublishableKey)
