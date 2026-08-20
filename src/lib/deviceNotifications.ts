export type AlertSound = 'soft' | 'chime' | 'alarm' | 'silent'
export type DeviceAlertPreferences = { enabled: boolean; sound: AlertSound; vibration: boolean }

const storageKey = 'evoria-device-alerts-v1'
const defaults: DeviceAlertPreferences = { enabled: true, sound: 'chime', vibration: true }

export function getDeviceAlertPreferences(): DeviceAlertPreferences {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(storageKey) ?? '{}') } }
  catch { return defaults }
}
export function saveDeviceAlertPreferences(value: DeviceAlertPreferences) {
  localStorage.setItem(storageKey, JSON.stringify(value))
  window.dispatchEvent(new CustomEvent('evoria-alert-preferences'))
}
export function notificationSupport() { return 'Notification' in window && 'serviceWorker' in navigator }
export async function requestDeviceNotificationPermission() {
  if (!notificationSupport()) return 'unsupported' as const
  return Notification.requestPermission()
}
function tone(sound: AlertSound) {
  if (sound === 'silent') return
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return
  const context = new AudioContextClass()
  const sequences: Record<Exclude<AlertSound, 'silent'>, Array<[number, number, number]>> = { soft:[[660,0,.12]], chime:[[660,0,.12],[880,.14,.17]], alarm:[[880,0,.14],[660,.18,.14],[880,.36,.18]] }
  for (const [frequency, delay, duration] of sequences[sound]) {
    const oscillator=context.createOscillator(), gain=context.createGain()
    oscillator.frequency.value=frequency; gain.gain.setValueAtTime(.0001,context.currentTime+delay); gain.gain.exponentialRampToValueAtTime(.16,context.currentTime+delay+.015); gain.gain.exponentialRampToValueAtTime(.0001,context.currentTime+delay+duration)
    oscillator.connect(gain).connect(context.destination); oscillator.start(context.currentTime+delay); oscillator.stop(context.currentTime+delay+duration+.03)
  }
  window.setTimeout(()=>void context.close(),900)
}
export function previewAlertSound(sound: AlertSound) { tone(sound) }
export async function updateAppBadge(count: number) {
  const api=navigator as Navigator&{setAppBadge?:(value?:number)=>Promise<void>;clearAppBadge?:()=>Promise<void>}
  try { if(count>0) await api.setAppBadge?.(count); else await api.clearAppBadge?.() } catch { /* optional API */ }
}
export async function showDeviceAlert(input:{id:string;title:string;body?:string|null;link?:string|null;severity?:string}) {
  const preferences=getDeviceAlertPreferences()
  if(!preferences.enabled||!notificationSupport()||Notification.permission!=='granted')return
  if(document.visibilityState==='visible'){tone(preferences.sound);if(preferences.vibration&&'vibrate'in navigator)navigator.vibrate([180,80,180])}
  const registration=await navigator.serviceWorker.ready
  await registration.showNotification(input.title,{body:input.body??'Abra a evoria para verificar.',icon:'/icon.svg',badge:'/icon.svg',tag:`evoria-${input.id}`,renotify:true,requireInteraction:input.severity==='danger',vibrate:preferences.vibration?[220,100,220]:undefined,data:{url:input.link||'/',notificationId:input.id},actions:[{action:'resolve',title:'Abrir e resolver'}]} as NotificationOptions)
}
