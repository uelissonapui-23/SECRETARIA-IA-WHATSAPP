import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock3, ListTodo, MessageSquareText, Plus, RefreshCw, Sparkles, UserPlus, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCompany } from '../company/CompanyProvider'
import { supabase } from '../lib/supabase'
import { dateTimeLocalToIso, formatDateTime, isOverdue, toDateTimeLocal } from '../lib/format'
import type { Appointment, Suggestion, Task, WorkItem } from '../lib/operationalTypes'
import { useOperationalAutoRefresh } from '../lib/useOperationalAutoRefresh'

type QuickKind = 'appointment' | 'task' | 'client'

type PriorityItem = {
  id: string
  kind: 'suggestion' | 'overdue' | 'appointment'
  title: string
  text: string
  link: string
}

export function DashboardPage() {
  const { currentCompany } = useCompany()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [quickKind, setQuickKind] = useState<QuickKind | null>(null)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickDate, setQuickDate] = useState('')
  const [quickPhone, setQuickPhone] = useState('')
  const [quickBusy, setQuickBusy] = useState(false)

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
  useOperationalAutoRefresh(currentCompany?.id,load,['appointments','tasks','work_items','ai_suggestions'])

  const overdueItems = useMemo(() => [
    ...tasks.filter((item)=>isOverdue(item.due_at)).map((item)=>({ id:`task-${item.id}`, title:item.title, due:item.due_at })),
    ...workItems.filter((item)=>isOverdue(item.due_at)).map((item)=>({ id:`work-${item.id}`, title:item.title, due:item.due_at })),
  ], [tasks, workItems])
  const overdue = overdueItems.length
  const greeting = new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite'
  const dayLabel = new Intl.DateTimeFormat('pt-BR', { weekday:'long', day:'2-digit', month:'long' }).format(new Date()).toUpperCase()

  const priorities = useMemo<PriorityItem[]>(() => {
    const result: PriorityItem[] = []
    for (const item of overdueItems.slice(0, 3)) result.push({ id:item.id, kind:'overdue', title:item.title, text:`Atrasado${item.due ? ` · ${formatDateTime(item.due)}` : ''}`, link:'/trabalho' })
    for (const item of suggestions.slice(0, Math.max(0, 3-result.length))) result.push({ id:`suggestion-${item.id}`, kind:'suggestion', title:item.title, text:item.summary || item.reason || 'A Secretária encontrou algo para você revisar.', link:'/secretaria' })
    for (const item of appointments.slice(0, Math.max(0, 3-result.length))) result.push({ id:`appointment-${item.id}`, kind:'appointment', title:item.title, text:`Hoje · ${formatDateTime(item.starts_at)}`, link:'/agenda' })
    return result.slice(0,3)
  }, [overdueItems, suggestions, appointments])

  function openQuick(kind: QuickKind) {
    setQuickKind(kind)
    setQuickTitle('')
    setQuickPhone('')
    setQuickDate(kind === 'appointment' ? toDateTimeLocal(new Date(Date.now()+3_600_000).toISOString()) : '')
    setError('')
    setMessage('')
  }

  async function completeAppointment(id: string) {
    if (!currentCompany) return
    setError(''); setMessage('')
    const { error: err } = await supabase.from('appointments').update({ status: 'completed' }).eq('id', id).eq('company_id', currentCompany.id)
    if (err) setError(err.message)
    else { setMessage('Compromisso concluído.'); await load() }
  }

  async function completePending(kind: 'task' | 'work', id: string) {
    if (!currentCompany) return
    setError(''); setMessage('')
    const table = kind === 'task' ? 'tasks' : 'work_items'
    const { error: err } = await supabase.from(table).update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', id).eq('company_id', currentCompany.id)
    if (err) setError(err.message)
    else { setMessage(kind === 'task' ? 'Tarefa concluída.' : 'Trabalho concluído.'); await load() }
  }

  async function saveQuick(event: FormEvent) {
    event.preventDefault()
    if (!currentCompany || !quickKind || !quickTitle.trim()) return
    setQuickBusy(true); setError(''); setMessage('')
    try {
      if (quickKind === 'appointment') {
        if (!quickDate) throw new Error('Escolha a data e o horário do compromisso.')
        const { error: err } = await supabase.from('appointments').insert({
          company_id: currentCompany.id,
          contact_id: null,
          suggestion_id: null,
          title: quickTitle.trim(),
          starts_at: dateTimeLocalToIso(quickDate),
          ends_at: null,
          address: null,
          notes: null,
          status: 'scheduled',
          kind: 'appointment',
          reminder_minutes: 60,
        })
        if (err) throw err
        setMessage('Compromisso criado. Ele já está na Agenda.')
      } else if (quickKind === 'task') {
        const { error: err } = await supabase.from('tasks').insert({
          company_id: currentCompany.id,
          contact_id: null,
          suggestion_id: null,
          title: quickTitle.trim(),
          description: null,
          due_at: quickDate ? dateTimeLocalToIso(quickDate) : null,
          status: 'open',
          priority: 'normal',
        })
        if (err) throw err
        setMessage('Tarefa criada. Ela já está em Trabalho.')
      } else {
        const phone = quickPhone.trim()
        const { error: err } = await supabase.from('contacts').insert({
          company_id: currentCompany.id,
          name: quickTitle.trim(),
          phone: phone || null,
          email: null,
          notes: null,
          whatsapp_id: phone || `manual:${crypto.randomUUID()}`,
        })
        if (err) throw err
        setMessage('Cliente criado. O cadastro já está em Clientes.')
      }
      setQuickKind(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally { setQuickBusy(false) }
  }

  return <section>
    <div className="page-heading dashboard-heading"><div><span className="eyebrow">{dayLabel}</span><h1>{greeting} 👋</h1><p>Veja o que importa e resolva o básico sem procurar em várias telas.</p></div><button className="secondary-button" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/>{loading?'Atualizando...':'Atualizar'}</button></div>
    {error && <div className="form-error page-message">{error}</div>}
    {message && <div className="form-success page-message">{message}</div>}

    <div className="start-here-card">
      <div className="start-here-copy"><span className="eyebrow">COMECE POR AQUI</span><h2>O que você quer fazer?</h2><p>As ações mais usadas ficam sempre à mão.</p></div>
      <div className="quick-action-grid">
        <button onClick={()=>openQuick('appointment')}><span className="quick-action-icon aqua"><CalendarDays size={20}/></span><span><strong>Novo compromisso</strong><small>Colocar na agenda</small></span></button>
        <button onClick={()=>openQuick('task')}><span className="quick-action-icon blue"><ListTodo size={20}/></span><span><strong>Nova tarefa</strong><small>Não esquecer depois</small></span></button>
        <button onClick={()=>openQuick('client')}><span className="quick-action-icon coral"><UserPlus size={20}/></span><span><strong>Novo cliente</strong><small>Salvar contato</small></span></button>
        <Link to="/secretaria"><span className="quick-action-icon yellow"><Sparkles size={20}/></span><span><strong>Ver Secretária</strong><small>Revisar sugestões</small></span></Link>
      </div>
    </div>

    <div className="summary-grid four">
      <Link to="/agenda" className="summary-card summary-link"><span>Hoje</span><strong>{appointments.length}</strong><small>compromissos</small></Link>
      <Link to="/secretaria" className="summary-card summary-link"><span>Atenção</span><strong>{suggestions.length}</strong><small>sugestões da Secretária</small></Link>
      <Link to="/trabalho" className="summary-card summary-link"><span>Pendências</span><strong>{tasks.length + workItems.length}</strong><small>itens em aberto</small></Link>
      <Link to="/trabalho" className={`summary-card summary-link ${overdue ? 'summary-alert' : ''}`}><span>Atrasados</span><strong>{overdue}</strong><small>{overdue ? 'precisam de ação' : 'tudo em dia'}</small></Link>
    </div>

    <div className="day-brief-card">
      <div className="day-brief-icon"><CheckCircle2 size={22}/></div>
      <div className="day-brief-copy"><span className="eyebrow">SEU DIA EM 30 SEGUNDOS</span><h2>{overdue ? `Você tem ${overdue} item(ns) atrasado(s) para resolver primeiro.` : suggestions.length ? `Há ${suggestions.length} sugestão(ões) esperando sua confirmação.` : appointments.length ? `Você tem ${appointments.length} compromisso(s) hoje e nenhuma urgência registrada.` : 'Seu dia está leve e sem urgências registradas.'}</h2><p>{tasks.length + workItems.length ? `Depois disso, há ${tasks.length + workItems.length} pendência(s) em Trabalho.` : 'Não há pendências em Trabalho neste momento.'}</p></div>
      <Link className="secondary-button day-brief-action" to={overdue?'/trabalho':suggestions.length?'/secretaria':appointments.length?'/agenda':'/trabalho'}>Ver o que fazer</Link>
    </div>

    <div className="focus-panel panel-card">
      <div className="panel-head"><div><span className="eyebrow">PRIORIDADE AGORA</span><h2>{priorities.length ? 'Comece por estes itens' : 'Tudo sob controle'}</h2></div></div>
      {priorities.length ? <div className="focus-list">{priorities.map((item)=><Link to={item.link} className={`focus-item ${item.kind}`} key={item.id}><span className="focus-rank">{item.kind==='overdue'?<Clock3 size={17}/>:item.kind==='suggestion'?<Sparkles size={17}/>:<CalendarDays size={17}/>}</span><span className="grow"><strong>{item.title}</strong><small>{item.text}</small></span><span className="focus-open">Abrir</span></Link>)}</div> : <div className="inline-empty"><div className="list-icon"><CheckCircle2 size={20}/></div><div><strong>Nenhuma urgência agora</strong><span>Você pode seguir o dia normalmente.</span></div></div>}
    </div>

    <div className="dashboard-columns">
      <div className="panel-card">
        <div className="panel-head"><div><span className="eyebrow">HOJE</span><h2>Próximos compromissos</h2></div><Link to="/agenda">Ver agenda</Link></div>
        {appointments.length ? <div className="compact-list">{appointments.slice(0,5).map((item)=><div className="compact-row dashboard-action-row" key={item.id}><div className="list-icon"><CalendarDays size={17}/></div><div className="grow"><strong>{item.title}</strong><span>{formatDateTime(item.starts_at)}{item.address ? ` · ${item.address}` : ''}</span></div><span className="mini-status">{item.kind === 'visit' ? 'Visita' : 'Agenda'}</span><button className="compact-action-button" onClick={()=>void completeAppointment(item.id)} title="Concluir compromisso"><CheckCircle2 size={15}/>Concluir</button></div>)}</div> : <Empty icon={<CalendarDays size={22}/>} title="Nenhum compromisso hoje" text="Crie um compromisso acima quando precisar."/>}
      </div>

      <div className="panel-card">
        <div className="panel-head"><div><span className="eyebrow">SECRETÁRIA</span><h2>Precisa da sua atenção</h2></div><Link to="/secretaria">Abrir central</Link></div>
        {suggestions.length ? <div className="compact-list">{suggestions.slice(0,5).map((item)=><div className="compact-row" key={item.id}><div className="list-icon"><Sparkles size={17}/></div><div className="grow"><strong>{item.title}</strong><span>{item.summary || item.reason || 'Sugestão identificada na conversa.'}</span></div>{item.confidence != null && <span className="mini-status">{Math.round(item.confidence*100)}%</span>}</div>)}</div> : <Empty icon={<MessageSquareText size={22}/>} title="Nada novo para confirmar" text="Quando a Secretária encontrar algo importante, aparece aqui."/>}
      </div>
    </div>

    <div className="panel-card dashboard-bottom">
      <div className="panel-head"><div><span className="eyebrow">PENDÊNCIAS</span><h2>O que ainda está aberto</h2></div><Link to="/trabalho">Organizar trabalho</Link></div>
      {(tasks.length || workItems.length) ? <div className="compact-list">{[...tasks.map((item)=>({id:item.id,title:item.title,due:item.due_at,kind:'Tarefa',source:'task' as const})),...workItems.map((item)=>({id:item.id,title:item.title,due:item.due_at,kind:'Trabalho',source:'work' as const}))].sort((a,b)=>(a.due?new Date(a.due).getTime():Infinity)-(b.due?new Date(b.due).getTime():Infinity)).slice(0,6).map((item)=><div className="compact-row dashboard-action-row" key={`${item.kind}-${item.id}`}><div className={`list-icon ${isOverdue(item.due)?'danger':''}`}>{isOverdue(item.due)?<Clock3 size={17}/>:<CheckCircle2 size={17}/>}</div><div className="grow"><strong>{item.title}</strong><span>{formatDateTime(item.due)}</span></div><span className="mini-status">{item.kind}</span><button className="compact-action-button" onClick={()=>void completePending(item.source,item.id)}><CheckCircle2 size={15}/>Concluir</button></div>)}</div> : <Empty icon={<CheckCircle2 size={22}/>} title="Sem pendências" text="Você não tem tarefas ou trabalhos em aberto."/>}
    </div>

    {quickKind && <div className="modal-backdrop" onClick={()=>setQuickKind(null)}><form className="modal-card quick-create-modal" onClick={e=>e.stopPropagation()} onSubmit={saveQuick}>
      <div className="modal-head"><div><span className="eyebrow">CADASTRO RÁPIDO</span><h2>{quickKind==='appointment'?'Novo compromisso':quickKind==='task'?'Nova tarefa':'Novo cliente'}</h2></div><button type="button" className="icon-button" onClick={()=>setQuickKind(null)}><X size={18}/></button></div>
      <p className="quick-create-help">Preencha só o essencial agora. Você pode completar os detalhes depois.</p>
      <div className="form-stack">
        <label><span>{quickKind==='client'?'Nome do cliente':'Título'}</span><input autoFocus required value={quickTitle} onChange={e=>setQuickTitle(e.target.value)} placeholder={quickKind==='appointment'?'Ex.: Reunião com João':quickKind==='task'?'Ex.: Enviar orçamento':'Ex.: João Silva'}/></label>
        {quickKind==='appointment'&&<label><span>Data e horário</span><input required type="datetime-local" value={quickDate} onChange={e=>setQuickDate(e.target.value)}/></label>}
        {quickKind==='task'&&<label><span>Prazo · opcional</span><input type="datetime-local" value={quickDate} onChange={e=>setQuickDate(e.target.value)}/></label>}
        {quickKind==='client'&&<label><span>Telefone · opcional</span><input value={quickPhone} onChange={e=>setQuickPhone(e.target.value)} placeholder="(00) 00000-0000"/></label>}
      </div>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setQuickKind(null)}>Cancelar</button><button className="primary-button" disabled={quickBusy}><Plus size={16}/>{quickBusy?'Salvando...':'Criar agora'}</button></div>
    </form></div>}
  </section>
}

function Empty({icon,title,text}:{icon:React.ReactNode,title:string,text:string}) { return <div className="inline-empty"><div className="list-icon">{icon}</div><div><strong>{title}</strong><span>{text}</span></div></div> }
