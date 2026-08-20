import { useEffect, useState } from 'react'
import { BellRing, Download, Smartphone, Volume2 } from 'lucide-react'
import { getDeviceAlertPreferences, notificationSupport, previewAlertSound, requestDeviceNotificationPermission, saveDeviceAlertPreferences, type AlertSound } from '../lib/deviceNotifications'
import { getPwaInstallPrompt, isPwaInstalled, subscribePwaInstall } from '../lib/pwaInstall'
import { useAuth } from '../auth/AuthProvider'
import { useCompany } from '../company/CompanyProvider'
import { supabase } from '../lib/supabase'

function vapidKey(value:string){const padding='='.repeat((4-value.length%4)%4),raw=atob((value+padding).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...raw].map(char=>char.charCodeAt(0)))}

export function DeviceAlertsPanel(){
  const{user}=useAuth(),{currentCompany}=useCompany()
  const[preferences,setPreferences]=useState(getDeviceAlertPreferences)
  const[permission,setPermission]=useState<NotificationPermission|'unsupported'>(()=>notificationSupport()?Notification.permission:'unsupported')
  const[installed,setInstalled]=useState(isPwaInstalled)
  const[installReady,setInstallReady]=useState(()=>Boolean(getPwaInstallPrompt()))
  const[installHelp,setInstallHelp]=useState(false)
  const[pushStatus,setPushStatus]=useState<'idle'|'busy'|'active'|'unavailable'|'error'>('idle')
  const[testStatus,setTestStatus]=useState<'idle'|'busy'|'sent'|'error'>('idle')
  useEffect(()=>subscribePwaInstall(()=>{setInstalled(isPwaInstalled());setInstallReady(Boolean(getPwaInstallPrompt()))}),[])
  function update(patch:Partial<typeof preferences>){const next={...preferences,...patch};setPreferences(next);saveDeviceAlertPreferences(next)}
  useEffect(()=>{if(!('serviceWorker'in navigator)||!('PushManager'in window))return;void navigator.serviceWorker.ready.then(registration=>registration.pushManager.getSubscription()).then(subscription=>setPushStatus(subscription?'active':'idle'))},[])
  async function activate(){
    const result=await requestDeviceNotificationPermission();setPermission(result)
    if(result!=='granted'||!user||!currentCompany||!('PushManager'in window))return
    setPushStatus('busy')
    try{
      const{data,error}=await supabase.functions.invoke('send-web-push',{body:{action:'public_key'}})
      if(error||!data?.public_key){setPushStatus('unavailable');return}
      const registration=await navigator.serviceWorker.ready
      const subscription=await registration.pushManager.getSubscription()||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidKey(data.public_key)})
      const serialized=subscription.toJSON(),keys=serialized.keys
      if(!serialized.endpoint||!keys?.p256dh||!keys.auth)throw new Error('Assinatura incompleta')
      const{error:saveError}=await supabase.from('push_subscriptions').upsert({company_id:currentCompany.id,user_id:user.id,endpoint:serialized.endpoint,p256dh:keys.p256dh,auth_key:keys.auth,user_agent:navigator.userAgent,enabled:true},{onConflict:'endpoint'})
      if(saveError)throw saveError
      setPushStatus('active')
    }catch{setPushStatus('error')}
  }
  async function install(){const prompt=getPwaInstallPrompt();if(!prompt){setInstallHelp(true);return}await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')setInstalled(true);else setInstallHelp(true)}
  async function testPush(){if(!currentCompany)return;setTestStatus('busy');const{data,error}=await supabase.functions.invoke('send-web-push',{body:{action:'test_push',company_id:currentCompany.id}});setTestStatus(error||!data?.queued?'error':'sent')}
  return <div className="settings-card colorful-card device-alert-card">
    <div className="settings-card-title"><span className="settings-icon coral"><BellRing size={20}/></span><div><h2>Alertas no computador e celular</h2><p>Receba avisos usando outra tela e abra diretamente a situação que precisa ser resolvida.</p></div></div>
    <div className="device-alert-status"><Smartphone size={19}/><div><strong>{pushStatus==='active'?'Alertas ativos mesmo com o app fechado':permission==='granted'?'Alertas locais ativados':permission==='denied'?'Alertas bloqueados pelo aparelho':permission==='unsupported'?'Este navegador não oferece alertas':'Ativação necessária'}</strong><span>{pushStatus==='unavailable'?'A chave do servidor ainda precisa ser configurada. Os alertas com o app aberto continuam funcionando.':pushStatus==='error'?'Não foi possível registrar este aparelho. Tente novamente depois da publicação do servidor.':permission==='denied'?'Libere as notificações nas configurações do navegador ou aparelho.':'Som personalizado funciona com o app aberto; fechado, será usado o som do sistema.'}</span></div></div>
    <div className="preference-grid"><label className="preference-tile coral"><input type="checkbox" checked={preferences.enabled} onChange={e=>update({enabled:e.target.checked})}/><span className="preference-icon"><BellRing size={19}/></span><span><strong>Alertas visuais</strong><small>Notificação, balão no ícone e acesso à situação.</small></span></label><label className="preference-tile mint"><input type="checkbox" checked={preferences.vibration} onChange={e=>update({vibration:e.target.checked})}/><span className="preference-icon"><Smartphone size={19}/></span><span><strong>Vibração</strong><small>Usada em celulares compatíveis.</small></span></label></div>
    <div className="device-sound-row"><label><span>Som com o app aberto</span><select value={preferences.sound} onChange={e=>update({sound:e.target.value as AlertSound})}><option value="soft">Suave</option><option value="chime">Campainha</option><option value="alarm">Despertador</option><option value="silent">Sem som</option></select></label><button type="button" className="secondary-button" onClick={()=>previewAlertSound(preferences.sound)}><Volume2 size={17}/>Testar som</button></div>
    <div className="heading-actions">{pushStatus!=='active'&&permission!=='unsupported'&&<button type="button" className="primary-button" disabled={pushStatus==='busy'} onClick={()=>void activate()}><BellRing size={17}/>{pushStatus==='busy'?'Ativando...':'Ativar alertas neste aparelho'}</button>}{pushStatus==='active'&&<button type="button" className="secondary-button" disabled={testStatus==='busy'} onClick={()=>void testPush()}><BellRing size={17}/>{testStatus==='busy'?'Enviando...':'Enviar alerta de teste'}</button>}{!installed&&<button type="button" className="secondary-button" onClick={()=>void install()}><Download size={17}/>{installReady?'Instalar aplicativo':'Como instalar'}</button>}{installed&&<span className="mini-status success">Aplicativo instalado</span>}</div>
    {testStatus==='sent'&&<p className="device-help">Alerta enviado. Minimize o navegador e confirme se ele apareceu no aparelho.</p>}
    {testStatus==='error'&&<p className="form-error">Não foi possível enviar o alerta de teste. Confira os registros da função send-web-push.</p>}
    {permission==='default'&&<p className="device-help">A pergunta de permissão aparece depois que você tocar em “Ativar alertas”.</p>}
    {installHelp&&<div className="device-install-help"><strong>Instalação manual</strong><span><b>Android/Chrome:</b> menu ⋮ → Adicionar à tela inicial ou Instalar app.</span><span><b>iPhone/iPad/Safari:</b> Compartilhar → Adicionar à Tela de Início.</span><span><b>Computador/Chrome ou Edge:</b> ícone de instalação no fim da barra de endereço ou menu → Instalar evoria.</span></div>}
  </div>
}
