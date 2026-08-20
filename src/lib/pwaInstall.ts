export type PwaInstallPrompt = Event & { prompt:()=>Promise<void>; userChoice:Promise<{outcome:'accepted'|'dismissed'}> }

let deferredPrompt:PwaInstallPrompt|null=null
const listeners=new Set<()=>void>()
const notify=()=>listeners.forEach(listener=>listener())

window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredPrompt=event as PwaInstallPrompt;notify()})
window.addEventListener('appinstalled',()=>{deferredPrompt=null;notify()})

export function getPwaInstallPrompt(){return deferredPrompt}
export function subscribePwaInstall(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener)}}
export function isPwaInstalled(){return window.matchMedia('(display-mode: standalone)').matches||('standalone'in navigator&&(navigator as Navigator&{standalone?:boolean}).standalone===true)}
