import { FormEvent, useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useCompany } from '../company/CompanyProvider'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../utils/errorMessage'
import { normalizeWorkingDays } from '../utils/onboarding'

const days = [{v:1,l:'Seg'},{v:2,l:'Ter'},{v:3,l:'Qua'},{v:4,l:'Qui'},{v:5,l:'Sex'},{v:6,l:'Sáb'},{v:0,l:'Dom'}]
const monitorOptions = [
  ['monitor_appointments', 'Agendamentos'], ['monitor_orders', 'Pedidos e serviços'], ['monitor_quotes', 'Orçamentos'],
  ['monitor_payment_promises', 'Pagamentos prometidos'], ['monitor_follow_ups', 'Retornos futuros'],
  ['monitor_awaiting_reply', 'Clientes aguardando'], ['monitor_deadlines', 'Prazos'], ['monitor_tasks', 'Tarefas'],
] as const

type MonitorKey = typeof monitorOptions[number][0]

export function SettingsPage() {
  const { user, updatePassword } = useAuth()
  const { currentCompany, currentMembership, settings, refresh } = useCompany()
  const [displayName, setDisplayName] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [name, setName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [workingDays, setWorkingDays] = useState<number[]>([])
  const [start, setStart] = useState('08:00')
  const [end, setEnd] = useState('18:00')
  const [monitors, setMonitors] = useState<Record<MonitorKey, boolean>>(() => Object.fromEntries(monitorOptions.map(([key]) => [key, true])) as Record<MonitorKey, boolean>)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [accountBusy, setAccountBusy] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [accountMessage, setAccountMessage] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return
    void supabase.from('profiles').select('display_name,phone').eq('id', user.id).maybeSingle().then(({ data }) => {
      setDisplayName(data?.display_name ?? '')
      setProfilePhone(data?.phone ?? '')
    })
  }, [user])

  useEffect(() => {
    if (!currentCompany) return
    setName(currentCompany.name); setBusinessType(currentCompany.business_type ?? ''); setPhone(currentCompany.phone ?? ''); setCity(currentCompany.city ?? ''); setState(currentCompany.state ?? '')
    if (settings) {
      setWorkingDays(settings.working_days); setStart(settings.workday_start.slice(0,5)); setEnd(settings.workday_end.slice(0,5))
      setMonitors(Object.fromEntries(monitorOptions.map(([key]) => [key, settings[key]])) as Record<MonitorKey, boolean>)
    }
  }, [currentCompany, settings])

  async function saveCompany(event: FormEvent) {
    event.preventDefault(); if (!currentCompany) return
    setBusy(true); setError(''); setMessage('')
    try {
      const [{ error: companyError }, { error: settingsError }] = await Promise.all([
        supabase.from('companies').update({ name: name.trim(), business_type: businessType.trim() || null, phone: phone.trim() || null, city: city.trim() || null, state: state.trim().toUpperCase() || null }).eq('id', currentCompany.id),
        supabase.from('company_settings').update({ working_days: normalizeWorkingDays(workingDays), workday_start: start, workday_end: end, ...monitors }).eq('company_id', currentCompany.id),
      ])
      if (companyError) throw companyError
      if (settingsError) throw settingsError
      await refresh(); setMessage('Configurações da empresa salvas.')
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); if (!user) return
    setAccountBusy(true); setAccountMessage(''); setError('')
    try {
      const { error: profileError } = await supabase.from('profiles').update({ display_name: displayName.trim(), phone: profilePhone.trim() || null }).eq('id', user.id)
      if (profileError) throw profileError
      setAccountMessage('Seus dados foram salvos.')
    } catch (err) { setError(errorMessage(err)) }
    finally { setAccountBusy(false) }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault(); setPasswordMessage(''); setError('')
    if (newPassword.length < 8) return setError('Use uma senha com pelo menos 8 caracteres.')
    if (newPassword !== confirmPassword) return setError('As senhas não conferem.')
    setPasswordBusy(true)
    try { await updatePassword(newPassword); setNewPassword(''); setConfirmPassword(''); setPasswordMessage('Senha alterada.') }
    catch (err) { setError(errorMessage(err)) }
    finally { setPasswordBusy(false) }
  }

  const canEdit = currentMembership?.role === 'owner' || currentMembership?.role === 'admin'
  return <section><div className="page-heading"><div><span className="eyebrow">CONFIGURAÇÕES</span><h1>Empresa e conta</h1><p>Ajustes que definem sua rotina e o que a Secretária deve observar.</p></div></div>
    <div className="settings-layout">
      <div className="settings-column">
        <form className="settings-card" onSubmit={saveCompany}><h2>Empresa</h2><div className="form-stack"><label><span>Nome</span><input disabled={!canEdit} required value={name} onChange={(e)=>setName(e.target.value)}/></label><label><span>Atividade principal</span><input disabled={!canEdit} value={businessType} onChange={(e)=>setBusinessType(e.target.value)}/></label><div className="form-grid three"><label><span>Telefone</span><input disabled={!canEdit} value={phone} onChange={(e)=>setPhone(e.target.value)}/></label><label><span>Cidade</span><input disabled={!canEdit} value={city} onChange={(e)=>setCity(e.target.value)}/></label><label><span>UF</span><input disabled={!canEdit} maxLength={2} value={state} onChange={(e)=>setState(e.target.value)}/></label></div>
          <div className="field-group"><span className="field-title">Dias de atendimento</span><div className="day-picker">{days.map((day)=><button disabled={!canEdit} type="button" key={day.v} className={workingDays.includes(day.v)?'day-chip active':'day-chip'} onClick={()=>setWorkingDays((current)=>current.includes(day.v)?current.filter((v)=>v!==day.v):[...current,day.v])}>{day.l}</button>)}</div></div><div className="form-grid two"><label><span>Começa às</span><input disabled={!canEdit} type="time" value={start} onChange={(e)=>setStart(e.target.value)}/></label><label><span>Termina às</span><input disabled={!canEdit} type="time" value={end} onChange={(e)=>setEnd(e.target.value)}/></label></div>
          <div className="field-group"><span className="field-title">A Secretária deve observar</span><div className="monitor-grid compact">{monitorOptions.map(([key,label])=><label className="monitor-option" key={key}><input disabled={!canEdit} type="checkbox" checked={monitors[key]} onChange={(e)=>setMonitors((current)=>({...current,[key]:e.target.checked}))}/><span><strong>{label}</strong></span></label>)}</div></div>
          {message&&<div className="form-success">{message}</div>}{canEdit&&<button className="primary-button" disabled={busy}>{busy?'Salvando...':'Salvar empresa'}</button>}</div></form>
      </div>
      <div className="settings-column">
        <form className="settings-card compact" onSubmit={saveProfile}><h2>Sua conta</h2><div className="form-stack"><label><span>Nome</span><input value={displayName} onChange={(e)=>setDisplayName(e.target.value)} /></label><label><span>Telefone</span><input value={profilePhone} onChange={(e)=>setProfilePhone(e.target.value)} /></label><dl className="info-list"><div><dt>E-mail</dt><dd>{user?.email}</dd></div><div><dt>Perfil na empresa</dt><dd>{currentMembership?.role === 'owner'?'Proprietário':currentMembership?.role === 'admin'?'Administrador':'Membro'}</dd></div></dl>{accountMessage&&<div className="form-success">{accountMessage}</div>}<button className="secondary-button" disabled={accountBusy}>{accountBusy?'Salvando...':'Salvar meus dados'}</button></div></form>
        <form className="settings-card compact" onSubmit={changePassword}><h2>Senha</h2><div className="form-stack"><label><span>Nova senha</span><input type="password" minLength={8} value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} autoComplete="new-password" /></label><label><span>Confirmar senha</span><input type="password" minLength={8} value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} autoComplete="new-password" /></label>{passwordMessage&&<div className="form-success">{passwordMessage}</div>}<button className="secondary-button" disabled={passwordBusy || !newPassword}>{passwordBusy?'Alterando...':'Alterar senha'}</button></div></form>
        {error&&<div className="form-error">{error}</div>}
        <div className="privacy-box"><strong>Modo da V1: observação</strong><span>Sem envio de mensagens, áudio, leitura retroativa ou Google Agenda nesta etapa.</span></div>
      </div>
    </div>
  </section>
}
