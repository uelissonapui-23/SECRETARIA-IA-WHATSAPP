import { FormEvent, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useCompany } from '../company/CompanyProvider'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../utils/errorMessage'
import { normalizeWorkingDays } from '../utils/onboarding'

const dayOptions = [
  { value: 1, label: 'Seg' }, { value: 2, label: 'Ter' }, { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' }, { value: 5, label: 'Sex' }, { value: 6, label: 'Sáb' }, { value: 0, label: 'Dom' },
]

const monitorOptions = [
  ['monitor_appointments', 'Agendamentos', 'Visitas, horários e compromissos combinados.'],
  ['monitor_orders', 'Pedidos e serviços', 'Solicitações de produtos ou trabalhos.'],
  ['monitor_quotes', 'Orçamentos', 'Pedidos de preço e negociações em andamento.'],
  ['monitor_payment_promises', 'Pagamentos prometidos', 'Ex.: “faço o PIX amanhã”.'],
  ['monitor_follow_ups', 'Retornos futuros', 'Ex.: “me chama no mês que vem”.'],
  ['monitor_awaiting_reply', 'Clientes aguardando', 'Conversas importantes sem resposta.'],
  ['monitor_deadlines', 'Prazos', 'Datas combinadas para entregar ou concluir algo.'],
  ['monitor_tasks', 'Tarefas', 'Ações que ficaram para serem feitas depois.'],
] as const

type MonitorKey = typeof monitorOptions[number][0]

export function OnboardingPage() {
  const { user } = useAuth()
  const { currentCompany, settings, loading, refresh } = useCompany()
  const navigate = useNavigate()
  const [step, setStep] = useState(currentCompany ? 2 : 1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [companyName, setCompanyName] = useState(currentCompany?.name ?? '')
  const [businessType, setBusinessType] = useState(currentCompany?.business_type ?? '')
  const [phone, setPhone] = useState(currentCompany?.phone ?? '')
  const [city, setCity] = useState(currentCompany?.city ?? '')
  const [state, setState] = useState(currentCompany?.state ?? '')
  const [workingDays, setWorkingDays] = useState<number[]>(settings?.working_days ?? [1,2,3,4,5])
  const [workdayStart, setWorkdayStart] = useState(settings?.workday_start?.slice(0,5) ?? '08:00')
  const [workdayEnd, setWorkdayEnd] = useState(settings?.workday_end?.slice(0,5) ?? '18:00')
  const [monitors, setMonitors] = useState<Record<MonitorKey, boolean>>(() => Object.fromEntries(monitorOptions.map(([key]) => [key, settings?.[key] ?? true])) as Record<MonitorKey, boolean>)

  const progress = useMemo(() => `${Math.min(step, 4)} de 4`, [step])
  if (loading) return <FullPageLoading label="Preparando sua empresa..." />
  if (currentCompany?.onboarding_completed_at) return <Navigate to="/" replace />

  async function createCompany(event: FormEvent) {
    event.preventDefault(); if (!user) return
    setBusy(true); setError('')
    try {
      const { error: saveError } = await supabase.rpc('onboarding_save_company', {
        target_company_id: currentCompany?.id ?? null,
        company_name: companyName.trim(),
        company_business_type: businessType.trim(),
        company_phone: phone.trim(),
        company_city: city.trim(),
        company_state: state.trim().toUpperCase(),
        company_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Manaus',
      })
      if (saveError) throw saveError
      await refresh(); setStep(2)
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  async function saveSchedule() {
    if (!currentCompany) return
    setBusy(true); setError('')
    try {
      const { error: updateError } = await supabase.rpc('onboarding_save_schedule', {
        target_company_id: currentCompany.id,
        target_working_days: normalizeWorkingDays(workingDays),
        target_workday_start: workdayStart,
        target_workday_end: workdayEnd,
      })
      if (updateError) throw updateError
      await refresh(); setStep(3)
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  async function saveMonitoring() {
    if (!currentCompany) return
    setBusy(true); setError('')
    try {
      const { error: updateError } = await supabase.rpc('onboarding_save_monitors', {
        target_company_id: currentCompany.id,
        target_monitor_appointments: monitors.monitor_appointments,
        target_monitor_orders: monitors.monitor_orders,
        target_monitor_quotes: monitors.monitor_quotes,
        target_monitor_payment_promises: monitors.monitor_payment_promises,
        target_monitor_follow_ups: monitors.monitor_follow_ups,
        target_monitor_awaiting_reply: monitors.monitor_awaiting_reply,
        target_monitor_deadlines: monitors.monitor_deadlines,
        target_monitor_tasks: monitors.monitor_tasks,
      })
      if (updateError) throw updateError
      await refresh(); setStep(4)
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  async function finish() {
    if (!currentCompany) return
    setBusy(true); setError('')
    try {
      const { error: companyError } = await supabase.rpc('onboarding_complete', { target_company_id: currentCompany.id })
      if (companyError) throw companyError
      await refresh(); navigate('/', { replace: true })
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  return (
    <main className="onboarding-page"><section className="onboarding-card"><div className="onboarding-top"><div className="brand"><div className="brand-mark">S</div><div><strong>Secretária IA</strong><span>Configuração inicial</span></div></div><span className="step-counter">{progress}</span></div><div className="progress-track"><span style={{ width: `${step * 25}%` }} /></div>
      {step === 1 && <form onSubmit={createCompany} className="onboarding-content"><span className="eyebrow">SUA EMPRESA</span><h1>Vamos preparar a Secretária para o seu negócio</h1><p>Essas informações ajudam a organizar os registros e interpretar o contexto das conversas.</p><div className="form-stack"><label><span>Nome da empresa</span><input required value={companyName} onChange={(e)=>setCompanyName(e.target.value)} placeholder="Ex.: Refrigeração do João" /></label><label><span>Atividade principal</span><input value={businessType} onChange={(e)=>setBusinessType(e.target.value)} placeholder="Ex.: instalação e manutenção de ar-condicionado" /></label><div className="form-grid three"><label><span>Telefone</span><input value={phone} onChange={(e)=>setPhone(e.target.value)} inputMode="tel" /></label><label><span>Cidade</span><input value={city} onChange={(e)=>setCity(e.target.value)} /></label><label><span>UF</span><input maxLength={2} value={state} onChange={(e)=>setState(e.target.value)} /></label></div></div>{error && <div className="form-error">{error}</div>}<div className="wizard-actions"><button className="primary-button" disabled={busy}>{busy ? 'Salvando...' : 'Continuar'}</button></div></form>}
      {step === 2 && <div className="onboarding-content"><span className="eyebrow">ROTINA</span><h1>Quando você costuma trabalhar?</h1><p>Isso ajuda a Secretária a interpretar “amanhã cedo”, organizar compromissos e evitar alertas fora de hora.</p><div className="field-group"><span className="field-title">Dias de atendimento</span><div className="day-picker">{dayOptions.map((day)=><button type="button" key={day.value} className={workingDays.includes(day.value)?'day-chip active':'day-chip'} onClick={()=>setWorkingDays((days)=>days.includes(day.value)?days.filter((item)=>item!==day.value):[...days,day.value])}>{day.label}</button>)}</div></div><div className="form-grid two"><label><span>Começa às</span><input type="time" value={workdayStart} onChange={(e)=>setWorkdayStart(e.target.value)} /></label><label><span>Termina às</span><input type="time" value={workdayEnd} onChange={(e)=>setWorkdayEnd(e.target.value)} /></label></div>{error && <div className="form-error">{error}</div>}<div className="wizard-actions"><button className="secondary-button" type="button" onClick={()=>setStep(1)}>Voltar</button><button className="primary-button" type="button" disabled={busy || workingDays.length===0} onClick={saveSchedule}>{busy?'Salvando...':'Continuar'}</button></div></div>}
      {step === 3 && <div className="onboarding-content"><span className="eyebrow">O QUE OBSERVAR</span><h1>O que você quer que a Secretária acompanhe?</h1><p>Você poderá mudar isso depois. Nesta versão a IA apenas observa, organiza e lembra você.</p><div className="monitor-grid">{monitorOptions.map(([key,title,detail])=><label className="monitor-option" key={key}><input type="checkbox" checked={monitors[key]} onChange={(e)=>setMonitors((current)=>({...current,[key]:e.target.checked}))}/><span><strong>{title}</strong><small>{detail}</small></span></label>)}</div>{error && <div className="form-error">{error}</div>}<div className="wizard-actions"><button className="secondary-button" type="button" onClick={()=>setStep(2)}>Voltar</button><button className="primary-button" type="button" disabled={busy} onClick={saveMonitoring}>{busy?'Salvando...':'Continuar'}</button></div></div>}
      {step === 4 && <div className="onboarding-content"><span className="eyebrow">PRONTO PARA O NÚCLEO</span><h1>Sua empresa está configurada</h1><p>A conta, a empresa, os horários e as regras de observação estão prontos. A conexão oficial do WhatsApp entra no próximo módulo e não exige refazer esta configuração.</p><div className="privacy-box"><strong>Como a V1 vai funcionar</strong><span>Ela começa a acompanhar somente novas mensagens de texto depois da ativação do WhatsApp. Não lê áudios, não envia mensagens e não vasculha conversas antigas.</span></div>{error && <div className="form-error">{error}</div>}<div className="wizard-actions"><button className="secondary-button" type="button" onClick={()=>setStep(3)}>Voltar</button><button className="primary-button" type="button" disabled={busy} onClick={finish}>{busy?'Finalizando...':'Entrar no sistema'}</button></div></div>}
    </section></main>
  )
}

function FullPageLoading({ label }: { label: string }) { return <main className="loading-page"><div className="loading-card"><div className="spinner"/><span>{label}</span></div></main> }
