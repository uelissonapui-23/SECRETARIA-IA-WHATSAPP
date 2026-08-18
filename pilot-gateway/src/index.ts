import express from 'express'
import { config } from './config.js'
import { authorize } from './db.js'
import { restoreAll, startSession, status, stopSession } from './sessionManager.js'

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '64kb' }))
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && config.origins.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.get('/health', (_req, res) => res.json({ ok: true, service: 'secretaria-pilot-gateway', instance: config.instance }))

async function authReq(req: express.Request, res: express.Response) {
  const companyId = String(req.params.companyId || '')
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!companyId || !token) { res.status(401).json({ error: 'unauthorized' }); return null }
  const access = await authorize(token, companyId)
  if (!access.allowed) {
    const statusCode = access.reason === 'invalid_user_token' ? 401 : 403
    console.warn('[pilot-gateway] request-rejected', { company_id: companyId, method: req.method, path: req.path, reason: access.reason })
    res.status(statusCode).json({ error: statusCode === 401 ? 'unauthorized' : 'forbidden', reason: access.reason, role: access.role ?? null })
    return null
  }
  return { companyId, ...access }
}

app.post('/v1/companies/:companyId/session', async (req, res) => { const a = await authReq(req,res); if (!a) return; await startSession(a.companyId); res.json(await status(a.companyId)) })
app.get('/v1/companies/:companyId/session', async (req, res) => { const a = await authReq(req,res); if (!a) return; res.json(await status(a.companyId)) })
app.delete('/v1/companies/:companyId/session', async (req, res) => { const a = await authReq(req,res); if (!a) return; await stopSession(a.companyId, true); res.json({ ok: true }) })

app.use((_req,res)=>res.status(404).json({error:'not_found'}))
app.use((error: unknown,_req: express.Request,res: express.Response)=>{ console.error(error); res.status(500).json({error:'internal_error'}) })

app.listen(config.port, '0.0.0.0', () => { console.log(`pilot gateway listening on ${config.port}`); void restoreAll() })
