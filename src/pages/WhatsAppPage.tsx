import { CheckCircle2, CircleAlert, Clock3, Link2, MessageCircle, RefreshCw, ShieldCheck, Unplug, Wifi } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCompany } from '../company/CompanyProvider'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../utils/errorMessage'
import { metaSignupConfigured, startWhatsAppEmbeddedSignup } from '../whatsapp/metaEmbeddedSignup'

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

  const canManage = currentMembership?.role === 'owner' || currentMembership?.role === 'admin'
  const connected = connection?.status === 'connected'

  const load = useCallback(async () => {
    if (!currentCompany) return
    setLoading(true)
    const { data, error: queryError } = await supabase.from('whatsapp_connections')
      .select('id,company_id,waba_id,phone_number_id,display_phone_number,phone_number_name,status,connected_at,activation_at,disconnected_at,last_webhook_at,last_error')
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
    setError(''); setNotice(''); setBusy(true)
    try {
      await startWhatsAppEmbeddedSignup(async (code, meta) => {
        try {
          setNotice('Autorização recebida. Vinculando o número com segurança...')
          const { data, error: invokeError } = await supabase.functions.invoke('whatsapp-connect', {
            body: { company_id: currentCompany.id, code, ...meta },
          })
          if (invokeError) throw invokeError
          if (data?.error) throw new Error(data.error)
          setNotice('WhatsApp conectado. A Secretária passa a observar somente novas mensagens a partir de agora.')
          await Promise.all([load(), refresh()])
        } catch (err) { setError(errorMessage(err)) }
        finally { setBusy(false) }
      }, (message) => { setNotice(message); if (/cancelada|erro|não retornou/i.test(message)) setBusy(false) })
    } catch (err) { setError(errorMessage(err)); setBusy(false) }
  }

  async function disconnect() {
    if (!currentCompany || !canManage || !window.confirm('Desconectar este WhatsApp? A Secretária deixará de registrar novas mensagens até uma nova conexão.')) return
    setBusy(true); setError(''); setNotice('')
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('whatsapp-disconnect', { body: { company_id: currentCompany.id } })
      if (invokeError) throw invokeError
      if (data?.error) throw new Error(data.error)
      setNotice('WhatsApp desconectado do sistema.')
      await Promise.all([load(), refresh()])
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  return <section>
    <div className="page-heading whatsapp-heading"><div><span className="eyebrow">WHATSAPP</span><h1>Conexão da Secretária</h1><p>Conecte o WhatsApp Business da empresa para a Secretária acompanhar somente as novas mensagens em texto, sem responder clientes.</p></div><span className={`connection-pill ${status.className}`}>{connected ? <Wifi size={15}/> : <Unplug size={15}/>} {status.label}</span></div>

    <div className="whatsapp-layout">
      <div className="whatsapp-main-card">
        <div className="whatsapp-card-head"><div className="whatsapp-icon"><MessageCircle size={26}/></div><div><h2>{connected ? 'WhatsApp conectado' : 'Conecte seu WhatsApp Business'}</h2><p>{connected ? 'A Secretária está pronta para receber eventos novos deste número.' : 'A conexão usa o fluxo oficial da Meta. Você autoriza o número e continua atendendo normalmente no WhatsApp Business.'}</p></div></div>

        {connected ? <>
          <div className="connection-number"><span>Número conectado</span><strong>{connection?.display_phone_number ?? 'Número autorizado'}</strong><small>{connection?.phone_number_name ?? 'WhatsApp Business'}</small></div>
          <div className="connection-facts"><div><span>Monitoramento iniciado</span><strong>{formatDate(connection?.activation_at ?? null)}</strong></div><div><span>Último evento recebido</span><strong>{formatDate(connection?.last_webhook_at ?? null)}</strong></div></div>
          <div className="safe-note"><ShieldCheck size={20}/><div><strong>Seu histórico anterior não é varrido</strong><span>O sistema considera somente mensagens recebidas depois do momento de ativação. Quando uma nova mensagem depende de contexto, apenas um trecho curto das mensagens recentes é usado.</span></div></div>
          {canManage && <div className="connection-actions"><button className="secondary-button" type="button" onClick={()=>void load()} disabled={busy}><RefreshCw size={16}/>Atualizar status</button><button className="danger-button" type="button" onClick={disconnect} disabled={busy}><Unplug size={16}/>{busy?'Processando...':'Desconectar'}</button></div>}
        </> : <>
          <div className="connection-steps"><div><span>1</span><div><strong>Autorize pela Meta</strong><small>Use a conta responsável pelo WhatsApp Business.</small></div></div><div><span>2</span><div><strong>Escolha o número</strong><small>O sistema registra o número e o momento exato da ativação.</small></div></div><div><span>3</span><div><strong>Continue atendendo</strong><small>A V1 observa e organiza. Ela não envia mensagens por você.</small></div></div></div>
          {!metaSignupConfigured() && <div className="integration-warning"><CircleAlert size={19}/><div><strong>Integração Meta ainda não configurada</strong><span>O administrador da plataforma precisa informar o App ID e o Configuration ID antes da primeira conexão.</span></div></div>}
          {canManage ? <button className="primary-button connect-button" type="button" onClick={connect} disabled={busy || !metaSignupConfigured()}><Link2 size={17}/>{busy?'Aguardando Meta...':'Conectar WhatsApp'}</button> : <div className="permission-note">Somente proprietário ou administrador da empresa pode alterar a conexão.</div>}
        </>}
        {notice && <div className="form-success whatsapp-message">{notice}</div>}
        {error && <div className="form-error whatsapp-message">{error}</div>}
      </div>

      <aside className="whatsapp-side-card"><span className="eyebrow">MODO OBSERVAÇÃO</span><h2>O que acontece depois da conexão?</h2><ul className="behavior-list"><li><CheckCircle2 size={18}/><span><strong>Novas mensagens em texto</strong> passam pelo pipeline da Secretária.</span></li><li><Clock3 size={18}/><span><strong>Mensagens antigas</strong> não são importadas para análise retroativa.</span></li><li><ShieldCheck size={18}/><span><strong>Áudios e mídias</strong> ficam fora da análise nesta versão.</span></li><li><MessageCircle size={18}/><span><strong>Nenhuma resposta automática</strong> é enviada ao cliente.</span></li></ul><div className="privacy-box"><strong>Controle humano</strong><span>A IA identifica e sugere. O empresário confirma, edita ou ignora.</span></div></aside>
    </div>
  </section>
}
