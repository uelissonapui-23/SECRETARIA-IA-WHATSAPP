import { CheckCircle2, CircleAlert, Clock3, Link2, MessageCircle, RefreshCw, ShieldCheck, Unplug, Wifi } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCompany } from '../company/CompanyProvider'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../utils/errorMessage'
import { metaSignupConfigured, startWhatsAppEmbeddedSignup, type MetaSignupDiagnostic } from '../whatsapp/metaEmbeddedSignup'

type Connection = {
  id: string
  company_id: string
  waba_id: string | null
  phone_number_id: string | null
  display_phone_number: string | null
  phone_number_name: string | null
  status: string
  connected_at: string | null
  activation_at: string | null
  disconnected_at: string | null
  last_webhook_at: string | null
  last_error: string | null
  connection_mode?: string | null
  coexistence_verified_at?: string | null
  coexistence_is_on_biz_app?: boolean | null
  platform_type?: string | null
  contacts_sync_status?: string | null
  history_sync_status?: string | null
  history_sync_progress?: number | null
  history_sync_last_error?: string | null
}

async function functionInvokeErrorMessage(error: unknown) {
  const context = (error as { context?: Response } | null)?.context
  if (context && typeof context.clone === 'function') {
    try {
      const payload = await context.clone().json() as { error?: string; step?: string; trace_id?: string }
      if (payload?.error) {
        const reference = payload.trace_id ? ` [ref. ${payload.trace_id}]` : ''
        return `${payload.error}${reference}`
      }
    } catch { /* resposta sem JSON; usa a mensagem padrão abaixo */ }
  }
  return errorMessage(error)
}

function formatDate(value: string | null) {
  if (!value) return 'Ainda não'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

export function WhatsAppPage() {
  const { currentCompany, currentMembership, refresh } = useCompany()
  const [connection, setConnection] = useState<Connection | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [metaDiagnostics, setMetaDiagnostics] = useState<MetaSignupDiagnostic[]>([])

  const canManage = currentMembership?.role === 'owner' || currentMembership?.role === 'admin'
  const connected = connection?.status === 'connected'

  const load = useCallback(async () => {
    if (!currentCompany) return
    setLoading(true)
    const { data, error: queryError } = await supabase.from('whatsapp_connections')
      .select('id,company_id,waba_id,phone_number_id,display_phone_number,phone_number_name,status,connected_at,activation_at,disconnected_at,last_webhook_at,last_error,connection_mode,coexistence_verified_at,coexistence_is_on_biz_app,platform_type,contacts_sync_status,history_sync_status,history_sync_progress,history_sync_last_error')
      .eq('company_id', currentCompany.id).maybeSingle()
    if (queryError) setError(errorMessage(queryError))
    setConnection((data as Connection | null) ?? null)
    setLoading(false)
  }, [currentCompany])

  useEffect(() => { void load() }, [load])

  const status = useMemo(() => {
    if (loading) return { label: 'Verificando', className: 'neutral' }
    if (connected) return { label: 'Conectado', className: 'success' }
    if (connection?.status === 'error') return { label: 'Precisa de atenção', className: 'danger' }
    return { label: 'Não conectado', className: 'neutral' }
  }, [connected, connection?.status, loading])

  async function connect() {
    if (!currentCompany || !canManage) return
    setError(''); setNotice(''); setMetaDiagnostics([]); setBusy(true)
    try {
      await startWhatsAppEmbeddedSignup(async (code, meta) => {
        try {
          setNotice('Autorização recebida. Vinculando o número com segurança...')
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
          if (sessionError || !sessionData.session?.access_token) throw new Error('not_authenticated')
          const { data, error: invokeError } = await supabase.functions.invoke('whatsapp-connect', {
            body: { company_id: currentCompany.id, code, ...meta },
            headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
          })
          if (invokeError) throw new Error(await functionInvokeErrorMessage(invokeError))
          if (data?.error) throw new Error(`${data.error}${data.trace_id ? ` [ref. ${data.trace_id}]` : ''}`)
          const warnings = Array.isArray(data?.sync_warnings) ? data.sync_warnings.filter(Boolean) : []
          setNotice(warnings.length
            ? `WhatsApp conectado em coexistência. ${warnings.join(' ')}`
            : 'WhatsApp conectado em coexistência. Seu WhatsApp Business continua ativo e a sincronização foi iniciada.')
          await Promise.all([load(), refresh()])
        } catch (err) { setError(errorMessage(err)) }
        finally { setBusy(false) }
      }, (message) => { setNotice(message); if (/cancelada|erro|não retornou|não concluiu|incomplet|não informou|não enviou|tempo esperado|tente novamente/i.test(message)) setBusy(false) }, (diagnostic) => setMetaDiagnostics((current) => [...current.slice(-11), diagnostic]))
    } catch (err) { setError(errorMessage(err)); setBusy(false) }
  }

  async function disconnect() {
    if (!currentCompany || !canManage || !window.confirm('Parar a conexão da Secretária neste sistema? Isso não remove automaticamente a conexão da Meta dentro do WhatsApp Business.')) return
    setBusy(true); setError(''); setNotice('')
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError || !sessionData.session?.access_token) throw new Error('not_authenticated')
      const { data, error: invokeError } = await supabase.functions.invoke('whatsapp-disconnect', {
        body: { company_id: currentCompany.id },
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      })
      if (invokeError) throw invokeError
      if (data?.error) throw new Error(data.error)
      setNotice('A Secretária parou de usar esta conexão local. Para remover também a conexão da Meta, faça isso no WhatsApp Business em Configurações > Conta > Plataforma de negócios.')
      await Promise.all([load(), refresh()])
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  return <section>
    <div className="page-heading whatsapp-heading"><div><span className="eyebrow">WHATSAPP</span><h1>Conexão segura com o WhatsApp Business</h1><p>Usamos o modo oficial de coexistência: o cliente continua usando o WhatsApp Business e a Secretária recebe os eventos autorizados pela Meta.</p></div><span className={`connection-pill ${status.className}`}>{connected ? <Wifi size={15}/> : <Unplug size={15}/>} {status.label}</span></div>

    <div className="whatsapp-layout">
      <div className="whatsapp-main-card">
        <div className="whatsapp-card-head"><div className="whatsapp-icon"><MessageCircle size={26}/></div><div><h2>{connected ? 'WhatsApp conectado' : 'Conecte seu WhatsApp Business'}</h2><p>{connected ? 'A Secretária está conectada sem tirar o número do WhatsApp Business.' : 'A conexão só é concluída quando a Meta confirma o modo de coexistência. Não usamos migração tradicional como caminho padrão.'}</p></div></div>

        {connected ? <>
          <div className="connection-number"><span>Número conectado</span><strong>{connection?.display_phone_number ?? 'Número autorizado'}</strong><small>{connection?.phone_number_name ?? 'WhatsApp Business'}</small></div>
          <div className="connection-facts"><div><span>Monitoramento iniciado</span><strong>{formatDate(connection?.activation_at ?? null)}</strong></div><div><span>Último evento recebido</span><strong>{formatDate(connection?.last_webhook_at ?? null)}</strong></div></div>
          <div className="safe-note"><ShieldCheck size={20}/><div><strong>Coexistência confirmada</strong><span>O número continua no WhatsApp Business. Se o cliente autorizou o compartilhamento, a Meta pode sincronizar contatos e até 180 dias de conversas 1:1; esse histórico é guardado como contexto e não entra automaticamente na análise retroativa da IA.</span></div></div>
          <div className="connection-facts">
            <div><span>Sincronização de contatos</span><strong>{connection?.contacts_sync_status ?? 'não iniciada'}</strong></div>
            <div><span>Histórico</span><strong>{connection?.history_sync_status ?? 'não iniciado'}{typeof connection?.history_sync_progress === 'number' && connection.history_sync_progress > 0 ? ` · ${connection.history_sync_progress}%` : ''}</strong></div>
          </div>
          {connection?.history_sync_last_error && <div className="integration-warning"><CircleAlert size={18}/><div><strong>Histórico precisa de atenção</strong><span>{connection.history_sync_last_error}</span></div></div>}
          {canManage && <div className="connection-actions"><button className="secondary-button" type="button" onClick={()=>void load()} disabled={busy}><RefreshCw size={16}/>Atualizar status</button><button className="danger-button" type="button" onClick={disconnect} disabled={busy}><Unplug size={16}/>{busy?'Processando...':'Parar nesta Secretária'}</button></div>}
        </> : <>
          <div className="connection-steps"><div><span>1</span><div><strong>Conecte o WhatsApp Business existente</strong><small>A Meta deve mostrar a opção de conectar o app que o cliente já usa.</small></div></div><div><span>2</span><div><strong>Confirme a coexistência</strong><small>A Secretária só salva a conexão depois que a Meta confirma que o número permanece no WhatsApp Business.</small></div></div><div><span>3</span><div><strong>Sincronize sem perder contexto</strong><small>Com autorização do cliente, contatos e histórico 1:1 podem ser sincronizados. O cliente continua atendendo no app.</small></div></div></div>
          {!metaSignupConfigured() && <div className="integration-warning"><CircleAlert size={19}/><div><strong>Integração Meta ainda não configurada</strong><span>O administrador da plataforma precisa informar o App ID e o Configuration ID antes da primeira conexão.</span></div></div>}
          {canManage ? <button className="primary-button connect-button" type="button" onClick={connect} disabled={busy || !metaSignupConfigured()}><Link2 size={17}/>{busy?'Aguardando Meta...':'Conectar sem sair do WhatsApp Business'}</button> : <div className="permission-note">Somente proprietário ou administrador da empresa pode alterar a conexão.</div>}
        </>}
        {notice && <div className="form-success whatsapp-message">{notice}</div>}
        {metaDiagnostics.length > 0 && <div className="integration-warning whatsapp-message"><CircleAlert size={18}/><div><strong>Diagnóstico Meta (temporário)</strong><span style={{display:'block', marginBottom:6}}>Copie ou tire uma foto destas linhas depois de tentar conectar. Nenhum token ou ID completo é exibido.</span>{metaDiagnostics.map((item, index) => <span key={`${item.stage}-${index}`} style={{display:'block', fontFamily:'monospace', fontSize:12, overflowWrap:'anywhere'}}>#{index + 1} {item.stage}{item.loginStatus ? ` · login=${item.loginStatus}` : ''}{item.origin ? ` · origem=${item.origin}` : ''}{item.trustedOrigin === false ? ' · origem-não-confiável' : ''}{item.payloadKind ? ` · payload=${item.payloadKind}` : ''}{item.type ? ` · tipo=${item.type}` : ''}{item.event ? ` · evento=${item.event}` : ''}{item.topLevelKeys?.length ? ` · chaves=${item.topLevelKeys.join(',')}` : ''}{item.payloadPreview ? ` · conteúdo=${item.payloadPreview}` : ''}{item.hasAuthorizationCode !== undefined ? ` · code=${item.hasAuthorizationCode ? 'sim' : 'não'}` : ''}{item.hasWabaId !== undefined ? ` · WABA=${item.hasWabaId ? 'sim' : 'não'}` : ''}{item.hasPhoneNumberId !== undefined ? ` · número=${item.hasPhoneNumberId ? 'sim' : 'não'}` : ''}</span>)}</div></div>}
        {error && <div className="form-error whatsapp-message">{error}</div>}
      </div>

      <aside className="whatsapp-side-card"><span className="eyebrow">MODO OBSERVAÇÃO</span><h2>O que acontece depois da conexão?</h2><ul className="behavior-list"><li><CheckCircle2 size={18}/><span><strong>Novas mensagens em texto</strong> passam pelo pipeline da Secretária.</span></li><li><Clock3 size={18}/><span><strong>Mensagens antigas</strong> não são importadas para análise retroativa.</span></li><li><ShieldCheck size={18}/><span><strong>Áudios e mídias</strong> ficam fora da análise nesta versão.</span></li><li><MessageCircle size={18}/><span><strong>Nenhuma resposta automática</strong> é enviada ao cliente.</span></li></ul><div className="privacy-box"><strong>Controle humano</strong><span>A IA identifica e sugere. O empresário confirma, edita ou ignora.</span></div></aside>
    </div>
  </section>
}
