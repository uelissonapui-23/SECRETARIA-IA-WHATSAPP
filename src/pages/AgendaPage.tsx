import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarCheck2, CalendarDays, Check, Clock3, History, MapPin, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { useCompany } from '../company/CompanyProvider'
import { supabase } from '../lib/supabase'
import { dateTimeLocalToIso, formatDateTime, toDateTimeLocal } from '../lib/format'
import type { Appointment, Contact } from '../lib/operationalTypes'

const kinds = [
  { v: 'appointment', l: 'Agendamento' },
  { v: 'visit', l: 'Visita' },
  { v: 'delivery', l: 'Entrega' },
  { v: 'meeting', l: 'Reunião' },
  { v: 'other', l: 'Outro' },
]
const reminders = [
  { v: 0, l: 'Sem lembrete' },
  { v: 15, l: '15 min antes' },
  { v: 30, l: '30 min antes' },
  { v: 60, l: '1 hora antes' },
  { v: 120, l: '2 horas antes' },
  { v: 1440, l: '1 dia antes' },
]

type View = 'upcoming' | 'history'

export function AgendaPage() {
  const { currentCompany } = useCompany()
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<Appointment[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState<View>('upcoming')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [title, setTitle] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [contactId, setContactId] = useState('')
  const [kind, setKind] = useState('appointment')
  const [reminderMinutes, setReminderMinutes] = useState(60)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!currentCompany) return
    setLoading(true)
    setError('')
    try {
      const [a, c] = await Promise.all([
        supabase.from('appointments').select('*').eq('company_id', currentCompany.id).order('starts_at', { ascending: true }),
        supabase.from('contacts').select('*').eq('company_id', currentCompany.id).order('name'),
      ])
      if (a.error) throw a.error
      if (c.error) throw c.error
      setItems((a.data ?? []) as Appointment[])
      setContacts((c.data ?? []) as Contact[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar a agenda.')
    } finally {
      setLoading(false)
    }
  }, [currentCompany])

  useEffect(() => { void load() }, [load])

  const upcoming = useMemo(() => items.filter((i) => i.status === 'scheduled' && new Date(i.starts_at).getTime() >= Date.now() - 86_400_000), [items])
  const history = useMemo(() => items.filter((i) => i.status !== 'scheduled' || new Date(i.starts_at).getTime() < Date.now() - 86_400_000).sort((a,b)=>new Date(b.starts_at).getTime()-new Date(a.starts_at).getTime()), [items])
  const visible = view === 'upcoming' ? upcoming : history

  function openNew(presetContactId = '') {
    setEditing(null)
    setTitle('')
    setStartsAt(toDateTimeLocal(new Date(Date.now() + 3_600_000).toISOString()))
    setEndsAt('')
    setAddress('')
    setNotes('')
    setContactId(presetContactId)
    setKind('appointment')
    setReminderMinutes(60)
    setShowForm(true)
  }

  useEffect(() => {
    if (searchParams.get('novo') !== '1') return
    openNew(searchParams.get('cliente') ?? '')
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  function openEdit(item: Appointment) {
    setEditing(item)
    setTitle(item.title)
    setStartsAt(toDateTimeLocal(item.starts_at))
    setEndsAt(toDateTimeLocal(item.ends_at))
    setAddress(item.address ?? '')
    setNotes(item.notes ?? '')
    setContactId(item.contact_id ?? '')
    setKind(item.kind ?? 'appointment')
    setReminderMinutes(item.reminder_minutes ?? 60)
    setShowForm(true)
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!currentCompany) return
    setBusy(true)
    setError('')
    try {
      const payload = {
        company_id: currentCompany.id,
        title: title.trim(),
        starts_at: dateTimeLocalToIso(startsAt),
        ends_at: dateTimeLocalToIso(endsAt),
        address: address.trim() || null,
        notes: notes.trim() || null,
        contact_id: contactId || null,
        kind,
        reminder_minutes: reminderMinutes,
        status: editing?.status === 'cancelled' || editing?.status === 'completed' ? 'scheduled' : (editing?.status ?? 'scheduled'),
      }
      if (editing) {
        const { error: err } = await supabase.from('appointments').update(payload).eq('id', editing.id).eq('company_id', currentCompany.id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('appointments').insert(payload)
        if (err) throw err
      }
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(item: Appointment, status: string) {
    if (!currentCompany) return
    const { error: err } = await supabase.from('appointments').update({ status }).eq('id', item.id).eq('company_id', currentCompany.id)
    if (err) setError(err.message)
    else await load()
  }

  async function remove(item: Appointment) {
    if (!currentCompany || !confirm('Excluir este compromisso definitivamente?')) return
    const { error: err } = await supabase.from('appointments').delete().eq('id', item.id).eq('company_id', currentCompany.id)
    if (err) setError(err.message)
    else await load()
  }

  const contactName = (id: string | null) => contacts.find((c) => c.id === id)?.name
  const statusLabel = (status: string) => status === 'completed' ? 'Concluído' : status === 'cancelled' ? 'Cancelado' : 'Agendado'

  return <section>
    <div className="page-heading">
      <div><span className="eyebrow">AGENDA INTERNA</span><h1>Compromissos</h1><p>Agende, reagende, lembre e mantenha o histórico sem depender de outra ferramenta.</p></div>
      <button className="primary-button action-button" onClick={()=>openNew()}><Plus size={17}/>Novo compromisso</button>
    </div>
    {error && <div className="form-error page-message">{error}</div>}

    <div className="toolbar-card agenda-toolbar">
      <div className="segment-control">
        <button className={view === 'upcoming' ? 'active' : ''} onClick={() => setView('upcoming')}><CalendarDays size={15}/>Próximos <span>{upcoming.length}</span></button>
        <button className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}><History size={15}/>Histórico <span>{history.length}</span></button>
      </div>
      <span className="muted">Lembretes aparecem no sino quando entram na janela definida.</span>
    </div>

    <div className="panel-card no-pad">
      {loading ? <div className="loading-block">Carregando agenda...</div> : visible.length ? <div className="record-list">
        {visible.map((item) => <article className={`record-row appointment-row status-${item.status}`} key={item.id}>
          <div className="date-badge"><strong>{new Date(item.starts_at).getDate().toString().padStart(2,'0')}</strong><span>{new Intl.DateTimeFormat('pt-BR',{month:'short'}).format(new Date(item.starts_at))}</span></div>
          <div className="record-main">
            <div className="record-title"><strong>{item.title}</strong><div className="record-badges"><span className="mini-status">{kinds.find((k) => k.v === (item.kind ?? 'appointment'))?.l}</span><span className={`mini-status appointment-${item.status}`}>{statusLabel(item.status)}</span></div></div>
            <div className="record-meta"><span><Clock3 size={14}/>{formatDateTime(item.starts_at)}</span>{item.address && <span><MapPin size={14}/>{item.address}</span>}{contactName(item.contact_id) && <span>{contactName(item.contact_id)}</span>}</div>
            {item.notes && <p>{item.notes}</p>}
          </div>
          <div className="row-actions">
            <button className="secondary-button" onClick={() => openEdit(item)}>{item.status === 'scheduled' ? 'Editar / reagendar' : <><RotateCcw size={15}/>Reabrir</>}</button>
            {item.status === 'scheduled' && <><button className="secondary-button quick-success" onClick={() => void setStatus(item,'completed')}><Check size={16}/>Concluir</button><button className="secondary-button" onClick={() => void setStatus(item,'cancelled')}><X size={16}/>Cancelar</button></>}
            <button className="icon-button small danger" onClick={() => void remove(item)} title="Excluir"><Trash2 size={16}/></button>
          </div>
        </article>)}
      </div> : <div className="big-empty"><CalendarCheck2 size={36}/><h3>{view === 'upcoming' ? 'Sua agenda está livre' : 'Nenhum histórico ainda'}</h3><p>{view === 'upcoming' ? 'Crie um compromisso ou confirme uma sugestão da Secretária.' : 'Compromissos concluídos e cancelados aparecem aqui.'}</p>{view === 'upcoming' && <button className="primary-button action-button" onClick={()=>openNew()}><Plus size={17}/>Criar compromisso</button>}</div>}
    </div>

    {showForm && <div className="modal-backdrop" onClick={() => setShowForm(false)}><form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={save}>
      <div className="modal-head"><div><span className="eyebrow">{editing ? 'EDITAR / REAGENDAR' : 'NOVO'}</span><h2>{editing ? 'Compromisso' : 'Novo compromisso'}</h2></div><button type="button" className="icon-button" onClick={() => setShowForm(false)}><X size={18}/></button></div>
      <div className="form-stack">
        <label><span>Título</span><input required value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="Ex.: Visita técnica no cliente"/></label>
        <div className="form-grid two"><label><span>Início</span><input required type="datetime-local" value={startsAt} onChange={(e)=>setStartsAt(e.target.value)}/></label><label><span>Fim · opcional</span><input type="datetime-local" value={endsAt} onChange={(e)=>setEndsAt(e.target.value)}/></label></div>
        <div className="form-grid two"><label><span>Tipo</span><select value={kind} onChange={(e)=>setKind(e.target.value)}>{kinds.map((k)=><option value={k.v} key={k.v}>{k.l}</option>)}</select></label><label><span>Lembrete</span><select value={reminderMinutes} onChange={(e)=>setReminderMinutes(Number(e.target.value))}>{reminders.map((r)=><option value={r.v} key={r.v}>{r.l}</option>)}</select></label></div>
        <label><span>Cliente · opcional</span><select value={contactId} onChange={(e)=>setContactId(e.target.value)}><option value="">Sem cliente</option>{contacts.map((c)=><option key={c.id} value={c.id}>{c.name || c.phone || 'Cliente sem nome'}</option>)}</select></label>
        <label><span>Endereço</span><input value={address} onChange={(e)=>setAddress(e.target.value)} placeholder="Local do compromisso"/></label>
        <label><span>Observações</span><textarea rows={4} value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Detalhes úteis para lembrar depois"/></label>
      </div>
      <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</button></div>
    </form></div>}
  </section>
}
