import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { analyzeText } from '../_shared/analyzer.ts'

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'content-type':'application/json'}})
Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  if(req.method!=='POST')return json({error:'method_not_allowed'},405)
  const auth=req.headers.get('authorization')??'';const token=auth.replace(/^Bearer\s+/i,'')
  if(!token)return json({error:'unauthorized'},401)
  const url=Deno.env.get('SUPABASE_URL')!;const anon=Deno.env.get('SUPABASE_ANON_KEY')??Deno.env.get('SUPABASE_PUBLISHABLE_KEY')??'';const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??Deno.env.get('SUPABASE_SECRET_KEY')??''
  const authClient=createClient(url,anon,{global:{headers:{Authorization:`Bearer ${token}`}}});const{data:{user},error:userError}=await authClient.auth.getUser(token)
  if(userError||!user)return json({error:'unauthorized'},401)
  const admin=createClient(url,service);const input=await req.json().catch(()=>({})) as {company_id?:string;text?:string}
  const text=(input.text??'').trim();if(!input.company_id||text.length<3||text.length>4000)return json({error:'invalid_input'},400)
  const[{data:membership},{data:company}]=await Promise.all([admin.from('company_members').select('role').eq('company_id',input.company_id).eq('user_id',user.id).maybeSingle(),admin.from('companies').select('created_by').eq('id',input.company_id).maybeSingle()])
  if(!membership&&company?.created_by!==user.id)return json({error:'not_company_member'},403)
  const started=Date.now();const[{data:policy},{data:settings},{data:memories}]=await Promise.all([admin.from('analysis_policies').select('*').eq('company_id',input.company_id).maybeSingle(),admin.from('company_settings').select('*').eq('company_id',input.company_id).maybeSingle(),admin.from('operational_memories').select('content').eq('company_id',input.company_id).is('contact_id',null).eq('is_active',true).order('created_at',{ascending:false}).limit(10)])
  const candidates=analyzeText(text,'',(memories??[]).map((m:any)=>m.content).join('\n'),{minConfidence:Number(policy?.min_confidence??.65),allowMultiple:policy?.allow_multiple_suggestions!==false,monitors:settings??{}})
  await admin.from('analysis_runs').insert({company_id:input.company_id,source:'lab',engine:'rules-v1',status:'done',context_count:0,memory_count:(memories??[]).length,candidates:candidates.length,suggestions_created:0,duration_ms:Date.now()-started})
  await admin.from('audit_logs').insert({company_id:input.company_id,actor_user_id:user.id,action:'analysis_lab_run',entity_type:'analysis',metadata:{engine:'rules-v1',candidates:candidates.length,text_length:text.length}})
  return json({engine:'rules-v1',mode:'observation',candidates})
})
