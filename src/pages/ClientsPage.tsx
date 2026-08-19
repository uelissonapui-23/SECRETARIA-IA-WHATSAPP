import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ClipboardList, Mail, MessageCircle, Phone, Plus, Search, Sparkles, Trash2, UserRound, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCompany } from '../company/CompanyProvider'
import { supabase } from '../lib/supabase'
import { formatDateTime } from '../lib/format'
import type { Appointment, Contact, OperationalMemory, Task, WorkItem } from '../lib/operationalTypes'

const memoryKinds = [
  { v:'context', l:'Contexto' }, { v:'preference', l:'Preferência' }, { v:'commitment', l:'Compromisso' }, { v:'important', l:'Importante' }, { v:'instruction', l:'Instrução' },
] as const

type ClientDetails = { appointments:Appointment[]; tasks:Task[]; work:WorkItem[]; memories:OperationalMemory[] }


type ClientTimelineItem = { id:string; title:string; meta:string; at:string|null; kind:'Agenda'|'Tarefa'|'Trabalho'; closed:boolean }

function buildClientTimeline(details:ClientDetails):ClientTimelineItem[]{
  const items:ClientTimelineItem[] = [
    ...details.appointments.map(i=>({id:`a-${i.id}`,title:i.title,meta:`Agenda · ${formatDateTime(i.starts_at)}`,at:i.starts_at,kind:'Agenda' as const,closed:i.status==='completed'||i.status==='cancelled'})),
    ...details.tasks.map(i=>({id:`t-${i.id}`,title:i.title,meta:`Tarefa · ${formatDateTime(i.due_at)}`,at:i.due_at??i.created_at,kind:'Tarefa' as const,closed:i.status==='done'})),
    ...details.work.map(i=>({id:`w-${i.id}`,title:i.title,meta:`Trabalho · ${formatDateTime(i.due_at)}`,at:i.due_at??i.created_at,kind:'Trabalho' as const,closed:i.status==='done'||i.status==='cancelled'})),
  ]
  return items.sort((a,b)=>{
    const aTime=a.at?new Date(a.at).getTime():0
    const bTime=b.at?new Date(b.at).getTime():0
    return bTime-aTime
  })
}


export function ClientsPage(){
  const{currentCompany}=useCompany()
  const navigate=useNavigate()
  const[items,setItems]=useState<Contact[]>([])
  const[loading,setLoading]=useState(true)
  const[error,setError]=useState('')
  const[query,setQuery]=useState('')
  const[showForm,setShowForm]=useState(false)
  const[editing,setEditing]=useState<Contact|null>(null)
  const[selected,setSelected]=useState<Contact|null>(null)
  const[details,setDetails]=useState<ClientDetails|null>(null)
  const[detailBusy,setDetailBusy]=useState(false)
  const[name,setName]=useState('');const[phone,setPhone]=useState('');const[email,setEmail]=useState('');const[notes,setNotes]=useState('');const[homeAddress,setHomeAddress]=useState('');const[workAddress,setWorkAddress]=useState('');const[storeAddress,setStoreAddress]=useState('');const[companyName,setCompanyName]=useState('');const[busy,setBusy]=useState(false)
  const[memoryContent,setMemoryContent]=useState('');const[memoryKind,setMemoryKind]=useState<OperationalMemory['kind']>('context');const[memoryBusy,setMemoryBusy]=useState(false)

  const load=useCallback(async()=>{if(!currentCompany)return;setLoading(true);setError('');const{data,error:err}=await supabase.from('contacts').select('*').eq('company_id',currentCompany.id).order('name',{ascending:true,nullsFirst:false});if(err)setError(err.message);else setItems((data??[]) as Contact[]);setLoading(false)},[currentCompany])
  useEffect(()=>{void load()},[load])

  const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return q?items.filter(i=>[i.name,i.phone,i.email,i.notes,i.home_address,i.work_address,i.store_address,i.company_name].some(v=>v?.toLowerCase().includes(q))):items},[items,query])

  function openNew(){setEditing(null);setName('');setPhone('');setEmail('');setNotes('');setHomeAddress('');setWorkAddress('');setStoreAddress('');setCompanyName('');setShowForm(true)}
  function openEdit(i:Contact){setEditing(i);setName(i.name??'');setPhone(i.phone??'');setEmail(i.email??'');setNotes(i.notes??'');setHomeAddress(i.home_address??'');setWorkAddress(i.work_address??'');setStoreAddress(i.store_address??'');setCompanyName(i.company_name??'');setShowForm(true)}

  async function save(e:FormEvent){e.preventDefault();if(!currentCompany)return;setBusy(true);setError('');try{const payload={company_id:currentCompany.id,name:name.trim()||null,phone:phone.trim()||null,email:email.trim()||null,notes:notes.trim()||null,home_address:homeAddress.trim()||null,work_address:workAddress.trim()||null,store_address:storeAddress.trim()||null,company_name:companyName.trim()||null};if(editing){const{error:err}=await supabase.from('contacts').update(payload).eq('id',editing.id).eq('company_id',currentCompany.id);if(err)throw err}else{const{error:err}=await supabase.from('contacts').insert({...payload,whatsapp_id:phone.trim()||`manual:${crypto.randomUUID()}`});if(err)throw err}setShowForm(false);await load()}catch(err){setError(err instanceof Error?err.message:'Não foi possível salvar o cliente.')}finally{setBusy(false)}}

  const loadDetails=useCallback(async(contact:Contact)=>{
    if(!currentCompany)return
    setSelected(contact);setDetailBusy(true);setDetails(null);setError('')
    try{
      const[a,t,w,m]=await Promise.all([
        supabase.from('appointments').select('*').eq('company_id',currentCompany.id).eq('contact_id',contact.id).order('starts_at',{ascending:false}).limit(20),
        supabase.from('tasks').select('*').eq('company_id',currentCompany.id).eq('contact_id',contact.id).order('created_at',{ascending:false}).limit(20),
        supabase.from('work_items').select('*').eq('company_id',currentCompany.id).eq('contact_id',contact.id).order('created_at',{ascending:false}).limit(20),
        supabase.from('operational_memories').select('*').eq('company_id',currentCompany.id).eq('contact_id',contact.id).eq('is_active',true).order('created_at',{ascending:false}),
      ])
      for(const r of[a,t,w,m])if(r.error)throw r.error
      setDetails({appointments:(a.data??[]) as Appointment[],tasks:(t.data??[]) as Task[],work:(w.data??[]) as WorkItem[],memories:(m.data??[]) as OperationalMemory[]})
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar o histórico do cliente.')}finally{setDetailBusy(false)}
  },[currentCompany])

  async function addMemory(e:FormEvent){
    e.preventDefault();if(!currentCompany||!selected||!memoryContent.trim())return
    setMemoryBusy(true);setError('')
    const{error:err}=await supabase.from('operational_memories').insert({company_id:currentCompany.id,contact_id:selected.id,kind:memoryKind,content:memoryContent.trim(),source:'manual',importance:memoryKind==='important'?'high':'normal'})
    setMemoryBusy(false)
    if(err){setError(err.message);return}
    setMemoryContent('');await loadDetails(selected)
  }

  async function removeMemory(memory:OperationalMemory){if(!currentCompany||!selected)return;const{error:err}=await supabase.from('operational_memories').delete().eq('id',memory.id).eq('company_id',currentCompany.id);if(err)setError(err.message);else await loadDetails(selected)}

  return <section>
    <div className="page-heading"><div><span className="eyebrow">CLIENTES</span><h1>Relacionamento leve, contexto forte</h1><p>Dados essenciais, histórico operacional e memória útil sem virar um CRM pesado.</p></div><button className="primary-button action-button" onClick={openNew}><Plus size={17}/>Novo cliente</button></div>
    {error&&<div className="form-error page-message">{error}</div>}
    <div className="toolbar-card"><div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por nome, telefone, e-mail ou anotação"/></div><span className="muted">{filtered.length} cliente(s)</span></div>
    <div className="cards-grid clients-grid">{loading?<div className="panel-card">Carregando...</div>:filtered.length?filtered.map(item=><article className="client-card" key={item.id} onClick={()=>void loadDetails(item)}><div className="client-avatar">{(item.name?.[0]||'?').toUpperCase()}</div><div className="client-content"><strong>{item.name||'Cliente sem nome'}</strong><div className="client-lines">{item.phone&&<span><Phone size={14}/>{item.phone}</span>}{item.email&&<span><Mail size={14}/>{item.email}</span>}{item.whatsapp_id&&<span><MessageCircle size={14}/>Contato identificado</span>}</div>{item.notes&&<p>{item.notes}</p>}<small className="client-open-hint">Abrir histórico e memória</small></div></article>):<div className="big-empty panel-card full-span"><UserRound size={34}/><h3>Nenhum cliente cadastrado</h3><p>Cadastre manualmente agora. Depois, novos contatos também poderão nascer das conversas.</p><button className="primary-button action-button" onClick={openNew}><Plus size={17}/>Cadastrar cliente</button></div>}</div>

    {showForm&&<div className="modal-backdrop" onClick={()=>setShowForm(false)}><form className="modal-card" onClick={e=>e.stopPropagation()} onSubmit={save}><div className="modal-head"><div><span className="eyebrow">CLIENTE</span><h2>{editing?'Editar cliente':'Novo cliente'}</h2></div><button type="button" className="icon-button" onClick={()=>setShowForm(false)}><X size={18}/></button></div><div className="form-stack"><label><span>Nome</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="Nome do cliente"/></label><label><span>Empresa ou loja</span><input value={companyName} onChange={e=>setCompanyName(e.target.value)} placeholder="Nome da empresa ou loja"/></label><div className="form-grid two"><label><span>Telefone</span><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(00) 00000-0000"/></label><label><span>E-mail</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="cliente@email.com"/></label></div><label><span>Endereço de casa</span><input value={homeAddress} onChange={e=>setHomeAddress(e.target.value)} placeholder="Rua, número, bairro e cidade"/></label><label><span>Endereço da loja</span><input value={storeAddress} onChange={e=>setStoreAddress(e.target.value)} placeholder="Rua, número, bairro e cidade"/></label><label><span>Endereço do trabalho</span><input value={workAddress} onChange={e=>setWorkAddress(e.target.value)} placeholder="Rua, número, bairro e cidade"/></label><label><span>Anotações gerais</span><textarea rows={4} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Preferências e observações úteis..."/></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setShowForm(false)}>Cancelar</button><button className="primary-button" disabled={busy}>{busy?'Salvando...':'Salvar cliente'}</button></div></form></div>}

    {selected&&<div className="modal-backdrop" onClick={()=>setSelected(null)}><div className="modal-card client-detail-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">HISTÓRICO DO CLIENTE</span><h2>{selected.name||selected.phone||'Cliente'}</h2><p className="modal-subtitle">Tudo relacionado a este cliente em um só lugar.</p></div><div className="heading-actions"><button className="secondary-button" onClick={()=>{setSelected(null);openEdit(selected)}}>Editar cadastro</button><button className="icon-button" onClick={()=>setSelected(null)}><X size={18}/></button></div></div>
      <div className="client-context-actions"><button className="primary-button" onClick={()=>{const id=selected.id;setSelected(null);navigate(`/agenda?novo=1&cliente=${id}`)}}><CalendarDays size={16}/>Agendar</button><button className="secondary-button" onClick={()=>{const id=selected.id;setSelected(null);navigate(`/trabalho?novo=task&cliente=${id}`)}}><ClipboardList size={16}/>Criar tarefa</button><button className="secondary-button" onClick={()=>{const id=selected.id;setSelected(null);navigate(`/trabalho?novo=work&cliente=${id}&tipo=service`)}}><Plus size={16}/>Criar trabalho</button></div>
      {detailBusy||!details?<div className="loading-block">Carregando histórico...</div>:<div className="client-detail-grid">
        <div className="client-detail-main">
          <div className="client-stats"><div><CalendarDays size={18}/><strong>{details.appointments.length}</strong><span>agenda</span></div><div><ClipboardList size={18}/><strong>{details.tasks.length+details.work.length}</strong><span>trabalho</span></div><div><Sparkles size={18}/><strong>{details.memories.length}</strong><span>memórias</span></div></div>
          <div className="panel-card compact"><div className="panel-head"><div><span className="eyebrow">HISTÓRICO UNIFICADO</span><h3>Últimas atividades</h3><p className="panel-help">Agenda, tarefas e trabalhos aparecem juntos em ordem de data.</p></div></div><div className="compact-list client-timeline">{buildClientTimeline(details).slice(0,16).map(i=><div className={`compact-row client-timeline-row kind-${i.kind.toLowerCase()} ${i.closed?'is-closed':''}`} key={i.id}><div className="list-icon">{i.kind==='Agenda'?<CalendarDays size={15}/>:<ClipboardList size={15}/>}</div><div className="grow"><strong>{i.title}</strong><span>{i.meta}</span></div><span className="mini-status">{i.closed?'Finalizado':i.kind}</span></div>)}{!details.appointments.length&&!details.tasks.length&&!details.work.length&&<div className="inline-empty"><div className="list-icon"><ClipboardList size={17}/></div><div><strong>Sem atividade ainda</strong><span>Agenda e trabalho vinculados aparecerão aqui.</span></div></div>}</div></div>
        </div>
        <aside className="client-memory-panel"><div><span className="eyebrow">MEMÓRIA OPERACIONAL</span><h3>O que vale lembrar</h3><p>Informações úteis para atender este cliente com contexto. Depois a IA poderá alimentar esta área automaticamente.</p></div><form className="memory-form" onSubmit={addMemory}><select value={memoryKind} onChange={e=>setMemoryKind(e.target.value as OperationalMemory['kind'])}>{memoryKinds.map(k=><option key={k.v} value={k.v}>{k.l}</option>)}</select><textarea rows={3} value={memoryContent} onChange={e=>setMemoryContent(e.target.value)} placeholder="Ex.: Prefere contato pela manhã; prometeu retorno sexta..."/><button className="primary-button" disabled={memoryBusy||!memoryContent.trim()}>{memoryBusy?'Salvando...':'Guardar memória'}</button></form><div className="memory-list">{details.memories.map(m=><div className={`memory-item importance-${m.importance}`} key={m.id}><div><span className="mini-status">{memoryKinds.find(k=>k.v===m.kind)?.l}</span><p>{m.content}</p><small>{formatDateTime(m.created_at)}</small></div><button className="icon-button small danger" onClick={()=>void removeMemory(m)}><Trash2 size={14}/></button></div>)}{!details.memories.length&&<div className="notification-empty"><Sparkles size={22}/><strong>Nenhuma memória ainda</strong><span>Guarde apenas o que realmente ajuda no atendimento.</span></div>}</div></aside>
      </div>}
    </div></div>}
  </section>
}
