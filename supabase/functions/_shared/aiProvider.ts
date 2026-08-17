import type { Candidate } from './analyzer.ts'

export type AiUsage={promptTokens:number;completionTokens:number;totalTokens:number;estimatedCostUsd:number}
export type AiResult={candidates:Candidate[];usage:AiUsage;model:string;provider:string}

type ProviderOptions={text:string;context:string;memory:string;minConfidence:number;allowMultiple:boolean;maxCandidates:number}
const allowed=new Set(['appointment','task','order','quote','payment_promise','follow_up','awaiting_reply','deadline'])
const number=(v:unknown,fallback=0)=>typeof v==='number'&&Number.isFinite(v)?v:fallback
const estimate=(prompt:number,completion:number)=>{const input=number(Number(Deno.env.get('AI_INPUT_COST_PER_1M')??0));const output=number(Number(Deno.env.get('AI_OUTPUT_COST_PER_1M')??0));return (prompt*input+completion*output)/1_000_000}

function normalize(raw:unknown,minConfidence:number,allowMultiple:boolean,maxCandidates:number):Candidate[]{
  const list=Array.isArray(raw)?raw:[];const out:Candidate[]=[]
  for(const item of list){
    if(!item||typeof item!=='object')continue
    const x=item as Record<string,unknown>;const type=String(x.type??'') as Candidate['type'];const confidence=Math.max(0,Math.min(1,number(x.confidence)))
    if(!allowed.has(type)||confidence<minConfidence)continue
    out.push({type,title:String(x.title??'Sugestão identificada').slice(0,140),summary:String(x.summary??'').slice(0,1200),reason:String(x.reason??'Análise por IA').slice(0,600),confidence,extracted_data:x.extracted_data&&typeof x.extracted_data==='object'?x.extracted_data as Record<string,unknown>:{}})
    if(out.length>=maxCandidates||(!allowMultiple&&out.length))break
  }
  return out
}

export function aiProviderConfigured(){return Boolean(Deno.env.get('AI_API_KEY')&&Deno.env.get('AI_MODEL'))}

export async function analyzeWithAi(options:ProviderOptions):Promise<AiResult>{
  const apiKey=Deno.env.get('AI_API_KEY')??'';const model=Deno.env.get('AI_MODEL')??'';const base=(Deno.env.get('AI_BASE_URL')??'https://api.openai.com/v1').replace(/\/$/,'');const provider=Deno.env.get('AI_PROVIDER')??'openai-compatible'
  if(!apiKey||!model)throw new Error('ai_provider_not_configured')
  const system=`Você é o motor operacional da Secretária IA. Extraia somente compromissos verificáveis. Tipos permitidos: appointment, task, order, quote, payment_promise, follow_up, awaiting_reply, deadline. Não invente datas, valores ou fatos. Responda APENAS JSON válido no formato {"candidates":[{"type":"task","title":"...","summary":"...","reason":"...","confidence":0.8,"extracted_data":{}}]}. Máximo ${options.maxCandidates} candidatos.`
  const user=`MEMÓRIA OPERACIONAL:\n${options.memory||'(vazia)'}\n\nCONTEXTO ANTERIOR:\n${options.context||'(vazio)'}\n\nMENSAGEM ATUAL:\n${options.text}`
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),Math.max(3000,Number(Deno.env.get('AI_TIMEOUT_MS')??12000)))
  try{
    const response=await fetch(`${base}/chat/completions`,{method:'POST',signal:controller.signal,headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({model,temperature:0,response_format:{type:'json_object'},messages:[{role:'system',content:system},{role:'user',content:user}]})})
    if(!response.ok)throw new Error(`ai_http_${response.status}`)
    const data=await response.json() as any;const content=data?.choices?.[0]?.message?.content;if(typeof content!=='string')throw new Error('ai_invalid_response')
    let parsed:any;try{parsed=JSON.parse(content)}catch{throw new Error('ai_invalid_json')}
    const prompt=number(data?.usage?.prompt_tokens);const completion=number(data?.usage?.completion_tokens);const total=number(data?.usage?.total_tokens,prompt+completion)
    return {candidates:normalize(parsed?.candidates,options.minConfidence,options.allowMultiple,options.maxCandidates),usage:{promptTokens:prompt,completionTokens:completion,totalTokens:total,estimatedCostUsd:estimate(prompt,completion)},model,provider}
  }finally{clearTimeout(timer)}
}
