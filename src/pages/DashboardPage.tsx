import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock3, MessageSquareText, RefreshCw, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCompany } from '../company/CompanyProvider'
import { supabase } from '../lib/supabase'
import { formatDateTime, isOverdue } from '../lib/format'
import type { Appointment, Suggestion, Task, WorkItem } from '../lib/operationalTypes'

export function DashboardPage() {
  const { currentCompany } = useCompany()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!currentCompany) return
    setLoading(true); setError('')
    const now = new Date()
    const start = new Date(now); start.setHours(0,0,0,0)
    const end = new Date(now); end.setHours(23,59,59,999)
    try {
      const [appointmentResult, taskResult, workResult, suggestionResult] = await Promise.all([
        supabase.from('appointments').select('*').eq('company_id', currentCompany.id).gte('starts_at', start.toISOString()).lte('starts_at', end.toISOString()).neq('status','cancelled').order('starts_at'),
        supabase.from('tasks').select('*').eq('company_id', currentCompany.id).neq('status','done').order('due_at', { ascending:true, nullsFirst:false }).limit(12),
        supabase.from('work_items').select('*').eq('company_id', currentCompany.id).in('status',['open','in_progress','waiting']).order('due_at', { ascending:true, nullsFirst:false }).limit(12),
        supabase.from('ai_suggestions').select('*').eq('company_id', currentCompany.id).eq('status','pending').order('created_at', { ascending:false }).limit(8),
      ])
      for (const result of [appointmentResult, taskResult, workResult, suggestionResult]) if (result.error) throw result.error
      setAppointments((appointmentResult.data ?? []) as Appointment[])
      setTasks((taskResult.data ?? []) as Task[])
      setWorkItems((workResult.data ?? []) as WorkItem[])
      setSuggestions((suggestionResult.data ?? []) as Suggestion[])
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível carregar a visão do dia.') }
    finally { setLoading(false) }
  }, [currentCompany])

  useEffect(() => { void load() }, [load])

  const overdue = useMemo(() => tasks.filter((item)=>isOverdue(item.due_at)).length + workItems.filter((item)=>isOverdue(item.due_at)).length, [tasks, workItems])
  const greeting = new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite'
  const dayLabel = new Intl.DateTimeFormat('pt-BR', { weekday:'long', day:'2-digit', month:'long' }).format(new Date()).toUpperCase()

  return <section>
    <div className="page-heading dashboard-heading"><div><span className="eyebrow">{dayLabel}</span><h1>{greeting} 👋</h1><p>Uma visão rápida do que merece sua atenção agora.</p></div><button className="secondary-button" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/>{loading?'Atualizando...':'Atualizar'}</button></div>
    {error && <div className="form-error page-message">{error}</div>}
    <div className="summary-grid four">
      <Link to="/agenda" className="summary-card summary-link"><span>Hoje</span><strong>{appointments.length}</strong><small>compromissos</small></Link>
      <Link to="/secretaria" className="summary-card summary-link"><span>Atenção</span><strong>{suggestions.length}</strong><small>sugestões da Secretária</small></Link>
      <Link to="/trabalho" className="summary-card summary-link"><span>Pendências</span><strong>{tasks.length + workItems.length}</strong><small>itens em aberto</small></Link>
      <Link to="/trabalho" className={`summary-card summary-link ${overdue ? 'summary-alert' : ''}`}><span>Atrasados</span><strong>{overdue}</strong><small>{overdue ? 'precisam de ação' : 'tudo em dia'}</small></Link>
    </div>

    <div className="dashboard-columns">
      <div className="panel-card">
        <div className="panel-head"><div><span className="eyebrow">HOJE</span><h2>Próximos compromissos</h2></div><Link to="/agenda">Ver agenda</Link></div>
        {appointments.length ? <div className="compact-list">{appointments.slice(0,5).map((item)=><div className="compact-row" key={item.id}><div className="list-icon"><CalendarDays size={17}/></div><div className="grow"><strong>{item.title}</strong><span>{formatDateTime(item.starts_at)}{item.address ? ` · ${item.address}` : ''}</span></div><span className="mini-status">{item.kind === 'visit' ? 'Visita' : 'Agenda'}</span></div>)}</div> : <Empty icon={<CalendarDays size={22}/>} title="Nenhum compromisso hoje" text="Quando houver agendamentos, eles aparecem aqui."/>}
      </div>

      <div className="panel-card">
        <div className="panel-head"><div><span className="eyebrow">SECRETÁRIA</span><h2>Precisa da sua atenção</h2></div><Link to="/secretaria">Abrir central</Link></div>
        {suggestions.length ? <div className="compact-list">{suggestions.slice(0,5).map((item)=><div className="compact-row" key={item.id}><div className="list-icon"><Sparkles size={17}/></div><div className="grow"><strong>{item.title}</strong><span>{item.summary || item.reason || 'Sugestão identificada na conversa.'}</span></div>{item.confidence != null && <span className="mini-status">{Math.round(item.confidence*100)}%</span>}</div>)}</div> : <Empty icon={<MessageSquareText size={22}/>} title="Nada novo para confirmar" text="A central ficará pronta para receber sugestões assim que o fluxo de mensagens estiver ativo."/>}
      </div>
    </div>

    <div className="panel-card dashboard-bottom">
      <div className="panel-head"><div><span className="eyebrow">PENDÊNCIAS</span><h2>O que ainda está aberto</h2></div><Link to="/trabalho">Organizar trabalho</Link></div>
      {(tasks.length || workItems.length) ? <div className="compact-list">{[...tasks.map((item)=>({id:item.id,title:item.title,due:item.due_at,kind:'Tarefa'})),...workItems.map((item)=>({id:item.id,title:item.title,due:item.due_at,kind:'Trabalho'}))].sort((a,b)=>(a.due?new Date(a.due).getTime():Infinity)-(b.due?new Date(b.due).getTime():Infinity)).slice(0,6).map((item)=><div className="compact-row" key={`${item.kind}-${item.id}`}><div className={`list-icon ${isOverdue(item.due)?'danger':''}`}>{isOverdue(item.due)?<Clock3 size={17}/>:<CheckCircle2 size={17}/>}</div><div className="grow"><strong>{item.title}</strong><span>{formatDateTime(item.due)}</span></div><span className="mini-status">{item.kind}</span></div>)}</div> : <Empty icon={<CheckCircle2 size={22}/>} title="Sem pendências" text="Você não tem tarefas ou trabalhos em aberto."/>}
    </div>
  </section>
}

function Empty({icon,title,text}:{icon:React.ReactNode,title:string,text:string}) { return <div className="inline-empty"><div className="list-icon">{icon}</div><div><strong>{title}</strong><span>{text}</span></div></div> }
