export type PilotWhatsAppMessage={id:string;contact_name:string;body:string;captured_at:string;source:'whatsapp_web_visible_readonly'}
export function validPilotMessages(value:unknown):PilotWhatsAppMessage[]{
 const items=(value as {items?:PilotWhatsAppMessage[]}|null)?.items
 if(!Array.isArray(items))return []
 return items.filter(x=>Boolean(x)&&typeof x.id==='string'&&typeof x.contact_name==='string'&&typeof x.body==='string'&&x.body.trim().length>0&&x.body.length<=4000&&x.source==='whatsapp_web_visible_readonly').slice(0,100)
}
