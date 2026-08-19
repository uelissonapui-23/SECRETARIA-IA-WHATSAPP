type AppointmentTimeData={starts_at?:unknown;when_text?:unknown;time_text?:unknown}

const partsInZone=(date:Date,timeZone:string)=>Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)])) as Record<string,number>
const offsetAt=(epoch:number,timeZone:string)=>{const p=partsInZone(new Date(epoch),timeZone);return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)-epoch}

export function appointmentStartUtc(data:AppointmentTimeData,referenceIso:string,timeZone='America/Manaus'){
  if(typeof data.starts_at==='string'){
    const explicit=new Date(data.starts_at)
    if(!Number.isNaN(explicit.getTime()))return explicit.toISOString()
  }
  const reference=new Date(referenceIso);if(Number.isNaN(reference.getTime()))return null
  const when=typeof data.when_text==='string'?data.when_text.toLocaleLowerCase('pt-BR'):''
  const time=typeof data.time_text==='string'?data.time_text:''
  const clock=time.match(/([01]?\d|2[0-3])(?::|h)?([0-5]\d)?/i);if(!clock)return null
  const local=partsInZone(reference,timeZone);const calendar=new Date(Date.UTC(local.year,local.month-1,local.day))
  if(/depois de amanh[ãa]/i.test(when))calendar.setUTCDate(calendar.getUTCDate()+2)
  else if(/amanh[ãa]|amnh/i.test(when))calendar.setUTCDate(calendar.getUTCDate()+1)
  else if(!/hoje|hj/i.test(when)){const d=when.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);if(!d)return null;calendar.setUTCFullYear(d[3]?Number(d[3].length===2?`20${d[3]}`:d[3]):local.year,Number(d[2])-1,Number(d[1]))}
  const naive=Date.UTC(calendar.getUTCFullYear(),calendar.getUTCMonth(),calendar.getUTCDate(),Number(clock[1]),Number(clock[2]??0),0)
  let utc=naive-offsetAt(naive,timeZone);utc=naive-offsetAt(utc,timeZone)
  return new Date(utc).toISOString()
}

export function learnedAppointmentConfidence(raw:number,correct:number,incorrect:number,minSamples:number){
  const samples=correct+incorrect
  if(samples<minSamples)return {confidence:raw,samples,accuracy:samples?correct/samples:0,eligible:false}
  const accuracy=correct/samples
  const adjustment=Math.max(-.08,Math.min(.08,(accuracy-.5)*.16))
  return {confidence:Math.max(0,Math.min(.99,raw+adjustment)),samples,accuracy,eligible:true}
}
