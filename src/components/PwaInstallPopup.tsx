import { useEffect, useState } from 'react'
import { Download, MonitorSmartphone, Share, X } from 'lucide-react'
import { getPwaInstallPrompt, isPwaInstalled, subscribePwaInstall } from '../lib/pwaInstall'

const dismissalKey='evoria-pwa-install-dismissed-v2'
function isAppleMobile(){return /iphone|ipad|ipod/i.test(navigator.userAgent)}

export function PwaInstallPopup(){
  const[visible,setVisible]=useState(false),[installReady,setInstallReady]=useState(()=>Boolean(getPwaInstallPrompt())),[instructions,setInstructions]=useState(false)
  useEffect(()=>{
    if(isPwaInstalled())return
    const dismissed=Number(localStorage.getItem(dismissalKey)||0)
    if(Date.now()-dismissed>24*60*60*1000){const timer=window.setTimeout(()=>setVisible(true),1800);return()=>window.clearTimeout(timer)}
  },[])
  useEffect(()=>subscribePwaInstall(()=>{setInstallReady(Boolean(getPwaInstallPrompt()));if(!isPwaInstalled())setVisible(true)}),[])
  function close(){localStorage.setItem(dismissalKey,String(Date.now()));setVisible(false)}
  async function install(){
    const prompt=getPwaInstallPrompt()
    if(!prompt||isAppleMobile()){setInstructions(true);return}
    await prompt.prompt();const choice=await prompt.userChoice
    if(choice.outcome==='accepted')setVisible(false);else setInstructions(true)
  }
  if(!visible||isPwaInstalled())return null
  return <div className="pwa-install-backdrop" role="dialog" aria-modal="true" aria-labelledby="pwa-install-title"><section className="pwa-install-popup"><button className="icon-button pwa-install-close" onClick={close} aria-label="Fechar"><X size={18}/></button><div className="pwa-install-symbol"><MonitorSmartphone size={30}/></div><span className="eyebrow">APLICATIVO EVORIA</span><h2 id="pwa-install-title">Instale para receber alertas com mais facilidade</h2><p>Tenha a evoria na tela inicial, com acesso rápido, notificações e contador de situações pendentes.</p>{instructions||(!installReady&&isAppleMobile())?<div className="pwa-install-steps"><Share size={20}/><div><strong>{isAppleMobile()?'No iPhone ou iPad':'Instalação pelo navegador'}</strong><span>{isAppleMobile()?'Toque em Compartilhar e depois em “Adicionar à Tela de Início”.':'Abra o menu do Chrome ou Edge e escolha “Instalar evoria” ou “Adicionar à tela inicial”.'}</span></div></div>:null}<div className="pwa-install-actions"><button className="secondary-button" onClick={close}>Agora não</button><button className="primary-button" onClick={()=>void install()}><Download size={17}/>{installReady&&!isAppleMobile()?'Instalar aplicativo':'Ver como instalar'}</button></div></section></div>
}
