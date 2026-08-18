function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`missing_env:${name}`)
  return value
}

export const config = {
  port: Number(process.env.PORT || 3000),
  supabaseUrl: required('SUPABASE_URL'),
  anonKey: required('SUPABASE_ANON_KEY'),
  serviceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  workerSecret: required('WORKER_SECRET'),
  encryptionKey: required('PILOT_AUTH_ENCRYPTION_KEY'),
  origins: (process.env.FRONTEND_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean),
  instance: process.env.GATEWAY_INSTANCE?.trim() || 'pilot-1',
}
