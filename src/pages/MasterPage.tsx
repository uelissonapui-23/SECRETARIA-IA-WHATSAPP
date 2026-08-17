import { useCallback, useEffect, useState } from 'react'
import { Activity, Building2, Database, MessageCircle, RefreshCw, ShieldCheck, Sparkles, UsersRound } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDateTime } from '../lib/format'

type Overview = {
  companies:number
  users:number
  whatsapp_connected:number
  whatsapp_total:number
  pending_suggestions:number
  open_work:number
  messages:number
}
type CompanyRow = { id:string; name:string; created_at:string; member_count:number; whatsapp_status:string; open_items:number }

export function MasterPage(){
  const[role,setRole]=useState<string|null>(null)
  const[overview,setOverview]=useState<Overview|null>(null)
  const[companies,setCompanies]=useState<CompanyRow[]>([])
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState('')

  const load=useCallback(async()=>{
    setLoading(true);setError('')
    try{
      const roleResult=await supabase.rpc('get_my_platform_role')
      if(roleResult.error)throw roleResult.error
      const currentRole=(roleResult.data as string|null)??null
      setRole(currentRole)
      if(!currentRole){setOverview(null);setCompanies([]);return}
      const[o,c]=await Promise.all([supabase.rpc('platform_master_overview'),supabase.rpc('platform_master_companies',{limit_rows:80})])
      if(o.error)throw o.error;if(c.error)throw c.error
      setOverview(o.data as Overview);setCompanies((c.data??[]) as CompanyRow[])
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar a Área Master.')}finally{setLoading(false)}
  },[])
  useEffect(()=>{void load()},[load])

  if(loading)return <section><div className="panel-card">Carregando Área Master...</div></section>
  if(!role)return <section><div className="big-empty panel-card"><ShieldCheck size={38}/><h2>Área administrativa restrita</h2><p>Seu usuário não possui função administrativa da plataforma. As permissões Master são independentes das permissões de cada empresa.</p></div></section>

  return <section>
    <div className="page-heading master-heading"><div><span className="eyebrow">ÁREA MASTER · {role.toUpperCase()}</span><h1>Saúde da plataforma</h1><p>Visão administrativa sem expor tokens, segredos ou chaves privadas no navegador.</p></div><button className="secondary-button" onClick={()=>void load()}><RefreshCw size={16}/>Atualizar</button></div>
    {error&&<div className="form-error page-message">{error}</div>}
    {overview&&<div className="master-stats">
      <div className="master-stat blue"><span><Building2 size={19}/>Empresas</span><strong>{overview.companies}</strong></div>
      <div className="master-stat violet"><span><UsersRound size={19}/>Usuários</span><strong>{overview.users}</strong></div>
      <div className="master-stat mint"><span><MessageCircle size={19}/>WhatsApp conectado</span><strong>{overview.whatsapp_connected}<small> / {overview.whatsapp_total}</small></strong></div>
      <div className="master-stat amber"><span><Sparkles size={19}/>Sugestões pendentes</span><strong>{overview.pending_suggestions}</strong></div>
      <div className="master-stat coral"><span><Activity size={19}/>Trabalho aberto</span><strong>{overview.open_work}</strong></div>
      <div className="master-stat navy"><span><Database size={19}/>Mensagens recebidas</span><strong>{overview.messages}</strong></div>
    </div>}

    <div className="master-grid">
      <div className="panel-card master-companies"><div className="panel-head"><div><span className="eyebrow">EMPRESAS</span><h2>Operação atual</h2></div><span className="mini-status">{companies.length} exibidas</span></div><div className="master-table"><div className="master-table-head"><span>Empresa</span><span>Equipe</span><span>WhatsApp</span><span>Pendências</span><span>Criada</span></div>{companies.map(c=><div className="master-table-row" key={c.id}><strong>{c.name}</strong><span>{c.member_count}</span><span className={`integration-state ${c.whatsapp_status==='connected'?'ok':'paused'}`}>{c.whatsapp_status==='connected'?'Conectado':'Pendente'}</span><span>{c.open_items}</span><span>{formatDateTime(c.created_at)}</span></div>)}</div></div>
      <aside className="panel-card integration-panel"><span className="eyebrow">INTEGRAÇÕES E SEGURANÇA</span><h2>Configuração segura</h2><div className="integration-row"><div className="settings-icon mint"><Database size={18}/></div><div><strong>Supabase</strong><span>Banco, Auth, RLS e Edge Functions</span></div><span className="integration-state ok">Ativo</span></div><div className="integration-row"><div className="settings-icon blue"><MessageCircle size={18}/></div><div><strong>Meta / WhatsApp</strong><span>Fluxo preservado para retomada</span></div><span className="integration-state paused">Pausado</span></div><div className="security-note"><ShieldCheck size={18}/><span>Segredos reais permanecem fora do frontend. Esta tela mostra somente estado operacional e dados públicos da configuração.</span></div></aside>
    </div>
  </section>
}
