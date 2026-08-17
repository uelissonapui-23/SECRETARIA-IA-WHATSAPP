import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'content-type':'application/json'}})

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST')return json({error:'method_not_allowed'},405)
  const token=(req.headers.get('authorization')??'').replace(/^Bearer\s+/i,'')
  if(!token)return json({error:'unauthorized'},401)
  const url=Deno.env.get('SUPABASE_URL')!;const anon=Deno.env.get('SUPABASE_ANON_KEY')??Deno.env.get('SUPABASE_PUBLISHABLE_KEY')??'';const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??Deno.env.get('SUPABASE_SECRET_KEY')??''
  const authClient=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}}});const{data:{user},error:userError}=await authClient.auth.getUser(token)
  if(userError||!user)return json({error:'unauthorized'},401)
  const input=await req.json().catch(()=>({})) as {company_id?:string;action?:'reprocess_message'|'retry_failed';message_id?:string;limit?:number}
  if(!input.company_id||!input.action)return json({error:'invalid_input'},400)
  const admin=createClient(url,service)
  const[{data:membership},{data:company}]=await Promise.all([admin.from('company_members').select('role').eq('company_id',input.company_id).eq('user_id',user.id).maybeSingle(),admin.from('companies').select('created_by').eq('id',input.company_id).maybeSingle()])
  const role=membership?.role??(company?.created_by===user.id?'owner':null);if(role!=='owner'&&role!=='admin')return json({error:'not_company_admin'},403)
  if(input.action==='reprocess_message'&&!input.message_id)return json({error:'message_id_required'},400)
  const messageIds:string[]=[]
  if(input.action==='reprocess_message')messageIds.push(input.message_id!)
  else{const limit=Math.max(1,Math.min(10,Number(input.limit??5)));const{data,error}=await admin.from('message_jobs').select('message_id').eq('company_id',input.company_id).eq('status','failed').order('updated_at',{ascending:true}).limit(limit);if(error)return json({error:'queue_read_failed'},500);messageIds.push(...(data??[]).map(r=>r.message_id))}
  if(messageIds.length===0)return json({processed:0,failed:0})
  const workerSecret=Deno.env.get('WORKER_SECRET')??'';if(!workerSecret)return json({error:'worker_not_configured'},503)
  let processed=0,failed=0
  for(const messageId of messageIds){
    await admin.from('message_jobs').update({status:'pending',available_at:new Date().toISOString(),last_error:null,failure_class:null,completed_at:null,updated_at:new Date().toISOString()}).eq('company_id',input.company_id).eq('message_id',messageId)
    const response=await fetch(`${url}/functions/v1/process-message`,{method:'POST',headers:{'content-type':'application/json','x-worker-secret':workerSecret},body:JSON.stringify({message_id:messageId,source:'reprocess'})})
    if(response.ok)processed++;else failed++
  }
  await admin.from('audit_logs').insert({company_id:input.company_id,actor_user_id:user.id,action:'analysis_manual_reprocess',entity_type:'analysis',metadata:{requested:messageIds.length,processed,failed}})
  return json({requested:messageIds.length,processed,failed})
})
