export type SuggestionType='appointment'|'task'|'order'|'quote'|'payment_promise'|'follow_up'|'awaiting_reply'|'deadline'
export type Candidate={type:SuggestionType;title:string;summary:string;reason:string;confidence:number;extracted_data:Record<string,unknown>}
export type AnalyzeOptions={minConfidence:number;allowMultiple:boolean;monitors?:Record<string,boolean>}

const monitorKey:Record<SuggestionType,string>={appointment:'monitor_appointments',task:'monitor_tasks',order:'monitor_orders',quote:'monitor_quotes',payment_promise:'monitor_payment_promises',follow_up:'monitor_follow_ups',awaiting_reply:'monitor_awaiting_reply',deadline:'monitor_deadlines'}
const substitutions:Array<[RegExp,string]>=[[/\bamnh\b|\bamanh\b/gi,'amanhã'],[/\bhj\b/gi,'hoje'],[/\bqro\b|\bkeru\b/gi,'quero'],[/\bagnd\w*\b/gi,'agendar'],[/\bremarc\w*\b|\bremrk\w*\b/gi,'remarcar'],[/\bdesmarc\w*\b|\bcanc\w*\b/gi,'cancelar'],[/(?<=\d)hr?s?\b|\bhr?s?\b/gi,'horas'],[/\bpra\b/gi,'para'],[/\bvc\b/gi,'você']]
const vocabulary=['agendar','marcar','remarcar','cancelar','desmarcar','visita','amanhã','hoje','horário','reagendar']
const plain=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR')
const distance=(a:string,b:string)=>{const row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let previous=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const saved=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,previous+(a[i-1]===b[j-1]?0:1));previous=saved}}return row[b.length]}
const correctOperationalTypos=(value:string)=>value.replace(/[\p{L}]+/gu,token=>{if(token.length<5)return token;const source=plain(token);let best=token,bestDistance=3;for(const canonical of vocabulary){const score=distance(source,plain(canonical));if(score<bestDistance){best=canonical;bestDistance=score}}return bestDistance<=2?best:token})
export const normalizeWhatsAppText=(text:string)=>correctOperationalTypos(substitutions.reduce((value,[pattern,replacement])=>value.replace(pattern,replacement),text.normalize('NFC').replace(/\s+/g,' ').trim()))
export function hasOperationalSignal(text:string){
  const withoutUrls=text.replace(/https?:\/\/\S+|www\.\S+/gi,' ').replace(/\s+/g,' ').trim()
  if(!withoutUrls)return false
  const normalized=normalizeWhatsAppText(withoutUrls)
  if(/^(?:oi|ol[aá]|bom dia|boa tarde|boa noite|obrigad[oa]|valeu|ok|okay|blz|beleza|sim|n[aã]o|entendi|certo|tudo bem|show)[!.?\s]*$/i.test(normalized))return false
  return /\b(agendar|marcar|remarcar|reagendar|cancelar|desmarcar|hor[aá]rio|visita|reuni[aã]o|consulta|amanh[ãa]|hoje|segunda|ter[cç]a|quarta|quinta|sexta|s[áa]bado|domingo|pedido|encomenda|or[cç]amento|pre[cç]o|valor|quanto custa|quanto fica|pix|pagamento|pagar|transfer[eê]ncia|dep[óo]sito|entrega|prazo|vence|vencimento|me manda|preciso que|n[aã]o esque[cç]a|confere|verifica|me liga|me lembra|retorna|me avisa|aguardo|me responde)\b/i.test(normalized)||/\b\d{1,2}(?::\d{2}|h(?:\d{2})?)\b/i.test(normalized)||/\br\$\s*\d/i.test(normalized)
}
const money=(text:string)=>{const m=text.match(/(?:r\$\s*)(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:[.,]\d{2})?)|(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:[.,]\d{2})?)\s*(?:reais|real)\b/i);const raw=m?.[1]??m?.[2];if(!raw)return undefined;const n=Number(raw.replace(/\./g,'').replace(',','.'));return Number.isFinite(n)?n:undefined}
const time=(text:string)=>{const m=text.match(/\b(?:às?\s*)?(\d{1,2})\s*h(?:\s*(\d{2}))?(?:oras?)?\b|\b(\d{1,2}):(\d{2})\b/i);if(!m)return undefined;const h=Number(m[1]??m[3]);const min=Number(m[2]??m[4]??0);return h<24&&min<60?`${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`:undefined}
const when=(text:string)=>text.match(/(hoje|depois de amanh[ãa]|amanh[ãa]|segunda(?:-feira)?|terça(?:-feira)?|ter[cç]a(?:-feira)?|quarta(?:-feira)?|quinta(?:-feira)?|sexta(?:-feira)?|s[áa]bado|domingo|semana que vem|m[eê]s que vem)/i)?.[1]
function enabled(type:SuggestionType,o:AnalyzeOptions){return o.monitors?.[monitorKey[type]]!==false}
function add(list:Candidate[],candidate:Candidate,o:AnalyzeOptions){if(enabled(candidate.type,o)&&candidate.confidence>=o.minConfidence&&!list.some(x=>x.type===candidate.type))list.push(candidate)}

export function analyzeText(text:string,context:string,memory:string,options:AnalyzeOptions):Candidate[]{
  if(!hasOperationalSignal(text))return []
  const normalized=normalizeWhatsAppText(text);const merged=`${normalizeWhatsAppText(context)}\n${normalized}`.trim();const low=merged.toLocaleLowerCase('pt-BR');const out:Candidate[]=[];const amount=money(normalized);const timeText=time(normalized);const whenText=when(normalized)
  if(/\b(or[cç]amento|quanto fica|quanto custa|pre[cç]o|valor do servi[cç]o|cotação|cotacao)\b/i.test(low)) add(out,{type:'quote',title:'Orçamento para acompanhar',summary:text,reason:'A conversa contém pedido ou negociação de preço.',confidence:.84,extracted_data:{amount}},options)
  if(/\b(pedido|fechado|pode fazer|pode produzir|vamos fazer|encomenda|quero \d+|separa pra mim)\b/i.test(low)) add(out,{type:'order',title:'Possível pedido confirmado',summary:text,reason:'A conversa indica intenção de executar ou produzir algo.',confidence:.81,extracted_data:{amount}},options)
  if(/\b(pix|transfer[eê]ncia|pagamento|vou pagar|pago hoje|fa[cç]o o pix|deposito|dep[óo]sito)\b/i.test(low)) add(out,{type:'payment_promise',title:'Pagamento para conferir',summary:text,reason:'Foi identificada uma promessa ou referência operacional de pagamento.',confidence:.86,extracted_data:{amount,promised_for:whenText}},options)
  // A ação deve vir da mensagem atual. O histórico serve como contexto, mas não pode
  // transformar um pedido de remarcar/cancelar em uma nova criação.
  const currentLow=normalized.toLocaleLowerCase('pt-BR')
  const cancelAppointment=/\b(cancelar|desmarcar)\b/i.test(currentLow),rescheduleAppointment=/\b(remarcar|reagendar|mudar|trocar|adiar)\b/i.test(currentLow)
  if(cancelAppointment)add(out,{type:'appointment',title:'Cancelamento de compromisso',summary:text,reason:'A mensagem solicita cancelar um compromisso existente.',confidence:.9,extracted_data:{action:'cancel'}},options)
  else if(rescheduleAppointment)add(out,{type:'appointment',title:'Alteração de compromisso',summary:text,reason:'A mensagem solicita alterar data ou horário de um compromisso.',confidence:whenText&&timeText?.93:.79,extracted_data:{action:'reschedule',when_text:whenText,time_text:timeText}},options)
  else if((whenText&&timeText)||/\b(agendar|marcad[oa]|hor[aá]rio|visita|pode vir|te espero)\b/i.test(currentLow)) add(out,{type:'appointment',title:'Possível compromisso',summary:text,reason:'A mensagem combina data/horário ou linguagem de agendamento.',confidence:whenText&&timeText?.88:.76,extracted_data:{action:'create',when_text:whenText,time_text:timeText}},options)
  if(/\b(me chama|me liga|me lembra|retorna|retorno|fala comigo|procura de novo|semana que vem|m[eê]s que vem)\b/i.test(low)) add(out,{type:'follow_up',title:'Retorno futuro',summary:text,reason:'A conversa pede acompanhamento em outro momento.',confidence:.82,extracted_data:{when_text:whenText}},options)
  if(/\b(at[eé]|prazo|entregar|entrega|vence|vencimento|data limite|preciso para|tem que ficar pronto)\b/i.test(low)&&whenText) add(out,{type:'deadline',title:'Prazo mencionado',summary:text,reason:'Há linguagem de prazo acompanhada de referência temporal.',confidence:.79,extracted_data:{when_text:whenText,time_text:timeText}},options)
  if(/\b(me manda|preciso que|n[aã]o esque[cç]a|lembra de|faz pra mim|confere|verifica)\b/i.test(low)) add(out,{type:'task',title:'Tarefa identificada',summary:text,reason:'A mensagem contém uma solicitação objetiva que pode virar tarefa.',confidence:.74,extracted_data:{when_text:whenText}},options)
  if(/\b(aguardo|fico no aguardo|me avisa|quando puder|estou esperando|me responde)\b/i.test(low)) add(out,{type:'awaiting_reply',title:'Cliente aguardando resposta',summary:text,reason:'O cliente sinaliza que está aguardando uma resposta ou decisão.',confidence:.8,extracted_data:{}},options)
  if(memory&&/urgente|prioridade|sempre priorizar/i.test(memory)) for(const item of out)item.confidence=Math.min(.99,item.confidence+.03)
  return options.allowMultiple?out:out.slice(0,1)
}
