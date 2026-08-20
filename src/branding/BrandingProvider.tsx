import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

export type Branding={app_name:string;short_name:string;full_logo_url:string|null;menu_logo_url:string|null;login_logo_url:string|null;favicon_url:string|null;app_icon_192_url:string|null;app_icon_512_url:string|null;full_logo_light_url:string|null;full_logo_dark_url:string|null;menu_logo_light_url:string|null;menu_logo_dark_url:string|null;login_logo_light_url:string|null;login_logo_dark_url:string|null;icon_light_url:string|null;icon_dark_url:string|null;favicon_light_url:string|null;favicon_dark_url:string|null}
const fallback:Branding={app_name:'evoria Secretaria IA',short_name:'evoria',full_logo_url:null,menu_logo_url:null,login_logo_url:null,favicon_url:null,app_icon_192_url:null,app_icon_512_url:null,full_logo_light_url:null,full_logo_dark_url:null,menu_logo_light_url:null,menu_logo_dark_url:null,login_logo_light_url:null,login_logo_dark_url:null,icon_light_url:null,icon_dark_url:null,favicon_light_url:null,favicon_dark_url:null}
const BrandingContext=createContext<Branding>(fallback)

export function BrandingProvider({children}:{children:ReactNode}){
  const[value,setValue]=useState(fallback)
  useEffect(()=>{void supabase.rpc('get_platform_branding').then(({data})=>{if(data)setValue({...fallback,...data} as Branding)})},[])
  useEffect(()=>{
    document.title=value.app_name
    const dark=window.matchMedia('(prefers-color-scheme: dark)').matches
    const favicon=(dark?value.favicon_dark_url:value.favicon_light_url)||value.favicon_url||value.app_icon_192_url||'/icon.svg';let icon=document.querySelector<HTMLLinkElement>('link[rel="icon"]');if(!icon){icon=document.createElement('link');icon.rel='icon';document.head.appendChild(icon)}icon.href=favicon
  },[value])
  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>
}
export const useBranding=()=>useContext(BrandingContext)
