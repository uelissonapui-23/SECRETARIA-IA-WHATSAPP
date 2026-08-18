import { Bot, CheckCircle2, FileText, MessageSquareText, Play, ShieldCheck, Sparkles, Trash2, Upload, WandSparkles } from 'lucide-react'
import { type ChangeEvent, type FormEvent, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { chatAuthors, normalizeImportedMessages, parseWhatsAppExport, validationContactName } from '../validation/chatImport'
import { scenarioById, simulationScenarios, type SimulationScenario } from '../validation/simulator'
import { errorMessage } from '../utils/errorMessage'

type Props = {
  companyId: string
  canManage: boolean
}

type ImportResponse = {
  ok?: boolean
  imported?: number
  analyzed?: boolean
  analysis?: { suggestions_created?: number; engine?: string }
  error?: string
}

type LiveTurn = {
  direction: 'inbound' | 'outbound'
  body: string
  state: 'waiting' | 'sending' | 'done' | 'error'
}

async function validationInvokeErrorMessage(error: unknown) {
  const context = (error as { context?: Response } | null)?.context
  if (context && typeof context.clone === 'function') {
    try {
      const payload = await context.clone().json() as { error?: string; role?: string | null }
      if (payload?.error) {
        if (payload.error === 'not_company_admin') {
          return payload.role
            ? `Seu papel atual nesta empresa é "${payload.role}". Somente proprietário ou administrador pode executar a validação.`
            : 'Sua conta não foi reconhecida como proprietária ou administradora desta empresa.'
        }
        if (payload.error === 'membership_query_failed') {
          return 'Não foi possível validar sua permissão na empresa. Consulte os logs da função validation-import.'
        }
        return payload.error
      }
    } catch { /* resposta sem JSON; usa mensagem padrão */ }
  }
  return errorMessage(error)
}

async function invokeValidation(body: Record<string, unknown>) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !sessionData.session?.access_token) throw new Error('Sua sessão expirou. Entre novamente.')
  const { data, error } = await supabase.functions.invoke('validation-import', {
    body,
    headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
  })
  if (error) throw new Error(await validationInvokeErrorMessage(error))
  const response = data as ImportResponse
  if (response?.error) throw new Error(response.error)
  return response
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

export function ValidationConnectorPanel({ companyId, canManage }: Props) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'simulator' | 'quick' | 'import'>('simulator')
  const [scenarioId, setScenarioId] = useState<SimulationScenario['id']>('appointment')
  const [liveTurns, setLiveTurns] = useState<LiveTurn[]>([])
  const [simulationRunning, setSimulationRunning] = useState(false)
  const stopSimulationRef = useRef(false)
  const [quickName, setQuickName] = useState('Cliente de teste')
  const [quickMessage, setQuickMessage] = useState('')
  const [rawChat, setRawChat] = useState('')
  const [myAuthor, setMyAuthor] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const scenario = useMemo(() => scenarioById(scenarioId), [scenarioId])
  const parsed = useMemo(() => parseWhatsAppExport(rawChat), [rawChat])
  const authors = useMemo(() => chatAuthors(parsed), [parsed])
  const inboundCount = useMemo(() => myAuthor ? parsed.filter((message) => message.author !== myAuthor).length : 0, [myAuthor, parsed])

  function resetMessages() {
    setNotice('')
    setError('')
  }

  async function runSimulation() {
    if (!canManage || simulationRunning) return
    resetMessages()
    stopSimulationRef.current = false
    setSimulationRunning(true)
    setLiveTurns(scenario.turns.map((turn) => ({ direction: turn.direction, body: turn.body, state: 'waiting' })))
    let totalSuggestions = 0

    try {
      for (let index = 0; index < scenario.turns.length; index += 1) {
        if (stopSimulationRef.current) break
        const turn = scenario.turns[index]
        setLiveTurns((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, state: 'sending' } : item))
        await wait(turn.delayMs ?? 800)
        const response = await invokeValidation({
          company_id: companyId,
          action: 'import',
          contact_name: scenario.contactName,
          messages: [{ direction: turn.direction, body: turn.body, author: turn.direction === 'inbound' ? scenario.contactName : 'Sua empresa', timestamp: new Date().toISOString() }],
          analyze_last_inbound: turn.direction === 'inbound',
        })
        totalSuggestions += Number(response.analysis?.suggestions_created ?? 0)
        setLiveTurns((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, state: 'done' } : item))
        await wait(350)
      }

      if (stopSimulationRef.current) {
        setNotice('Simulação interrompida. As mensagens que já tinham chegado continuam registradas como dados de teste.')
      } else if (scenario.id === 'nothing') {
        setNotice(totalSuggestions === 0 ? 'Perfeito: a conversa terminou sem gerar interrupção desnecessária.' : `A simulação terminou e gerou ${totalSuggestions} sugestão(ões). Vale revisar se alguma delas foi necessária.`)
      } else {
        setNotice(totalSuggestions > 0 ? `Fluxo concluído automaticamente. A Secretária criou ${totalSuggestions} sugestão(ões) para você decidir.` : 'Fluxo concluído automaticamente. As mensagens foram analisadas, mas nenhuma sugestão atingiu a confiança mínima.')
      }
    } catch (err) {
      setError(errorMessage(err))
      setLiveTurns((current) => current.map((item) => item.state === 'sending' ? { ...item, state: 'error' } : item))
    } finally {
      setSimulationRunning(false)
    }
  }

  function stopSimulation() {
    stopSimulationRef.current = true
  }

  async function quickTest(event: FormEvent) {
    event.preventDefault()
    if (!quickMessage.trim() || !quickName.trim() || !canManage) return
    resetMessages(); setBusy(true)
    try {
      const response = await invokeValidation({
        company_id: companyId,
        action: 'import',
        contact_name: quickName.trim(),
        messages: [{ direction: 'inbound', body: quickMessage.trim(), author: quickName.trim(), timestamp: new Date().toISOString() }],
        analyze_last_inbound: true,
      })
      const created = Number(response.analysis?.suggestions_created ?? 0)
      setQuickMessage('')
      setNotice(created > 0
        ? `Mensagem recebida. A Secretária encontrou ${created} sugestão(ões).`
        : 'Mensagem recebida e analisada. Nenhuma sugestão atingiu a confiança mínima.')
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  async function importChat(event: FormEvent) {
    event.preventDefault()
    if (!canManage || parsed.length === 0 || !myAuthor) return
    resetMessages(); setBusy(true)
    try {
      const normalized = normalizeImportedMessages(parsed, myAuthor)
      const response = await invokeValidation({
        company_id: companyId,
        action: 'import',
        contact_name: contactName.trim() || validationContactName(parsed, myAuthor),
        contact_phone: contactPhone.trim(),
        messages: normalized,
        analyze_last_inbound: true,
      })
      const created = Number(response.analysis?.suggestions_created ?? 0)
      setNotice(`${Number(response.imported ?? normalized.length)} mensagens importadas como contexto. ${created > 0 ? `A Secretária criou ${created} sugestão(ões).` : 'A última mensagem do cliente foi analisada.'}`)
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    resetMessages()
    if (file.size > 2_000_000) { setError('Use uma exportação de texto com até 2 MB para este teste.'); return }
    const text = await file.text()
    setRawChat(text)
    const detected = parseWhatsAppExport(text)
    const detectedAuthors = chatAuthors(detected)
    setMyAuthor(detectedAuthors.length === 2 ? detectedAuthors[1] : '')
    setContactName('')
  }

  async function clearValidation() {
    if (!canManage || !window.confirm('Apagar apenas as conversas e sugestões criadas pelo modo de validação? Dados reais da Meta não serão removidos.')) return
    resetMessages(); setBusy(true)
    try {
      const response = await invokeValidation({ company_id: companyId, action: 'clear' })
      setLiveTurns([])
      setNotice(`Dados de teste limpos. ${Number((response as { contacts_removed?: number }).contacts_removed ?? 0)} contato(s) de validação removido(s).`)
    } catch (err) { setError(errorMessage(err)) }
    finally { setBusy(false) }
  }

  return <div className="validation-stack">
    <div className="validation-hero">
      <div className="validation-hero-icon"><Bot size={27}/></div>
      <div><span className="eyebrow">MODO DE VALIDAÇÃO</span><h2>Veja a Secretária trabalhando sozinha, como se as mensagens estivessem chegando do WhatsApp</h2><p>O simulador injeta mensagens no mesmo pipeline operacional. Você não precisa copiar conversa a cada mensagem: inicia o cenário e apenas observa a Secretária analisar e pedir decisão quando necessário.</p></div>
      <span className="validation-safe-pill"><ShieldCheck size={15}/> Sem automação não oficial</span>
    </div>

    <div className="validation-how">
      <div><span>1</span><strong>A mensagem “chega”</strong><small>O simulador representa o webhook que a Meta fornecerá depois.</small></div>
      <div><span>2</span><strong>A Secretária trabalha</strong><small>Contato, conversa, contexto, análise e sugestão seguem o pipeline real.</small></div>
      <div><span>3</span><strong>Você só decide</strong><small>Abra a Central da Secretária e confirme apenas o que tiver consequência.</small></div>
    </div>

    <div className="validation-mode-tabs" role="tablist" aria-label="Forma de validação">
      <button type="button" className={mode === 'simulator' ? 'active' : ''} onClick={()=>{setMode('simulator');resetMessages()}}><Sparkles size={17}/> Simulação automática</button>
      <button type="button" className={mode === 'quick' ? 'active' : ''} onClick={()=>{setMode('quick');resetMessages()}}><WandSparkles size={17}/> Mensagem manual</button>
      <button type="button" className={mode === 'import' ? 'active' : ''} onClick={()=>{setMode('import');resetMessages()}}><FileText size={17}/> Conversa exportada</button>
    </div>

    {mode === 'simulator' && <div className="validation-card validation-simulator">
      <div className="validation-card-title"><Sparkles size={20}/><div><h3>Simulação automática de atendimento</h3><p>Escolha um tipo de situação e clique uma vez. O restante acontece sozinho.</p></div></div>
      <div className="simulation-scenario-grid">
        {simulationScenarios.map((item)=><button type="button" key={item.id} className={scenarioId === item.id ? 'active' : ''} disabled={simulationRunning} onClick={()=>{setScenarioId(item.id);setLiveTurns([]);resetMessages()}}><strong>{item.title}</strong><span>{item.description}</span></button>)}
      </div>
      <div className="simulation-preview-card">
        <div className="simulation-preview-head"><div><span className="eyebrow">CENÁRIO</span><h4>{scenario.title}</h4><p>{scenario.description}</p></div><span className="mini-status">{scenario.turns.length} mensagem(ns)</span></div>
        <div className="simulation-chat">
          {(liveTurns.length ? liveTurns : scenario.turns.map((turn)=>({ ...turn, state:'waiting' as const }))).map((turn,index)=><div key={`${turn.body}-${index}`} className={`simulation-bubble ${turn.direction} state-${turn.state}`}><div><strong>{turn.direction === 'inbound' ? scenario.contactName : 'Sua empresa'}</strong><span>{turn.body}</span></div><small>{turn.state === 'sending' ? 'chegando...' : turn.state === 'done' ? 'processada' : turn.state === 'error' ? 'erro' : index === 0 && !simulationRunning ? 'prévia' : ''}</small></div>)}
        </div>
      </div>
      <div className="validation-actions simulation-actions">
        {simulationRunning ? <button type="button" className="secondary-button" onClick={stopSimulation}>Parar simulação</button> : <button type="button" className="primary-button vibrant" disabled={!canManage} onClick={()=>void runSimulation()}><Play size={17}/>Iniciar simulação automática</button>}
        <button type="button" className="secondary-button" onClick={()=>navigate('/secretaria')}><Sparkles size={16}/>Abrir Central da Secretária</button>
      </div>
      <div className="simulation-note"><CheckCircle2 size={16}/><span>Este modo não substitui o WhatsApp real. Ele valida a experiência automática do produto enquanto a integração oficial da Meta fica pausada.</span></div>
    </div>}

    {mode === 'quick' && <form className="validation-card validation-form" onSubmit={quickTest}>
      <div className="validation-card-title"><MessageSquareText size={20}/><div><h3>Simule uma mensagem específica</h3><p>Útil quando você quer testar uma frase exata fora dos cenários prontos.</p></div></div>
      <label>Nome do cliente<input value={quickName} onChange={(event)=>setQuickName(event.target.value)} maxLength={120} placeholder="Ex.: Carlos"/></label>
      <label>Mensagem do cliente<textarea value={quickMessage} onChange={(event)=>setQuickMessage(event.target.value)} maxLength={4000} rows={5} placeholder="Ex.: Pode marcar uma visita técnica para amanhã às 15h?"/></label>
      <div className="validation-actions"><button className="primary-button vibrant" disabled={busy || !canManage || !quickMessage.trim()}><Play size={17}/>{busy?'Analisando...':'Simular chegada'}</button></div>
    </form>}

    {mode === 'import' && <form className="validation-card validation-form" onSubmit={importChat}>
      <div className="validation-card-title"><Upload size={20}/><div><h3>Use uma conversa real como laboratório</h3><p>É opcional. Serve para testar contexto real, não como rotina diária do cliente.</p></div></div>
      <label className="validation-file"><Upload size={18}/><span>Selecionar arquivo .txt</span><input type="file" accept=".txt,text/plain" onChange={loadFile}/></label>
      <div className="validation-or"><span>ou cole o conteúdo abaixo</span></div>
      <label>Conteúdo da conversa<textarea value={rawChat} onChange={(event)=>{setRawChat(event.target.value);setMyAuthor('')}} rows={7} placeholder="Cole aqui o texto exportado do WhatsApp..."/></label>

      {parsed.length > 0 && <div className="validation-preview">
        <div className="validation-preview-stats"><strong>{parsed.length}</strong><span>mensagens reconhecidas</span><strong>{authors.length}</strong><span>participantes</span></div>
        <div className="validation-form-grid">
          <label>Quem é você/empresa?<select value={myAuthor} onChange={(event)=>setMyAuthor(event.target.value)}><option value="">Selecione</option>{authors.map((author)=><option key={author} value={author}>{author}</option>)}</select></label>
          <label>Nome do cliente<input value={contactName} onChange={(event)=>setContactName(event.target.value)} placeholder={myAuthor ? validationContactName(parsed,myAuthor) : 'Detectado após selecionar você'}/></label>
          <label>Telefone (opcional)<input value={contactPhone} onChange={(event)=>setContactPhone(event.target.value)} inputMode="tel" placeholder="Somente para organizar o teste"/></label>
        </div>
        {myAuthor && <div className="validation-analysis-target"><strong>{inboundCount} mensagem(ns) do cliente</strong><span>A última delas será analisada; as anteriores servem apenas como contexto.</span></div>}
        <div className="validation-message-sample">{parsed.slice(-4).map((message,index)=><div key={`${message.author}-${index}`} className={message.author === myAuthor ? 'mine' : 'customer'}><strong>{message.author}</strong><span>{message.body.slice(0,220)}</span></div>)}</div>
      </div>}
      <div className="validation-actions"><button className="primary-button vibrant" disabled={busy || !canManage || parsed.length===0 || !myAuthor}><Play size={17}/>{busy?'Importando...':'Usar conversa no laboratório'}</button></div>
    </form>}

    {(notice || error) && <div className={`validation-result ${error?'form-error':'form-success'}`}><span>{error || notice}</span><div>{!error && <button type="button" className="secondary-button" onClick={()=>navigate('/secretaria')}>Ver o que a Secretária encontrou</button>}</div></div>}

    <div className="validation-footer-actions"><button type="button" className="text-danger-button" disabled={busy || simulationRunning || !canManage} onClick={()=>void clearValidation()}><Trash2 size={15}/>Limpar somente dados de teste</button></div>
  </div>
}
