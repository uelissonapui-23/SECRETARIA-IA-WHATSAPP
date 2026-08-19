import { useEffect, useState, type ChangeEvent } from 'react'
import { Image, Save, Upload } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Branding } from '../branding/BrandingProvider'

type AssetKey=Exclude<keyof Branding,'app_name'|'short_name'>
const assets:Array<{key:AssetKey;label:string;help:string;accept:string}>=[
  {key:'full_logo_url',label:'Logo completa',help:'1200 × 400 px · PNG, WebP ou SVG · fundo transparente',accept:'image/png,image/webp,image/svg+xml'},
  {key:'menu_logo_url',label:'Logo da barra de menus',help:'512 × 512 px · versão compacta e legível',accept:'image/png,image/webp,image/svg+xml'},
  {key:'login_logo_url',label:'Logo do login',help:'1200 × 600 px · composição horizontal ou completa',accept:'image/png,image/webp,image/svg+xml'},
  {key:'favicon_url',label:'Favicon e aba do navegador',help:'64 × 64 px · PNG ou ICO',accept:'image/png,image/x-icon'},
  {key:'app_icon_192_url',label:'Ícone do app · pequeno',help:'192 × 192 px · PNG quadrado, sem transparência excessiva',accept:'image/png'},
  {key:'app_icon_512_url',label:'Ícone do app · grande',help:'512 × 512 px · PNG quadrado para instalação',accept:'image/png'},
]

export function MasterBrandingPanel(){
  const[form,setForm]=useState<Branding|null>(null);const[busy,setBusy]=useState('');const[message,setMessage]=useState('');const[error,setError]=useState('')
  useEffect(()=>{void supabase.from('platform_branding').select('*').eq('id',1).single().then(({data,error})=>{if(error)setError(error.message);else setForm(data as Branding)})},[])
  async function upload(key:AssetKey,event:ChangeEvent<HTMLInputElement>){const file=event.target.files?.[0];if(!file||!form)return;setBusy(key);setError('');const extension=file.name.split('.').pop()?.toLowerCase()||'png';const path=`${key}.${extension}`;const{error:uploadError}=await supabase.storage.from('platform-branding').upload(path,file,{upsert:true,cacheControl:'60'});if(uploadError){setError(uploadError.message);setBusy('');return}const{data}=supabase.storage.from('platform-branding').getPublicUrl(path);setForm({...form,[key]:`${data.publicUrl}?v=${Date.now()}`});setBusy('')}
  async function save(){if(!form)return;setBusy('save');setError('');setMessage('');const{error}=await supabase.from('platform_branding').upsert({id:1,...form,updated_at:new Date().toISOString()});if(error)setError(error.message);else setMessage('Identidade visual atualizada. Recarregue o app para visualizar em todas as áreas.');setBusy('')}
  if(!form)return <div className="panel-card">Carregando identidade visual...</div>
  return <div className="branding-admin"><div className="master-section-bar"><div><span className="eyebrow">IDENTIDADE VISUAL</span><h2>Marca em todos os pontos do aplicativo</h2><p>Envie cada arquivo no formato indicado. A prévia aparece antes de salvar.</p></div><button className="primary-button" disabled={busy==='save'} onClick={()=>void save()}><Save size={16}/>{busy==='save'?'Salvando...':'Salvar e aplicar'}</button></div>{error&&<div className="form-error">{error}</div>}{message&&<div className="form-success">{message}</div>}<div className="panel-card branding-names"><label><span>Nome completo do aplicativo</span><input value={form.app_name} onChange={e=>setForm({...form,app_name:e.target.value})}/></label><label><span>Nome curto</span><input maxLength={20} value={form.short_name} onChange={e=>setForm({...form,short_name:e.target.value})}/></label></div><div className="branding-assets-grid">{assets.map(asset=><article className="panel-card branding-asset" key={asset.key}><div className="branding-preview">{form[asset.key]?<img src={form[asset.key]||''} alt={asset.label}/>:<Image size={34}/>}</div><div><h3>{asset.label}</h3><p>{asset.help}</p><label className="secondary-button branding-upload"><Upload size={15}/>{busy===asset.key?'Enviando...':'Escolher imagem'}<input type="file" hidden accept={asset.accept} disabled={Boolean(busy)} onChange={e=>void upload(asset.key,e)}/></label>{form[asset.key]&&<button className="text-action" onClick={()=>setForm({...form,[asset.key]:null})}>Remover</button>}</div></article>)}</div></div>
}
