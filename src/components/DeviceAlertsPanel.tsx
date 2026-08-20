import { useEffect, useState } from 'react'
import { BellRing, Download, Smartphone, Volume2 } from 'lucide-react'
import { getDeviceAlertPreferences, notificationSupport, previewAlertSound, requestDeviceNotificationPermission, saveDeviceAlertPreferences, type AlertSound } from '../lib/deviceNotifications'
import { getPwaInstallPrompt, isPwaInstalled, subscribePwaInstall } from '../lib/pwaInstall'

export function DeviceAlertsPanel(){
  const[preferences,setPreferences]=useState(getDeviceAlertPreferences)
  const[permission,setPermission]=useState<NotificationPermission|'unsupported'>(()=>notificationSupport()?Notification.permission:'unsupported')
  const[installed,setInstalled]=useState(isPwaInstalled)
  const[installReady,setInstallReady]=useState(()=>Boolean(getPwaInstallPrompt()))
  const[installHelp,setInstallHelp]=useState(false)
  useEffect(()=>subscribePwaInstall(()=>{setInstalled(isPwaInstalled());setInstallReady(Boolean(getPwaInstallPrompt()))}),[])
  function update(patch:Partial<typeof preferences>){const next={...preferences,...patch};setPreferences(next);saveDeviceAlertPreferences(next)}
  async function activate(){setPermission(await requestDeviceNotificationPermission())}
  async function install(){const prompt=getPwaInstallPrompt();if(!prompt){setInstallHelp(true);return}await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')setInstalled(true);else setInstallHelp(true)}
  return <div className="settings-card colorful-card device-alert-card">
    <div className="settings-card-title"><span className="settings-icon coral"><BellRing size={20}/></span><div><h2>Alertas no computador e celular</h2><p>Receba avisos usando outra tela e abra diretamente a situação que precisa ser resolvida.</p></div></div>
    <div className="device-alert-status"><Smartphone size={19}/><div><strong>{permission==='granted'?'Alertas do sistema ativados':permission==='denied'?'Alertas bloqueados pelo aparelho':permission==='unsupported'?'Este navegador não oferece alertas':'Ativação necessária'}</strong><span>{permission==='denied'?'Libere as notificações nas configurações do navegador ou aparelho.':'Som personalizado funciona com o app aberto; fechado, será usado o som do sistema.'}</span></div></div>
    <div className="preference-grid"><label className="preference-tile coral"><input type="checkbox" checked={preferences.enabled} onChange={e=>update({enabled:e.target.checked})}/><span className="preference-icon"><BellRing size={19}/></span><span><strong>Alertas visuais</strong><small>Notificação, balão no ícone e acesso à situação.</small></span></label><label className="preference-tile mint"><input type="checkbox" checked={preferences.vibration} onChange={e=>update({vibration:e.target.checked})}/><span className="preference-icon"><Smartphone size={19}/></span><span><strong>Vibração</strong><small>Usada em celulares compatíveis.</small></span></label></div>
    <div className="device-sound-row"><label><span>Som com o app aberto</span><select value={preferences.sound} onChange={e=>update({sound:e.target.value as AlertSound})}><option value="soft">Suave</option><option value="chime">Campainha</option><option value="alarm">Despertador</option><option value="silent">Sem som</option></select></label><button type="button" className="secondary-button" onClick={()=>previewAlertSound(preferences.sound)}><Volume2 size={17}/>Testar som</button></div>
    <div className="heading-actions">{permission!=='granted'&&permission!=='unsupported'&&<button type="button" className="primary-button" onClick={()=>void activate()}><BellRing size={17}/>Ativar alertas</button>}{!installed&&<button type="button" className="secondary-button" onClick={()=>void install()}><Download size={17}/>{installReady?'Instalar aplicativo':'Como instalar'}</button>}{installed&&<span className="mini-status success">Aplicativo instalado</span>}</div>
    {permission==='default'&&<p className="device-help">A pergunta de permissão aparece depois que você tocar em “Ativar alertas”.</p>}
    {installHelp&&<div className="device-install-help"><strong>Instalação manual</strong><span><b>Android/Chrome:</b> menu ⋮ → Adicionar à tela inicial ou Instalar app.</span><span><b>iPhone/iPad/Safari:</b> Compartilhar → Adicionar à Tela de Início.</span><span><b>Computador/Chrome ou Edge:</b> ícone de instalação no fim da barra de endereço ou menu → Instalar evoria.</span></div>}
  </div>
}
