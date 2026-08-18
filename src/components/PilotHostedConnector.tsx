import { useCallback, useEffect, useState } from 'react'
import { Link2, RefreshCw, ShieldCheck, Unplug, Wifi } from 'lucide-react'
import { connectPilot, disconnectPilot, getPilotStatus, pilotGatewayConfigured, type PilotGatewayStatus } from '../pilot/pilotGateway'

const empty: PilotGatewayStatus = { status: 'disconnected' }
export function PilotHostedConnector({ companyId, canManage }: { companyId:string; canManage:boolean }) {
  const [state,setState]=useState<PilotGatewayStatus>(empty), [busy,setBusy]=useState(false), [refreshing,setRefreshing]=useState(false), [error,setError]=useState('')
  const refresh=useCallback(async()=>{
    if(!pilotGatewayConfigured()) return
    setRefreshing(true)
    try{setState(await getPilotStatus(companyId));setError('')}
    catch(e){setError(e instanceof Error?e.message:'gateway_error')}
    finally{setRefreshing(false)}
  },[companyId])
  useEffect(()=>{void refresh(); const id=window.setInterval(()=>void refresh(), state.status==='qr_ready'||state.status==='connecting'?2500:10000); return()=>window.clearInterval(id)},[refresh,state.status])
  async function connect(){setBusy(true);setError('');try{setState(await connectPilot(companyId))}catch(e){setError(e instanceof Error?e.message:'gateway_error')}finally{setBusy(false)}}
  async function disconnect(){if(!window.confirm('Desconectar o WhatsApp piloto e apagar as credenciais vinculadas desta empresa?'))return;setBusy(true);try{await disconnectPilot(companyId);setState(empty)}catch(e){setError(e instanceof Error?e.message:'gateway_error')}finally{setBusy(false)}}
  if(!pilotGatewayConfigured()) return <div className="integration-warning"><ShieldCheck size={18}/><div><strong>Gateway hospedado ainda não publicado</strong><span>Depois do primeiro deploy no Railway, configure VITE_PILOT_GATEWAY_URL na Vercel. A integração Meta permanece preservada.</span></div></div>
  const connected=state.status==='connected'
  return <div className="validation-card validation-simulator">
    <div className="validation-card-head"><div><span className="eyebrow">PILOTO HOSPEDADO 24H</span><h3>WhatsApp real sem deixar o computador ligado</h3><p>Cada empresa possui uma sessão isolada no gateway. O conector recebe mensagens e entrega ao pipeline da Secretária; não existe função de envio.</p></div><span className="validation-safe-pill">{connected?<Wifi size={15}/>:<ShieldCheck size={15}/>} {connected?'Conectado':state.status==='qr_ready'?'Aguardando QR':state.status==='reconnecting'?'Reconectando':'Desconectado'}</span></div>
    {state.qr_data_url && <div className="pilot-qr-box"><img src={state.qr_data_url} alt="QR Code temporário para vincular WhatsApp"/><div><strong>Escaneie no WhatsApp</strong><span>WhatsApp → Dispositivos conectados → Conectar um dispositivo. O QR não é salvo no banco.</span></div></div>}
    {connected && <div className="validation-result-card"><strong>{state.display_phone_number||'WhatsApp vinculado'}</strong><span>Última mensagem recebida: {state.last_message_at?new Date(state.last_message_at).toLocaleString('pt-BR'):'ainda nenhuma neste piloto'}.</span></div>}
    {state.last_error && <div className="integration-warning"><ShieldCheck size={18}/><div><strong>Conexão precisa de atenção</strong><span>{state.last_error}</span></div></div>}
    {error && <div className="form-error">{error}</div>}
    <div className="validation-actions">{canManage&&!connected&&<button type="button" className="primary-button" onClick={()=>void connect()} disabled={busy}><Link2 size={17}/>{busy?'Preparando...':'Conectar WhatsApp piloto'}</button>}<button type="button" className="secondary-button" onClick={()=>void refresh()} disabled={busy||refreshing}><RefreshCw size={17} className={refreshing?'pilot-refresh-spin':''}/>{refreshing?'Atualizando...':'Atualizar'}</button>{canManage&&connected&&<button type="button" className="danger-button" onClick={()=>void disconnect()} disabled={busy}><Unplug size={17}/>Desconectar e apagar sessão</button>}</div>
    <div className="validation-note"><ShieldCheck size={17}/><span><strong>Experimental:</strong> esta ponte usa WhatsApp Web não oficial apenas para validar o produto. Pode sofrer instabilidade. A integração oficial Meta/Coexistence continua sendo a arquitetura definitiva.</span></div>
  </div>
}
