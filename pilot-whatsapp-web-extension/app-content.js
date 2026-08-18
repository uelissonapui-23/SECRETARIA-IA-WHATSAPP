(()=>{
 let busy=false;
 async function drain(){if(busy)return;busy=true;try{const r=await chrome.runtime.sendMessage({type:'SECRETARIA_PILOT_DRAIN'});if(r?.items?.length)window.dispatchEvent(new CustomEvent('secretaria:pilot-whatsapp-messages',{detail:{items:r.items}}));window.dispatchEvent(new CustomEvent('secretaria:pilot-whatsapp-status',{detail:{installed:true}}))}catch{}finally{busy=false}}
 window.addEventListener('secretaria:pilot-request-status',drain);setInterval(drain,2500);drain()
})()
