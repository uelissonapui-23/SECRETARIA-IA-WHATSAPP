const KEY='secretariaPilotQueue', MAX=300;
async function getQ(){return (await chrome.storage.local.get({[KEY]:[]}))[KEY]||[]}
async function setQ(q){await chrome.storage.local.set({[KEY]:q.slice(-MAX)})}
chrome.runtime.onMessage.addListener((m,s,reply)=>{
 if(m?.type==='SECRETARIA_PILOT_ENQUEUE'){(async()=>{const q=await getQ(), ids=new Set(q.map(x=>x.id)); for(const x of m.items||[])if(x?.id&&!ids.has(x.id)){q.push(x);ids.add(x.id)} await setQ(q);reply({ok:true})})();return true}
 if(m?.type==='SECRETARIA_PILOT_DRAIN'){(async()=>{const q=await getQ();await setQ([]);reply({ok:true,items:q})})();return true}
 if(m?.type==='SECRETARIA_PILOT_STATUS'){(async()=>reply({ok:true,queued:(await getQ()).length}))();return true}
});
