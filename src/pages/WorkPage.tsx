import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, CircleDollarSign, ClipboardList, Clock3, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useCompany } from '../company/CompanyProvider'
import { supabase } from '../lib/supabase'
import { dateTimeLocalToIso, formatDateTime, formatMoney, isOverdue, toDateTimeLocal } from '../lib/format'
import type { Contact, Task, WorkItem } from '../lib/operationalTypes'

const workTypes = [
  { v:'order', l:'Pedido' }, { v:'service', l:'Serviço' }, { v:'quote', l:'Orçamento' }, { v:'payment', l:'Pagamento' },
  { v:'follow_up', l:'Retorno' }, { v:'deadline', l:'Prazo' }, { v:'awaiting_reply', l:'Aguardando cliente' },
] as const
const priorities = [{v:'low',l:'Baixa'},{v:'normal',l:'Normal'},{v:'high',l:'Alta'},{v:'urgent',l:'Urgente'}]
const statusOptions = [{v:'open',l:'Aberto'},{v:'in_progress',l:'Em andamento'},{v:'waiting',l:'Aguardando'},{v:'done',l:'Concluído'},{v:'cancelled',l:'Cancelado'}]

type Tab = 'all'|'tasks'|'work'|'history'

type Editing = { kind:'task'; item:Task } | { kind:'work'; item:WorkItem } | null

export function WorkPage() {
  const { currentCompany } = useCompany()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tasks,setTasks]=useState<Task[]>([])
  const [work,setWork]=useState<WorkItem[]>([])
  const [contacts,setContacts]=useState<Contact[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [tab,setTab]=useState<Tab>('all')
  const [showForm,setShowForm]=useState(false)
  const [formKind,setFormKind]=useState<'task'|'work'>('task')
  const [editing,setEditing]=useState<Editing>(null)
  const [title,setTitle]=useState('')
  const [description,setDescription]=useState('')
  const [due,setDue]=useState('')
  const [priority,setPriority]=useState('normal')
  const [contactId,setContactId]=useState('')
  const [workType,setWorkType]=useState<WorkItem['type']>('service')
  const [amount,setAmount]=useState('')
  const [status,setStatus]=useState<WorkItem['status']>('open')
  const [busy,setBusy]=useState(false)
  const [query,setQuery]=useState('')

  const load=useCallback(async()=>{
    if(!currentCompany)return
    setLoading(true);setError('')
    try{
      const[t,w,c]=await Promise.all([
        supabase.from('tasks').select('*').eq('company_id',currentCompany.id).order('created_at',{ascending:false}),
        supabase.from('work_items').select('*').eq('company_id',currentCompany.id).order('created_at',{ascending:false}),
        supabase.from('contacts').select('*').eq('company_id',currentCompany.id).order('name'),
      ])
      if(t.error)throw t.error;if(w.error)throw w.error;if(c.error)throw c.error
      setTasks((t.data??[]) as Task[]);setWork((w.data??[]) as WorkItem[]);setContacts((c.data??[]) as Contact[])
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar o trabalho.')}finally{setLoading(false)}
  },[currentCompany])
  useEffect(()=>{void load()},[load])

  const openItems=useMemo(()=>[...tasks.filter(t=>t.status!=='done'),...work.filter(w=>w.status!=='done'&&w.status!=='cancelled')],[tasks,work])
  const overdue=openItems.filter(i=>isOverdue(i.due_at)).length

  function resetForm(kind:'task'|'work', presetContactId = '', presetType: WorkItem['type'] = 'service') {
    setFormKind(kind);setEditing(null);setTitle('');setDescription('');setDue('');setPriority('normal');setContactId(presetContactId);setWorkType(presetType);setAmount('');setStatus('open');setShowForm(true)
  }
  useEffect(()=>{
    const novo=searchParams.get('novo')
    if(novo!=='task'&&novo!=='work')return
    const requestedType=(searchParams.get('tipo')||'service') as WorkItem['type']
    resetForm(novo, searchParams.get('cliente')??'', requestedType)
    setSearchParams({}, {replace:true})
  },[searchParams,setSearchParams])
  function openEditTask(item:Task) {
    setFormKind('task');setEditing({kind:'task',item});setTitle(item.title);setDescription(item.description??'');setDue(toDateTimeLocal(item.due_at));setPriority(item.priority??'normal');setContactId(item.contact_id??'');setAmount('');setStatus(item.status==='done'?'done':'open');setShowForm(true)
  }
  function openEditWork(item:WorkItem) {
    setFormKind('work');setEditing({kind:'work',item});setTitle(item.title);setDescription(item.description??'');setDue(toDateTimeLocal(item.due_at));setPriority(item.priority);setContactId(item.contact_id??'');setWorkType(item.type);setAmount(item.amount==null?'':String(item.amount).replace('.',','));setStatus(item.status);setShowForm(true)
  }

  async function save(e:FormEvent){
    e.preventDefault();if(!currentCompany)return
    setBusy(true);setError('')
    try{
      if(formKind==='task'){
        const payload={company_id:currentCompany.id,title:title.trim(),description:description.trim()||null,due_at:dateTimeLocalToIso(due),priority,contact_id:contactId||null,status: status==='done'?'done':'open'}
        const result=editing?.kind==='task' ? await supabase.from('tasks').update(payload).eq('id',editing.item.id).eq('company_id',currentCompany.id) : await supabase.from('tasks').insert(payload)
        if(result.error)throw result.error
      }else{
        const payload={company_id:currentCompany.id,title:title.trim(),description:description.trim()||null,due_at:dateTimeLocalToIso(due),priority,contact_id:contactId||null,type:workType,amount:amount?Number(amount.replace(',','.')):null,status}
        const result=editing?.kind==='work' ? await supabase.from('work_items').update(payload).eq('id',editing.item.id).eq('company_id',currentCompany.id) : await supabase.from('work_items').insert(payload)
        if(result.error)throw result.error
      }
      setShowForm(false);await load()
    }catch(err){setError(err instanceof Error?err.message:'Não foi possível salvar.')}finally{setBusy(false)}
  }

  async function complete(kind:'task'|'work',id:string){
    if(!currentCompany)return
    const table=kind==='task'?'tasks':'work_items'
    const{error:err}=await supabase.from(table).update({status:'done',completed_at:new Date().toISOString()}).eq('id',id).eq('company_id',currentCompany.id)
    if(err)setError(err.message);else await load()
  }
  async function postponeOneDay(kind:'task'|'work', id:string, dueAt?:string|null){
    if(!currentCompany)return
    const table=kind==='task'?'tasks':'work_items'
    const base=dueAt?new Date(dueAt):new Date()
    if(Number.isNaN(base.getTime())) base.setTime(Date.now())
    base.setDate(base.getDate()+1)
    const{error:err}=await supabase.from(table).update({due_at:base.toISOString()}).eq('id',id).eq('company_id',currentCompany.id)
    if(err)setError(err.message);else await load()
  }
  async function remove(kind:'task'|'work', id:string){
    if(!currentCompany||!confirm('Excluir este item definitivamente?'))return
    const table=kind==='task'?'tasks':'work_items'
    const{error:err}=await supabase.from(table).delete().eq('id',id).eq('company_id',currentCompany.id)
    if(err)setError(err.message);else await load()
  }

  const q=query.toLowerCase()
  const showHistory=tab==='history'
  const visibleTasks=tasks.filter(t=>{
    const history=t.status==='done'
    return (showHistory?history:!history) && (tab==='all'||tab==='tasks'||showHistory) && (!q||`${t.title} ${t.description??''}`.toLowerCase().includes(q))
  })
  const visibleWork=work.filter(w=>{
    const history=['done','cancelled'].includes(w.status)
    return (showHistory?history:!history) && (tab==='all'||tab==='work'||showHistory) && (!q||`${w.title} ${w.description??''}`.toLowerCase().includes(q))
  })
  const contactName=(id:string|null)=>contacts.find(c=>c.id===id)?.name

  return <section>
    <div className="page-heading"><div><span className="eyebrow">TRABALHO</span><h1>Pendências em um só lugar</h1><p>Tarefas, serviços, pedidos, orçamentos, pagamentos, prazos e retornos com histórico completo.</p></div><div className="heading-actions"><button className="secondary-button" onClick={()=>resetForm('task')}><Plus size={16}/>Tarefa</button><button className="primary-button action-button" onClick={()=>resetForm('work')}><Plus size={16}/>Trabalho</button></div></div>
    {error&&<div className="form-error page-message">{error}</div>}
    <div className="summary-grid three compact-summary"><div className="summary-card"><span>Em aberto</span><strong>{openItems.length}</strong><small>itens</small></div><div className={`summary-card ${overdue?'summary-alert':''}`}><span>Atrasados</span><strong>{overdue}</strong><small>precisam de atenção</small></div><div className="summary-card"><span>Orçamentos</span><strong>{work.filter(w=>w.type==='quote'&&!['done','cancelled'].includes(w.status)).length}</strong><small>em acompanhamento</small></div></div>
    <div className="toolbar-card work-toolbar"><div className="segment-control"><button className={tab==='all'?'active':''} onClick={()=>setTab('all')}>Todos</button><button className={tab==='tasks'?'active':''} onClick={()=>setTab('tasks')}>Tarefas</button><button className={tab==='work'?'active':''} onClick={()=>setTab('work')}>Pedidos e serviços</button><button className={tab==='history'?'active':''} onClick={()=>setTab('history')}>Histórico</button></div><div className="search-box small-search"><Search size={16}/><input placeholder="Buscar" value={query} onChange={e=>setQuery(e.target.value)}/></div></div>
    <div className="panel-card no-pad">{loading?<div className="loading-block">Carregando...</div>:visibleTasks.length+visibleWork.length?<div className="record-list">
      {visibleTasks.map(i=><WorkRow key={`t-${i.id}`} title={i.title} detail={i.description} due={i.due_at} priority={i.priority??'normal'} kind="Tarefa" contact={contactName(i.contact_id)} status={i.status} onComplete={()=>void complete('task',i.id)} onPostpone={()=>void postponeOneDay('task',i.id,i.due_at)} onEdit={()=>openEditTask(i)} onDelete={()=>void remove('task',i.id)}/>) }
      {visibleWork.map(i=><WorkRow key={`w-${i.id}`} title={i.title} detail={i.description} due={i.due_at} priority={i.priority} kind={workTypes.find(t=>t.v===i.type)?.l??i.type} contact={contactName(i.contact_id)} amount={formatMoney(i.amount)} status={i.status} onComplete={()=>void complete('work',i.id)} onPostpone={()=>void postponeOneDay('work',i.id,i.due_at)} onEdit={()=>openEditWork(i)} onDelete={()=>void remove('work',i.id)}/>) }
    </div>:<div className="big-empty"><ClipboardList size={34}/><h3>Nada pendente nesta visão</h3><p>{showHistory?'Itens concluídos e cancelados aparecem aqui.':'Crie uma tarefa ou trabalho. A Secretária também poderá alimentar esta lista a partir das conversas.'}</p></div>}</div>

    {showForm&&<div className="modal-backdrop" onClick={()=>setShowForm(false)}><form className="modal-card" onClick={e=>e.stopPropagation()} onSubmit={save}><div className="modal-head"><div><span className="eyebrow">{editing?'EDITAR':'NOVO'}</span><h2>{formKind==='task'?(editing?'Editar tarefa':'Nova tarefa'):(editing?'Editar trabalho':'Novo trabalho')}</h2></div><button type="button" className="icon-button" onClick={()=>setShowForm(false)}><X size={18}/></button></div><div className="form-stack"><label><span>Título</span><input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="O que precisa ser feito?"/></label>{formKind==='work'&&<div className="form-grid two"><label><span>Tipo</span><select value={workType} onChange={e=>setWorkType(e.target.value as WorkItem['type'])}>{workTypes.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}</select></label><label><span>Valor · opcional</span><input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0,00"/></label></div>}<div className="form-grid two"><label><span>Prazo</span><input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></label><label><span>Prioridade</span><select value={priority} onChange={e=>setPriority(e.target.value)}>{priorities.map(p=><option key={p.v} value={p.v}>{p.l}</option>)}</select></label></div>{formKind==='work'&&editing&&<label><span>Status</span><select value={status} onChange={e=>setStatus(e.target.value as WorkItem['status'])}>{statusOptions.map(s=><option key={s.v} value={s.v}>{s.l}</option>)}</select></label>}<label><span>Cliente · opcional</span><select value={contactId} onChange={e=>setContactId(e.target.value)}><option value="">Sem cliente</option>{contacts.map(c=><option key={c.id} value={c.id}>{c.name||c.phone||'Cliente sem nome'}</option>)}</select></label><label><span>Detalhes</span><textarea rows={4} value={description} onChange={e=>setDescription(e.target.value)}/></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setShowForm(false)}>Cancelar</button><button className="primary-button" disabled={busy}>{busy?'Salvando...':'Salvar'}</button></div></form></div>}
  </section>
}

function WorkRow({title,detail,due,priority,kind,contact,amount,status,onComplete,onPostpone,onEdit,onDelete}:{title:string,detail?:string|null,due?:string|null,priority:string,kind:string,contact?:string|null,amount?:string|null,status:string,onComplete:()=>void,onPostpone:()=>void,onEdit:()=>void,onDelete:()=>void}){
  const closed=status==='done'||status==='cancelled'
  return <article className={`record-row work-row status-${status}`}><div className={`list-icon ${isOverdue(due)&&!closed?'danger':''}`}>{isOverdue(due)&&!closed?<Clock3 size={18}/>:amount?<CircleDollarSign size={18}/>:<ClipboardList size={18}/>}</div><div className="record-main"><div className="record-title"><strong>{title}</strong><div className="record-badges"><span className={`mini-status priority-${priority}`}>{priority==='urgent'?'Urgente':priority==='high'?'Alta':kind}</span>{amount&&<span className="mini-status">{amount}</span>}{closed&&<span className="mini-status">{status==='done'?'Concluído':'Cancelado'}</span>}</div></div><div className="record-meta"><span>{formatDateTime(due)}</span>{contact&&<span>{contact}</span>}<span>{kind}</span></div>{detail&&<p>{detail}</p>}</div><div className="row-actions"><button className="secondary-button" onClick={onEdit}><Pencil size={15}/>Editar</button>{!closed&&<><button className="secondary-button" onClick={onPostpone}><Clock3 size={15}/>Amanhã</button><button className="secondary-button quick-success" onClick={onComplete}><Check size={16}/>Concluir</button></>}<button className="icon-button small danger" onClick={onDelete} title="Excluir"><Trash2 size={16}/></button></div></article>
}
