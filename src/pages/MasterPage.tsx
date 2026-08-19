import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Beaker,
  Building2,
  Database,
  GitBranch,
  LayoutDashboard,
  MessageCircle,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Image,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDateTime } from '../lib/format'
import { evidenceLabel, evidenceState } from '../lib/aiReleaseSafety'
import { releaseHealthLabel, type ReleaseHealth } from '../lib/aiReleaseReview'
import '../master-clean.css'
import '../master-responsive.css'
import { MasterBrandingPanel } from '../components/MasterBrandingPanel'

type Overview = { companies:number; users:number; whatsapp_connected:number; whatsapp_total:number; pending_suggestions:number; open_work:number; messages:number; analysis_runs_24h?:number; analysis_errors_24h?:number; pending_jobs?:number; failed_jobs?:number; exhausted_jobs?:number }
type CompanyRow = { id:string; name:string; created_at:string; member_count:number; whatsapp_status:string; open_items:number }
type IntegrationRow = { key:string; label:string; provider:string; status:'healthy'|'paused'|'attention'|'unknown'; version:string|null; public_config:Record<string,unknown>; notes:string|null; last_checked_at:string|null; updated_at:string }
type ActivityRow = { id:number; action:string; target_company_id:string|null; metadata:Record<string,unknown>; created_at:string }
type AiUsage = { ai_companies:number; hybrid_companies:number; llm_companies:number; tokens_24h:number; cost_24h_usd:number; fallbacks_24h:number }
type Quality = { feedback_30d:number; correct_30d:number; incorrect_30d:number; accuracy_30d:number }
type AiAccessRow = { company_id:string; company_name:string; release_state:'locked'|'pilot'|'enabled'; ai_enabled:boolean; engine_mode:string; active_release_id:string|null; previous_release_id:string|null; updated_at:string }
type AiRelease = { id:string; version:number; label:string; status:'draft'|'approved'|'retired'; config:Record<string,unknown>; notes:string|null; created_at:string; approved_at:string|null }
type EvalMaster = { evaluation_runs_30d:number; companies_with_baseline:number; regressions_latest_24h:number; ai_locked:number; ai_pilot:number; ai_enabled:number }
type AiEvolution = { runs_7d:number; severe_regressions_7d:number; auto_promotions_30d:number; auto_locks_30d:number; auto_rollbacks_30d?:number; quarantined_releases?:number; companies_auto_promote:number; avg_active_score_7d:number }
type ReleaseEvidence = { release_id:string; version:number; label:string; status:string; quarantined:boolean; quarantine_reason:string|null; active_companies:number; runs_30d:number; avg_score_30d:number; regressions_30d:number; severe_regressions_30d:number; last_run_at:string|null }
type ReleaseReview = { id:number; release_id:string; version:number; label:string; decision:'approved'|'rejected'|'needs_work'; reason:string; checklist:Record<string,boolean>; evidence_snapshot:Record<string,unknown>; created_at:string }
type ReleaseHealthRow = { release_id:string; version:number; label:string; status:string; health:ReleaseHealth; runs_30d:number; avg_score_30d:number; regressions_30d:number; severe_regressions_30d:number; active_companies:number; quarantined:boolean; last_decision:string|null; last_review_at:string|null }
type AiEvolutionRow = { company_id:string; company_name:string; release_state:'locked'|'pilot'|'enabled'; active_release_id:string|null; release_version:number|null; auto_promote:boolean; auto_lock_on_severe_regression:boolean; required_pilot_runs:number; min_active_score:number; max_regressions:number; severe_regression_count:number; severe_score_drop:number; latest_score:number; latest_regressions:number; latest_severe:boolean; pilot_runs:number; eligible_for_promotion:boolean }
type MasterTab = 'overview'|'companies'|'ai'|'integrations'|'branding'|'audit'
type AiTab = 'summary'|'access'|'releases'|'safety'

const integrationIcon = (key:string) => key === 'meta_whatsapp' ? MessageCircle : key === 'github' ? GitBranch : key === 'vercel' ? ServerCog : Database
const statusLabel:Record<IntegrationRow['status'], string> = { healthy:'Saudável', paused:'Pausado', attention:'Atenção', unknown:'Não verificado' }

export function MasterPage() {
  const [role,setRole] = useState<string|null>(null)
  const [activeTab,setActiveTab] = useState<MasterTab>('overview')
  const [aiTab,setAiTab] = useState<AiTab>('summary')
  const [releaseReviews,setReleaseReviews] = useState<ReleaseReview[]>([])
  const [releaseHealth,setReleaseHealth] = useState<ReleaseHealthRow[]>([])
  const [reviewReason,setReviewReason] = useState('')
  const [reviewBusy,setReviewBusy] = useState('')
  const [releaseEvidence,setReleaseEvidence] = useState<ReleaseEvidence[]>([])
  const [aiEvolution,setAiEvolution] = useState<AiEvolution|null>(null)
  const [aiEvolutionRows,setAiEvolutionRows] = useState<AiEvolutionRow[]>([])
  const [guardrailBusy,setGuardrailBusy] = useState('')
  const [aiReleases,setAiReleases] = useState<AiRelease[]>([])
  const [newReleaseLabel,setNewReleaseLabel] = useState('Motor híbrido estável')
  const [releaseAction,setReleaseAction] = useState('')
  const [aiAccess,setAiAccess] = useState<AiAccessRow[]>([])
  const [evalMaster,setEvalMaster] = useState<EvalMaster|null>(null)
  const [releaseBusy,setReleaseBusy] = useState('')
  const [quality,setQuality] = useState<Quality|null>(null)
  const [overview,setOverview] = useState<Overview|null>(null)
  const [aiUsage,setAiUsage] = useState<AiUsage|null>(null)
  const [companies,setCompanies] = useState<CompanyRow[]>([])
  const [integrations,setIntegrations] = useState<IntegrationRow[]>([])
  const [activity,setActivity] = useState<ActivityRow[]>([])
  const [loading,setLoading] = useState(true)
  const [error,setError] = useState('')
  const [query,setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const roleResult = await supabase.rpc('get_my_platform_role')
      if (roleResult.error) throw roleResult.error
      const currentRole = (roleResult.data as string|null) ?? null
      setRole(currentRole)
      if (!currentRole) {
        setOverview(null); setCompanies([]); setIntegrations([]); setActivity([])
        return
      }
      const [o,c,i,a,ai,q,access,ev,releases,evolution,evolutionRows,evidence,reviews,health] = await Promise.all([
        supabase.rpc('platform_master_overview'),
        supabase.rpc('platform_master_companies',{limit_rows:100}),
        supabase.rpc('platform_master_integrations'),
        supabase.rpc('platform_master_activity',{limit_rows:25}),
        supabase.rpc('platform_master_ai_usage'),
        supabase.rpc('platform_master_quality'),
        supabase.rpc('platform_master_ai_access'),
        supabase.rpc('platform_master_ai_evaluation'),
        supabase.rpc('platform_master_ai_releases'),
        supabase.rpc('platform_master_ai_evolution'),
        supabase.rpc('platform_master_ai_evolution_rows'),
        supabase.rpc('platform_master_release_evidence'),
        supabase.rpc('platform_master_release_review_history'),
        supabase.rpc('platform_master_release_health'),
      ])
      if (o.error) throw o.error
      if (c.error) throw c.error
      if (i.error) throw i.error
      if (a.error) throw a.error
      setOverview(o.data as Overview)
      setCompanies((c.data ?? []) as CompanyRow[])
      setIntegrations((i.data ?? []) as IntegrationRow[])
      setActivity((a.data ?? []) as ActivityRow[])
      if (!ai.error) setAiUsage((ai.data ?? null) as AiUsage|null)
      if (!q.error) setQuality((q.data ?? null) as Quality|null)
      if (!access.error) setAiAccess((access.data ?? []) as AiAccessRow[])
      if (!ev.error) setEvalMaster((ev.data ?? null) as EvalMaster|null)
      if (!releases.error) setAiReleases((releases.data ?? []) as AiRelease[])
      if (!evolution.error) setAiEvolution((evolution.data ?? null) as AiEvolution|null)
      if (!evolutionRows.error) setAiEvolutionRows((evolutionRows.data ?? []) as AiEvolutionRow[])
      if (!evidence.error) setReleaseEvidence((evidence.data ?? []) as ReleaseEvidence[])
      if (!reviews.error) setReleaseReviews((reviews.data ?? []) as ReleaseReview[])
      if (!health.error) setReleaseHealth((health.data ?? []) as ReleaseHealthRow[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar a Área Master.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function changeRelease(companyId:string,state:AiAccessRow['release_state']) { if(role!=='master')return; setReleaseBusy(companyId); const{error:e}=await supabase.rpc('platform_master_set_ai_access',{target_company_id:companyId,target_state:state,target_note:'Alterado pela Área Master'}); if(e)setError(e.message);else await load();setReleaseBusy('') }
  async function createEngineRelease() { if(role!=='master'||newReleaseLabel.trim().length<3)return; setReleaseAction('create'); const{error:e}=await supabase.rpc('platform_master_create_ai_release',{target_label:newReleaseLabel.trim(),target_notes:'Criada pela Área Master'}); if(e)setError(e.message);else await load();setReleaseAction('') }
  async function approveEngineRelease(id:string) { setReleaseAction(id); const{error:e}=await supabase.rpc('platform_master_approve_ai_release',{target_release_id:id}); if(e)setError(e.message);else await load();setReleaseAction('') }
  async function activateEngineRelease(companyId:string,releaseId:string) { if(!releaseId)return; setReleaseAction(companyId); const{error:e}=await supabase.rpc('platform_master_activate_ai_release',{target_company_id:companyId,target_release_id:releaseId}); if(e)setError(e.message);else await load();setReleaseAction('') }
  async function rollbackEngineRelease(companyId:string) { setReleaseAction(companyId); const{error:e}=await supabase.rpc('platform_master_rollback_ai_release',{target_company_id:companyId}); if(e)setError(e.message);else await load();setReleaseAction('') }
  async function clearReleaseQuarantine(id:string) { if(role!=='master')return; setReleaseAction(`clear-${id}`); const{error:e}=await supabase.rpc('platform_master_clear_release_quarantine',{target_release_id:id,target_note:'Revisada e liberada pela Área Master'}); if(e)setError(e.message);else await load();setReleaseAction('') }
  async function reviewRelease(id:string,decision:ReleaseReview['decision']) { if(role!=='master'||reviewReason.trim().length<3){setError('Informe um motivo com pelo menos 3 caracteres para registrar a decisão.');return} const h=releaseHealth.find(x=>x.release_id===id);setReviewBusy(id);const checklist={tem_avaliacoes:Boolean(h?.runs_30d),score_80_ou_mais:Number(h?.avg_score_30d??0)>=.8,sem_regressao_grave:Number(h?.severe_regressions_30d??0)===0,fora_de_quarentena:!h?.quarantined};const{error:e}=await supabase.rpc('platform_master_review_ai_release',{target_release_id:id,target_decision:decision,target_reason:reviewReason.trim(),target_checklist:checklist});if(e)setError(e.message);else{setReviewReason('');await load()}setReviewBusy('') }
  async function saveGuardrails(row:AiEvolutionRow,patch:Partial<AiEvolutionRow>={}) { if(role!=='master')return; const next={...row,...patch};setGuardrailBusy(row.company_id);const{error:e}=await supabase.rpc('platform_master_set_ai_guardrails',{target_company_id:row.company_id,target_auto_promote:next.auto_promote,target_auto_lock:next.auto_lock_on_severe_regression,target_required_runs:next.required_pilot_runs,target_min_score:next.min_active_score,target_max_regressions:next.max_regressions,target_severe_count:next.severe_regression_count,target_severe_drop:next.severe_score_drop});if(e)setError(e.message);else await load();setGuardrailBusy('') }

  const visibleCompanies = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? companies.filter(c => c.name.toLowerCase().includes(q)) : companies
  }, [companies,query])

  if (loading) return <section><div className="panel-card">Carregando Área Master...</div></section>
  if (!role) return <section><div className="big-empty panel-card"><ShieldCheck size={38}/><h2>Área administrativa restrita</h2><p>Seu usuário não possui função administrativa da plataforma.</p></div></section>

  const mainTabs:{id:MasterTab;label:string;icon:typeof LayoutDashboard;badge?:number}[] = [
    {id:'overview',label:'Visão geral',icon:LayoutDashboard},
    {id:'companies',label:'Empresas',icon:Building2,badge:overview?.companies},
    {id:'ai',label:'Inteligência',icon:Sparkles,badge:evalMaster?.ai_pilot},
    {id:'integrations',label:'Integrações',icon:ServerCog,badge:integrations.filter(x=>x.status!=='healthy').length},
    {id:'branding',label:'Identidade visual',icon:Image},
    {id:'audit',label:'Auditoria',icon:Activity},
  ]

  return <section className="master-clean-page">
    <div className="page-heading master-heading master-heading-clean">
      <div><span className="eyebrow">ÁREA MASTER · {role.toUpperCase()}</span><h1>Administração da plataforma</h1><p>Escolha uma área abaixo. O painel mostra primeiro só o que precisa de atenção.</p></div>
      <button className="secondary-button master-refresh" onClick={()=>void load()}><RefreshCw size={16}/>Atualizar</button>
    </div>

    <nav className="master-tabs" aria-label="Seções da Área Master">
      {mainTabs.map(tab=>{const Icon=tab.icon;return <button key={tab.id} className={activeTab===tab.id?'active':''} onClick={()=>setActiveTab(tab.id)}><Icon size={17}/><span>{tab.label}</span>{Boolean(tab.badge)&&<small>{tab.badge}</small>}</button>})}
    </nav>
    <label className="master-mobile-selector">
      <span>Área do painel</span>
      <select value={activeTab} onChange={event=>setActiveTab(event.target.value as MasterTab)}>
        {mainTabs.map(tab=><option key={tab.id} value={tab.id}>{tab.label}{Boolean(tab.badge)?` · ${tab.badge}`:''}</option>)}
      </select>
    </label>

    {error&&<div className="form-error page-message">{error}</div>}

    {activeTab==='overview'&&<div className="master-tab-content">
      <div className="master-overview-hero panel-card">
        <div><span className="eyebrow">AGORA</span><h2>O que merece sua atenção</h2><p>Um resumo curto da operação. Detalhes ficam nas outras abas.</p></div>
        <span className="safe-chip"><ShieldCheck size={14}/>Ambiente protegido</span>
      </div>
      {overview&&<div className="master-summary-grid">
        <button className="master-summary-card blue" onClick={()=>setActiveTab('companies')}><Building2 size={20}/><div><span>Empresas</span><strong>{overview.companies}</strong><small>{overview.users} usuários</small></div></button>
        <button className="master-summary-card mint" onClick={()=>setActiveTab('integrations')}><MessageCircle size={20}/><div><span>WhatsApp</span><strong>{overview.whatsapp_connected}/{overview.whatsapp_total}</strong><small>{overview.whatsapp_connected===overview.whatsapp_total?'Tudo conectado':'Há conexões pendentes'}</small></div></button>
        <button className="master-summary-card amber" onClick={()=>setActiveTab('ai')}><Sparkles size={20}/><div><span>IA em atenção</span><strong>{(overview.analysis_errors_24h??0)+(overview.failed_jobs??0)}</strong><small>{overview.pending_jobs??0} na fila</small></div></button>
        <button className="master-summary-card coral" onClick={()=>setActiveTab('companies')}><Activity size={20}/><div><span>Pendências</span><strong>{overview.open_work}</strong><small>{overview.pending_suggestions} sugestões</small></div></button>
      </div>}
      <div className="master-overview-columns">
        <div className="panel-card"><div className="panel-head"><div><span className="eyebrow">SAÚDE</span><h2>Serviços essenciais</h2></div><button className="text-action" onClick={()=>setActiveTab('integrations')}>Ver integrações</button></div><div className="master-quick-health">{integrations.slice(0,4).map(item=><div key={item.key}><span className={`health-dot ${item.status}`}/><strong>{item.label}</strong><small>{statusLabel[item.status]}</small></div>)}</div></div>
        <div className="panel-card"><div className="panel-head"><div><span className="eyebrow">ATIVIDADE</span><h2>Últimas ações</h2></div><button className="text-action" onClick={()=>setActiveTab('audit')}>Ver auditoria</button></div>{activity.slice(0,5).map(row=><div className="master-mini-activity" key={row.id}><span className="activity-dot"/><div><strong>{row.action.replaceAll('_',' ')}</strong><small>{formatDateTime(row.created_at)}</small></div></div>)}</div>
      </div>
    </div>}

    {activeTab==='companies'&&<div className="master-tab-content">
      <div className="master-section-bar"><div><span className="eyebrow">EMPRESAS</span><h2>Empresas da plataforma</h2><p>Busque uma empresa e veja apenas os dados operacionais essenciais.</p></div><div className="master-search"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar empresa"/><span className="mini-status">{visibleCompanies.length}</span></div></div>
      <div className="panel-card master-companies"><div className="master-table"><div className="master-table-head"><span>Empresa</span><span>Equipe</span><span>WhatsApp</span><span>Pendências</span><span>Criada</span></div>{visibleCompanies.map(c=><div className="master-table-row" key={c.id}><strong>{c.name}</strong><span>{c.member_count}</span><span className={`integration-state ${c.whatsapp_status==='connected'?'ok':'paused'}`}>{c.whatsapp_status==='connected'?'Conectado':'Pendente'}</span><span>{c.open_items}</span><span>{formatDateTime(c.created_at)}</span></div>)}</div></div>
    </div>}

    {activeTab==='ai'&&<div className="master-tab-content">
      <div className="master-ai-header"><div><span className="eyebrow">INTELIGÊNCIA</span><h2>Controle da IA</h2><p>Resumo, liberação por empresa, versões e proteções separados para facilitar decisões.</p></div></div>
      <nav className="master-subtabs" aria-label="Controles da inteligência">
        <button className={aiTab==='summary'?'active':''} onClick={()=>setAiTab('summary')}>Visão</button>
        <button className={aiTab==='access'?'active':''} onClick={()=>setAiTab('access')}>Empresas e liberação</button>
        <button className={aiTab==='releases'?'active':''} onClick={()=>setAiTab('releases')}>Releases</button>
        <button className={aiTab==='safety'?'active':''} onClick={()=>setAiTab('safety')}>Segurança e qualidade</button>
      </nav>

      {aiTab==='summary'&&<>
        <div className="master-summary-grid">
          {evalMaster&&<><div className="master-summary-card navy"><ShieldCheck size={20}/><div><span>Bloqueadas</span><strong>{evalMaster.ai_locked}</strong><small>sem IA real</small></div></div><div className="master-summary-card amber"><Beaker size={20}/><div><span>Em piloto</span><strong>{evalMaster.ai_pilot}</strong><small>sob avaliação</small></div></div><div className="master-summary-card mint"><Sparkles size={20}/><div><span>Liberadas</span><strong>{evalMaster.ai_enabled}</strong><small>aprovadas</small></div></div></>}
          {quality&&<div className="master-summary-card violet"><Activity size={20}/><div><span>Precisão humana</span><strong>{quality.feedback_30d?`${Math.round(Number(quality.accuracy_30d)*100)}%`:'—'}</strong><small>{quality.feedback_30d} avaliações</small></div></div>}
        </div>
        <div className="master-overview-columns">
          <div className="panel-card"><div className="panel-head"><div><h2>Uso nas últimas 24h</h2><p>Consumo e fallback do provedor.</p></div></div>{aiUsage?<div className="master-metric-list"><div><span>Tokens</span><strong>{Number(aiUsage.tokens_24h).toLocaleString('pt-BR')}</strong></div><div><span>Custo estimado</span><strong>US$ {Number(aiUsage.cost_24h_usd).toFixed(4)}</strong></div><div><span>Fallbacks</span><strong>{aiUsage.fallbacks_24h}</strong></div></div>:<div className="master-empty-row">Sem dados de uso.</div>}</div>
          <div className="panel-card"><div className="panel-head"><div><h2>Evolução recente</h2><p>Indicadores que realmente pedem atenção.</p></div></div>{aiEvolution?<div className="master-metric-list"><div><span>Score médio · 7d</span><strong>{Math.round(Number(aiEvolution.avg_active_score_7d)*100)}%</strong></div><div><span>Regressões graves · 7d</span><strong>{aiEvolution.severe_regressions_7d}</strong></div><div><span>Releases em quarentena</span><strong>{aiEvolution.quarantined_releases??0}</strong></div></div>:<div className="master-empty-row">Sem histórico suficiente.</div>}</div>
        </div>
      </>}

      {aiTab==='access'&&<div className="panel-card"><div className="panel-head"><div><h2>Liberação por empresa</h2><p>O proprietário pode solicitar IA, mas somente a plataforma decide se fica bloqueada, piloto ou liberada.</p></div></div><div className="master-table"><div className="master-table-head"><span>Empresa</span><span>Modo</span><span>Preferência</span><span>Estado</span><span>Controle</span></div>{aiAccess.slice(0,50).map(row=><div className="master-table-row" key={row.company_id}><strong>{row.company_name}</strong><span>{row.engine_mode||'rules'}</span><span>{row.ai_enabled?'IA solicitada':'Regras'}</span><span className={`integration-state ${row.release_state==='enabled'?'ok':row.release_state==='pilot'?'attention':'paused'}`}>{row.release_state==='enabled'?'Liberada':row.release_state==='pilot'?'Piloto':'Bloqueada'}</span><span>{role==='master'?<div className="release-controls"><select disabled={releaseBusy===row.company_id} value={row.release_state} onChange={e=>void changeRelease(row.company_id,e.target.value as AiAccessRow['release_state'])}><option value="locked">Bloqueada</option><option value="pilot">Piloto</option><option value="enabled">Liberada</option></select><select disabled={releaseAction===row.company_id} value={row.active_release_id??''} onChange={e=>void activateEngineRelease(row.company_id,e.target.value)}><option value="">Versão do motor</option>{aiReleases.filter(r=>r.status==='approved'&&!releaseEvidence.some(ev=>ev.release_id===r.id&&ev.quarantined)).map(r=><option key={r.id} value={r.id}>v{r.version} · {r.label}</option>)}</select>{row.previous_release_id&&<button className="mini-action" disabled={releaseAction===row.company_id} onClick={()=>void rollbackEngineRelease(row.company_id)}>Rollback</button>}</div>:<small>Somente Master</small>}</span></div>)}</div></div>}

      {aiTab==='releases'&&<div className="master-ai-stack">
        <div className="panel-card"><div className="panel-head"><div><h2>Versões do motor</h2><p>Crie rascunhos e aprove apenas quando estiverem prontas.</p></div>{role==='master'&&<div className="inline-actions"><input value={newReleaseLabel} onChange={e=>setNewReleaseLabel(e.target.value)} placeholder="Nome da release"/><button className="secondary-button" disabled={releaseAction==='create'} onClick={()=>void createEngineRelease()}>Criar rascunho</button></div>}</div><div className="master-table"><div className="master-table-head"><span>Versão</span><span>Nome</span><span>Status</span><span>Criada</span><span>Ação</span></div>{aiReleases.slice(0,20).map(r=><div className="master-table-row" key={r.id}><strong>v{r.version}</strong><span>{r.label}</span><span className={`integration-state ${r.status==='approved'?'ok':r.status==='retired'?'paused':'attention'}`}>{r.status==='approved'?'Aprovada':r.status==='retired'?'Arquivada':'Rascunho'}</span><span>{formatDateTime(r.created_at)}</span><span>{role==='master'&&r.status==='draft'?<button className="mini-action" disabled={releaseAction===r.id} onClick={()=>void approveEngineRelease(r.id)}>Aprovar</button>:<small>{r.approved_at?'Pronta':'—'}</small>}</span></div>)}</div></div>
        <div className="panel-card"><div className="panel-head"><div><h2>Evidências por release</h2><p>Comparação objetiva antes de ativar uma versão.</p></div></div><div className="master-table"><div className="master-table-head"><span>Versão</span><span>Evidência</span><span>Uso</span><span>Risco</span><span>Ação</span></div>{releaseEvidence.map(row=>{const state=evidenceState({runs:Number(row.runs_30d),avgScore:Number(row.avg_score_30d),regressions:Number(row.regressions_30d),severeRegressions:Number(row.severe_regressions_30d),companies:Number(row.active_companies),quarantined:row.quarantined});return <div className="master-table-row" key={row.release_id}><strong>v{row.version} · {row.label}</strong><span>{row.runs_30d} exec. · {Math.round(Number(row.avg_score_30d)*100)}%</span><span>{row.active_companies} empresa(s)</span><span className={`integration-state ${state==='healthy'?'ok':state==='risk'?'attention':'paused'}`}>{evidenceLabel(state)}</span><span>{row.quarantined&&role==='master'?<button className="mini-action" disabled={releaseAction===`clear-${row.release_id}`} onClick={()=>void clearReleaseQuarantine(row.release_id)}>Liberar quarentena</button>:<small>{row.last_run_at?formatDateTime(row.last_run_at):'Sem avaliação'}</small>}</span></div>})}</div></div>
      </div>}

      {aiTab==='safety'&&<div className="master-ai-stack">
        <div className="panel-card"><div className="panel-head"><div><h2>Saúde e revisão das releases</h2><p>Informe o motivo antes de aprovar, pedir ajustes ou reprovar.</p></div>{role==='master'&&<input value={reviewReason} onChange={e=>setReviewReason(e.target.value)} placeholder="Motivo da decisão"/>}</div><div className="master-table"><div className="master-table-head"><span>Release</span><span>Saúde</span><span>Evidência</span><span>Última revisão</span><span>Decisão</span></div>{releaseHealth.map(row=><div className="master-table-row" key={row.release_id}><strong>v{row.version} · {row.label}</strong><span className={`integration-state ${row.health==='healthy'?'ok':row.health==='critical'?'attention':'paused'}`}>{releaseHealthLabel(row.health)}</span><span>{row.runs_30d} exec. · {Math.round(Number(row.avg_score_30d)*100)}%</span><span>{row.last_decision?`${row.last_decision} · ${row.last_review_at?formatDateTime(row.last_review_at):''}`:'Sem revisão'}</span><span>{role==='master'?<div className="release-controls"><button className="mini-action" disabled={reviewBusy===row.release_id} onClick={()=>void reviewRelease(row.release_id,'approved')}>Aprovar</button><button className="mini-action" disabled={reviewBusy===row.release_id} onClick={()=>void reviewRelease(row.release_id,'needs_work')}>Ajustar</button><button className="mini-action" disabled={reviewBusy===row.release_id} onClick={()=>void reviewRelease(row.release_id,'rejected')}>Reprovar</button></div>:<small>Somente Master</small>}</span></div>)}</div></div>
        {aiEvolution&&<div className="panel-card"><div className="panel-head"><div><h2>Proteções por empresa</h2><p>Automatizações de segurança ficam reunidas aqui.</p></div></div><div className="master-table"><div className="master-table-head"><span>Empresa</span><span>Versão</span><span>Qualidade</span><span>Piloto</span><span>Proteções</span></div>{aiEvolutionRows.slice(0,50).map(row=><div className="master-table-row" key={row.company_id}><strong>{row.company_name}</strong><span>{row.release_version?`v${row.release_version}`:'Sem versão'}</span><span><span className={`integration-state ${row.latest_severe?'attention':row.eligible_for_promotion?'ok':'paused'}`}>{row.latest_severe?'Regressão grave':row.eligible_for_promotion?'Pronta para promover':`${Math.round(Number(row.latest_score)*100)}%`}</span></span><span>{row.pilot_runs}/{row.required_pilot_runs}</span><span>{role==='master'?<div className="release-controls guardrail-controls"><label className="toggle-row compact"><input type="checkbox" disabled={guardrailBusy===row.company_id} checked={row.auto_promote} onChange={e=>void saveGuardrails(row,{auto_promote:e.target.checked})}/><span>Auto-promover</span></label><label className="toggle-row compact"><input type="checkbox" disabled={guardrailBusy===row.company_id} checked={row.auto_lock_on_severe_regression} onChange={e=>void saveGuardrails(row,{auto_lock_on_severe_regression:e.target.checked})}/><span>Auto-bloquear</span></label></div>:<small>Somente Master</small>}</span></div>)}</div></div>}
        <div className="panel-card"><div className="panel-head"><div><h2>Histórico de decisões</h2><p>Últimas aprovações, ajustes e reprovações.</p></div></div>{releaseReviews.length?<div className="master-activity-list">{releaseReviews.slice(0,15).map(r=><div className="master-activity-row" key={r.id}><span className="activity-dot"/><div><strong>v{r.version} · {r.decision==='approved'?'Aprovada':r.decision==='rejected'?'Reprovada':'Precisa de ajustes'}</strong><span>{r.reason} · {formatDateTime(r.created_at)}</span></div></div>)}</div>:<div className="master-empty-row">Nenhuma decisão registrada.</div>}</div>
      </div>}
    </div>}

    {activeTab==='integrations'&&<div className="master-tab-content">
      <div className="master-section-bar"><div><span className="eyebrow">INTEGRAÇÕES</span><h2>Saúde dos serviços</h2><p>Somente estado e configuração pública. Segredos nunca aparecem aqui.</p></div><span className="safe-chip"><ShieldCheck size={14}/>Segredos protegidos</span></div>
      <div className="integration-health-grid">{integrations.map(item=>{const Icon=integrationIcon(item.key);return <article className={`integration-health-card status-${item.status}`} key={item.key}><div className="integration-health-top"><span className="settings-icon mint"><Icon size={19}/></span><span className={`integration-state ${item.status==='healthy'?'ok':item.status==='paused'?'paused':'attention'}`}>{statusLabel[item.status]}</span></div><h3>{item.label}</h3><p>{item.notes||item.provider}</p><div className="integration-meta"><span>{item.version||item.provider}</span><span>{item.last_checked_at?`Atualizado ${formatDateTime(item.last_checked_at)}`:'Sem verificação recente'}</span></div></article>})}</div>
      <div className="security-note"><ShieldCheck size={18}/><span>Tokens, App Secrets, chaves privadas e service-role permanecem no armazenamento seguro do backend.</span></div>
    </div>}

    {activeTab==='branding'&&<MasterBrandingPanel/>}

    {activeTab==='audit'&&<div className="master-tab-content">
      <div className="master-section-bar"><div><span className="eyebrow">AUDITORIA</span><h2>Histórico administrativo</h2><p>Veja quando uma decisão importante foi tomada sem misturar com o restante do painel.</p></div></div>
      <div className="panel-card master-audit-full">{activity.length?<div className="master-activity-list">{activity.map(row=><div className="master-activity-row" key={row.id}><span className="activity-dot"/><div><strong>{row.action.replaceAll('_',' ')}</strong><span>{formatDateTime(row.created_at)}</span></div></div>)}</div>:<div className="inline-empty"><Activity size={28}/><strong>Nenhuma ação administrativa recente</strong><span>Alterações Master auditadas aparecerão aqui.</span></div>}</div>
    </div>}
  </section>
}
