(()=>{
 const seen=new Set();
 const txt=e=>(e?.innerText||e?.textContent||'').trim();
 function contact(){const h=document.querySelector('#main header'); if(!h)return 'Contato do WhatsApp'; const e=h.querySelector('span[title]')||h.querySelector('[dir="auto"]'); return e?.getAttribute?.('title')||txt(e)||'Contato do WhatsApp'}
 function body(r){const c=r.querySelector('[data-pre-plain-text]'); return txt(c?.querySelector('span.selectable-text')||r.querySelector('span.selectable-text')||c||r)}
 function id(r,c,b){const explicit=r.getAttribute('data-id')||r.querySelector('[data-id]')?.getAttribute('data-id');if(explicit)return explicit;let h=2166136261;for(const ch of `${c}|${b}`){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return `visible-${(h>>>0).toString(16)}`}
 function scan(){const main=document.querySelector('#main');if(!main)return;const c=contact(),items=[];for(const r of main.querySelectorAll('.message-in')){const b=body(r);if(!b||b.length>4000)continue;const k=id(r,c,b);if(seen.has(k))continue;seen.add(k);items.push({id:k,contact_name:c,body:b,captured_at:new Date().toISOString(),source:'whatsapp_web_visible_readonly'})}if(items.length)chrome.runtime.sendMessage({type:'SECRETARIA_PILOT_ENQUEUE',items}).catch(()=>{});if(seen.size>2000){const a=[...seen].slice(-1000);seen.clear();a.forEach(x=>seen.add(x))}}
 new MutationObserver(()=>setTimeout(scan,350)).observe(document.documentElement,{childList:true,subtree:true});setInterval(scan,5000);scan()
})()
