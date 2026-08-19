import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

export type Branding={app_name:string;short_name:string;full_logo_url:string|null;menu_logo_url:string|null;login_logo_url:string|null;favicon_url:string|null;app_icon_192_url:string|null;app_icon_512_url:string|null}
const fallback:Branding={app_name:'evoria Secretaria IA',short_name:'evoria',full_logo_url:null,menu_logo_url:null,login_logo_url:null,favicon_url:null,app_icon_192_url:null,app_icon_512_url:null}
const BrandingContext=createContext<Branding>(fallback)

export function BrandingProvider({children}:{children:ReactNode}){
  const[value,setValue]=useState(fallback)
  useEffect(()=>{void supabase.rpc('get_platform_branding').then(({data})=>{if(data)setValue({...fallback,...data} as Branding)})},[])
  useEffect(()=>{
    document.title=value.app_name
    const favicon=value.favicon_url||value.app_icon_192_url||'/icon.svg';let icon=document.querySelector<HTMLLinkElement>('link[rel="icon"]');if(!icon){icon=document.createElement('link');icon.rel='icon';document.head.appendChild(icon)}icon.href=favicon
    const manifest={name:value.app_name,short_name:value.short_name,display:'standalone',start_url:'/',scope:'/',theme_color:'#0f172a',background_color:'#f8fafc',icons:[value.app_icon_192_url&&{src:value.app_icon_192_url,sizes:'192x192',type:'image/png'},value.app_icon_512_url&&{src:value.app_icon_512_url,sizes:'512x512',type:'image/png'}].filter(Boolean)};const blob=URL.createObjectURL(new Blob([JSON.stringify(manifest)],{type:'application/manifest+json'}));let link=document.querySelector<HTMLLinkElement>('link[rel="manifest"]');if(!link){link=document.createElement('link');link.rel='manifest';document.head.appendChild(link)}link.href=blob;return()=>URL.revokeObjectURL(blob)
  },[value])
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
}
export const useBranding=()=>useContext(BrandingContext)
