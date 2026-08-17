import { createClient } from 'npm:@supabase/supabase-js@2'
import { analyzeText } from '../_shared/analyzer.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const started=Date.now()
  const secret=Deno.env.get('WORKER_SECRET')??''
  if(!secret)return new Response('Worker not configured',{status:503})
  if(req.headers.get('x-worker-secret')!==secret)return new Response('Unauthorized',{status:401})
  const body=await req.json().catch(()=>({})) as {message_id?:string;source?:'message'|'reprocess'}
  if(!body.message_id)return new Response(JSON.stringify({error:'message_id required'}),{status:400,headers:{'content-type':'application/json'}})

  const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??Deno.env.get('SUPABASE_SECRET_KEY')!)
  const{data:message,error}=await supabase.from('messages').select('*').eq('id',body.message_id).single()
  if(error||!message)return new Response(JSON.stringify({error:'message not found'}),{status:404,headers:{'content-type':'application/json'}})

  let runId:string|undefined
  try{
    const[{data:policy},{data:settings}]=await Promise.all([
      supabase.from('analysis_policies').select('*').eq('company_id',message.company_id).maybeSingle(),
      supabase.from('company_settings').select('*').eq('company_id',message.company_id).maybeSingle(),
    ])
    if(!message.eligible_for_ai||!message.body_text){
      await supabase.from('analysis_runs').insert({company_id:message.company_id,message_id:message.id,source:body.source??'message',engine:'rules-v1',status:'skipped',duration_ms:Date.now()-started})
      await supabase.from('message_jobs').update({status:'done',updated_at:new Date().toISOString()}).eq('message_id',message.id)
      return new Response(JSON.stringify({skipped:true}),{headers:{'content-type':'application/json'}})
    }
    const contextLimit=Math.max(1,Math.min(12,Number(policy?.context_messages??5)))
    const{data:contextRows}=await supabase.from('messages').select('id,body_text,provider_timestamp').eq('conversation_id',message.conversation_id).eq('message_type','text').lt('created_at',message.created_at).order('created_at',{ascending:false}).limit(contextLimit)
    const context=(contextRows??[]).reverse();const contextText=context.map(row=>row.body_text).filter(Boolean).join('\n')
    let memories:Array<{content:string}> = []
    if(policy?.use_company_memory!==false||policy?.use_contact_memory!==false){
      let q=supabase.from('operational_memories').select('content,contact_id').eq('company_id',message.company_id).eq('is_active',true).order('importance',{ascending:false}).order('created_at',{ascending:false}).limit(12)
      const{data}=await q;memories=(data??[]).filter((m:any)=>(policy?.use_company_memory!==false&&m.contact_id===null)||(policy?.use_contact_memory!==false&&m.contact_id===message.contact_id))
    }
    const candidates=analyzeText(message.body_text,contextText,memories.map(m=>m.content).join('\n'),{minConfidence:Number(policy?.min_confidence??.65),allowMultiple:policy?.allow_multiple_suggestions!==false,monitors:settings??{}})
    const{data:run}=await supabase.from('analysis_runs').insert({company_id:message.company_id,message_id:message.id,source:body.source??'message',engine:'rules-v1',status:'done',context_count:context.length,memory_count:memories.length,candidates:candidates.length,suggestions_created:0,duration_ms:0}).select('id').single();runId=run?.id
    let created=0
    for(const detected of candidates){
      const{error:insertError}=await supabase.from('ai_suggestions').insert({company_id:message.company_id,contact_id:message.contact_id,conversation_id:message.conversation_id,source_message_id:message.id,context_message_ids:context.map(row=>row.id),type:detected.type,title:detected.title,summary:detected.summary,reason:detected.reason,confidence:detected.confidence,extracted_data:detected.extracted_data})
      if(!insertError)created++
    }
    if(runId)await supabase.from('analysis_runs').update({suggestions_created:created,duration_ms:Date.now()-started}).eq('id',runId)
    await supabase.from('message_jobs').update({status:'done',last_error:null,updated_at:new Date().toISOString()}).eq('message_id',message.id)
    await supabase.from('audit_logs').insert({company_id:message.company_id,action:'message_analyzed',entity_type:'message',entity_id:message.id,metadata:{engine:'rules-v1',candidates:candidates.length,suggestions_created:created}})
    return new Response(JSON.stringify({ok:true,engine:'rules-v1',candidates:candidates.length,suggestions_created:created}),{headers:{'content-type':'application/json'}})
  }catch(e){
    const code=e instanceof Error?e.name:'analysis_error'
    try{await supabase.from('analysis_runs').insert({company_id:message.company_id,message_id:message.id,source:body.source??'message',engine:'rules-v1',status:'error',duration_ms:Date.now()-started,error_code:code})}catch{/* telemetria não pode derrubar o worker */}
    try{await supabase.from('message_jobs').update({status:'failed',last_error:code,updated_at:new Date().toISOString()}).eq('message_id',message.id)}catch{/* melhor esforço */}
    return new Response(JSON.stringify({error:'analysis_failed'}),{status:500,headers:{'content-type':'application/json'}})
  }
})
