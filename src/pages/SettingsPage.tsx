import { FormEvent, useCallback, useEffect, useState } from 'react'
import { BellRing, Building2, Clock3, ShieldCheck, Sparkles, UserRound, UsersRound } from 'lucide-react'
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
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [dailySummaryEnabled, setDailySummaryEnabled] = useState(true)
  const [dailySummaryTime, setDailySummaryTime] = useState('08:00')
  const [notifyOverdue, setNotifyOverdue] = useState(true)
  const [notifyNewSuggestions, setNotifyNewSuggestions] = useState(true)
  const [team, setTeam] = useState<Array<{user_id:string;display_name:string;role:'owner'|'admin'|'member';joined_at:string}>>([])
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
      setNotificationsEnabled(settings.notifications_enabled ?? true)
      setDailySummaryEnabled(settings.daily_summary_enabled ?? true)
      setDailySummaryTime((settings.daily_summary_time ?? '08:00').slice(0,5))
      setNotifyOverdue(settings.notify_overdue ?? true)
      setNotifyNewSuggestions(settings.notify_new_suggestions ?? true)
    }
  }, [currentCompany, settings])


  const loadTeam = useCallback(async () => {
    if (!currentCompany) return
    const { data } = await supabase.rpc('get_company_team', { target_company_id: currentCompany.id })
    setTeam((data ?? []) as typeof team)
  }, [currentCompany])

  useEffect(() => { void loadTeam() }, [loadTeam])

  async function saveCompany(event: FormEvent) {
    event.preventDefault(); if (!currentCompany) return
    setBusy(true); setError(''); setMessage('')
    try {
      const [{ error: companyError }, { error: settingsError }] = await Promise.all([
        supabase.from('companies').update({ name: name.trim(), business_type: businessType.trim() || null, phone: phone.trim() || null, city: city.trim() || null, state: state.trim().toUpperCase() || null }).eq('id', currentCompany.id),
        supabase.from('company_settings').update({ working_days: normalizeWorkingDays(workingDays), workday_start: start, workday_end: end, notifications_enabled: notificationsEnabled, daily_summary_enabled: dailySummaryEnabled, daily_summary_time: dailySummaryTime, notify_overdue: notifyOverdue, notify_new_suggestions: notifyNewSuggestions, ...monitors }).eq('company_id', currentCompany.id),
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
  const roleLabel = (role:'owner'|'admin'|'member') => role === 'owner' ? 'Proprietário' : role === 'admin' ? 'Administrador' : 'Membro'

  return <section>
    <div className="settings-hero">
      <div><span className="eyebrow">PERSONALIZE SUA ROTINA</span><h1>Configurações</h1><p>Deixe a Secretária com a cara da sua empresa e escolha como ela deve chamar sua atenção.</p></div>
      <div className="settings-hero-orb"><Sparkles size={28}/></div>
    </div>
    {error&&<div className="form-error page-message">{error}</div>}
    <div className="settings-layout settings-layout-rich">
      <div className="settings-column">
        <form className="settings-card colorful-card company-card" onSubmit={saveCompany}>
          <div className="settings-card-title"><span className="settings-icon blue"><Building2 size={20}/></span><div><h2>Empresa</h2><p>Informações principais e horário de funcionamento.</p></div></div>
          <div className="form-stack"><label><span>Nome</span><input disabled={!canEdit} required value={name} onChange={(e)=>setName(e.target.value)}/></label><label><span>Atividade principal</span><input disabled={!canEdit} value={businessType} onChange={(e)=>setBusinessType(e.target.value)}/></label><div className="form-grid three"><label><span>Telefone</span><input disabled={!canEdit} value={phone} onChange={(e)=>setPhone(e.target.value)}/></label><label><span>Cidade</span><input disabled={!canEdit} value={city} onChange={(e)=>setCity(e.target.value)}/></label><label><span>UF</span><input disabled={!canEdit} maxLength={2} value={state} onChange={(e)=>setState(e.target.value)}/></label></div>
            <div className="field-group"><span className="field-title">Dias de atendimento</span><div className="day-picker">{days.map((day)=><button disabled={!canEdit} type="button" key={day.v} className={workingDays.includes(day.v)?'day-chip active':'day-chip'} onClick={()=>setWorkingDays((current)=>current.includes(day.v)?current.filter((v)=>v!==day.v):[...current,day.v])}>{day.l}</button>)}</div></div><div className="form-grid two"><label><span>Começa às</span><input disabled={!canEdit} type="time" value={start} onChange={(e)=>setStart(e.target.value)}/></label><label><span>Termina às</span><input disabled={!canEdit} type="time" value={end} onChange={(e)=>setEnd(e.target.value)}/></label></div>
          </div>
        </form>

        <form className="settings-card colorful-card secretary-pref-card" onSubmit={saveCompany}>
          <div className="settings-card-title"><span className="settings-icon mint"><Sparkles size={20}/></span><div><h2>Preferências da Secretária</h2><p>Escolha o que merece observação e quando receber um resumo.</p></div></div>
          <div className="field-group"><span className="field-title">A Secretária deve observar</span><div className="monitor-grid compact">{monitorOptions.map(([key,label])=><label className="monitor-option" key={key}><input disabled={!canEdit} type="checkbox" checked={monitors[key]} onChange={(e)=>setMonitors((current)=>({...current,[key]:e.target.checked}))}/><span><strong>{label}</strong></span></label>)}</div></div>
          <div className="preference-grid">
            <label className="preference-tile coral"><input disabled={!canEdit} type="checkbox" checked={notificationsEnabled} onChange={(e)=>setNotificationsEnabled(e.target.checked)}/><span className="preference-icon"><BellRing size={19}/></span><span><strong>Notificações</strong><small>Avisos dentro do aplicativo.</small></span></label>
            <label className="preference-tile yellow"><input disabled={!canEdit} type="checkbox" checked={dailySummaryEnabled} onChange={(e)=>setDailySummaryEnabled(e.target.checked)}/><span className="preference-icon"><Clock3 size={19}/></span><span><strong>Resumo diário</strong><small>Uma visão rápida para começar o dia.</small></span></label>
            <label className="preference-tile violet"><input disabled={!canEdit} type="checkbox" checked={notifyOverdue} onChange={(e)=>setNotifyOverdue(e.target.checked)}/><span><strong>Lembrar atrasados</strong><small>Destacar prazos vencidos.</small></span></label>
            <label className="preference-tile blue"><input disabled={!canEdit} type="checkbox" checked={notifyNewSuggestions} onChange={(e)=>setNotifyNewSuggestions(e.target.checked)}/><span><strong>Novas sugestões</strong><small>Avisar quando a IA encontrar algo.</small></span></label>
          </div>
          {dailySummaryEnabled&&<label className="summary-time"><span>Horário do resumo diário</span><input disabled={!canEdit} type="time" value={dailySummaryTime} onChange={(e)=>setDailySummaryTime(e.target.value)}/></label>}
          {message&&<div className="form-success">{message}</div>}{canEdit&&<button className="primary-button vibrant" disabled={busy}>{busy?'Salvando...':'Salvar preferências'}</button>}
        </form>
      </div>

      <div className="settings-column">
        <div className="settings-card colorful-card team-card">
          <div className="settings-card-title"><span className="settings-icon violet"><UsersRound size={20}/></span><div><h2>Equipe</h2><p>Quem participa desta empresa e qual é o nível de acesso.</p></div></div>
          <div className="team-list">{team.map((member)=><div className="team-row" key={member.user_id}><span className="avatar-bubble">{member.display_name.slice(0,1).toUpperCase()}</span><div><strong>{member.display_name}</strong><small>{roleLabel(member.role)}</small></div><span className={`role-chip ${member.role}`}>{roleLabel(member.role)}</span></div>)}{!team.length&&<div className="inline-empty compact"><UsersRound size={20}/><div><strong>Equipe ainda enxuta</strong><span>Os membros aparecerão aqui.</span></div></div>}</div>
          <div className="team-note"><ShieldCheck size={17}/><span>Somente proprietário e administradores podem alterar dados da empresa.</span></div>
        </div>

        <form className="settings-card colorful-card account-card" onSubmit={saveProfile}><div className="settings-card-title"><span className="settings-icon coral"><UserRound size={20}/></span><div><h2>Sua conta</h2><p>Dados pessoais usados dentro do aplicativo.</p></div></div><div className="form-stack"><label><span>Nome</span><input value={displayName} onChange={(e)=>setDisplayName(e.target.value)} /></label><label><span>Telefone</span><input value={profilePhone} onChange={(e)=>setProfilePhone(e.target.value)} /></label><dl className="info-list"><div><dt>E-mail</dt><dd>{user?.email}</dd></div><div><dt>Perfil na empresa</dt><dd>{currentMembership ? roleLabel(currentMembership.role) : '—'}</dd></div></dl>{accountMessage&&<div className="form-success">{accountMessage}</div>}<button className="secondary-button" disabled={accountBusy}>{accountBusy?'Salvando...':'Salvar meus dados'}</button></div></form>
        <form className="settings-card colorful-card compact" onSubmit={changePassword}><h2>Segurança</h2><div className="form-stack"><label><span>Nova senha</span><input type="password" minLength={8} value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} autoComplete="new-password" /></label><label><span>Confirmar senha</span><input type="password" minLength={8} value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} autoComplete="new-password" /></label>{passwordMessage&&<div className="form-success">{passwordMessage}</div>}<button className="secondary-button" disabled={passwordBusy || !newPassword}>{passwordBusy?'Alterando...':'Alterar senha'}</button></div></form>
        <div className="privacy-box rich"><strong>Modo da V1: observação</strong><span>A Secretária organiza e sugere, mas não responde clientes automaticamente.</span></div>
      </div>
    </div>
  </section>

}
