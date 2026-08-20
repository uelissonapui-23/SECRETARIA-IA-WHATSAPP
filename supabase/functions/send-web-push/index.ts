import {createClient} from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import {corsHeaders} from '../_shared/cors.ts'

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'content-type':'application/json'}})
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
  const body=await req.json().catch(()=>({})) as {action?:string;record?:Record<string,unknown>;notification_id?:string}
  const publicKey=Deno.env.get('VAPID_PUBLIC_KEY')??''
  if(body.action==='public_key')return json({public_key:publicKey,configured:Boolean(publicKey)})
  const expected=Deno.env.get('PUSH_WEBHOOK_SECRET')??''
  if(!expected||req.headers.get('x-webhook-secret')!==expected)return json({error:'unauthorized'},401)
  const privateKey=Deno.env.get('VAPID_PRIVATE_KEY')??'',subject=Deno.env.get('VAPID_SUBJECT')??'https://secretaria-ia-whatsapp-iota.vercel.app'
  if(!publicKey||!privateKey)return json({error:'vapid_not_configured'},503)
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  let notification=body.record
  if(!notification&&body.notification_id){const result=await admin.from('app_notifications').select('id,company_id,user_id,title,body,link,severity').eq('id',body.notification_id).single();notification=result.data??undefined}
  if(!notification?.id||!notification.user_id)return json({error:'invalid_notification'},400)
  const{subscriptions,error}=await (async()=>{const result=await admin.from('push_subscriptions').select('id,endpoint,p256dh,auth_key').eq('user_id',notification!.user_id).eq('enabled',true);return{subscriptions:result.data??[],error:result.error}})()
  if(error)return json({error:error.message},500)
  webpush.setVapidDetails(subject,publicKey,privateKey)
  const payload=JSON.stringify({id:notification.id,title:notification.title,body:notification.body,link:notification.link,severity:notification.severity})
  let sent=0
  for(const subscription of subscriptions){try{await webpush.sendNotification({endpoint:subscription.endpoint,keys:{p256dh:subscription.p256dh,auth:subscription.auth_key}},payload);sent++}catch(err){const status=(err as {statusCode?:number}).statusCode;if(status===404||status===410)await admin.from('push_subscriptions').delete().eq('id',subscription.id)}}
  return json({sent})
})
