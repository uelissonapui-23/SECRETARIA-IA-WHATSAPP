import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

export function useOperationalAutoRefresh(companyId:string|undefined, refresh:()=>void|Promise<void>, tables:string[], intervalMs=15_000){
  const refreshRef=useRef(refresh)
  refreshRef.current=refresh
  const tablesKey=tables.join(',')

  useEffect(()=>{
    if(!companyId)return
    let debounce:number|undefined
    const run=()=>{
      if(document.visibilityState!=='visible')return
      window.clearTimeout(debounce)
      debounce=window.setTimeout(()=>void refreshRef.current(),350)
    }
    const channel=supabase.channel(`auto-refresh-${companyId}-${tablesKey}`)
    for(const table of tablesKey.split(','))channel.on('postgres_changes',{event:'*',schema:'public',table,filter:`company_id=eq.${companyId}`},run)
    void channel.subscribe()
    const timer=window.setInterval(run,intervalMs)
    window.addEventListener('focus',run)
    document.addEventListener('visibilitychange',run)
    return()=>{
      window.clearInterval(timer);window.clearTimeout(debounce)
      window.removeEventListener('focus',run);document.removeEventListener('visibilitychange',run)
      void supabase.removeChannel(channel)
    }
  },[companyId,intervalMs,tablesKey])
}
