type ExtractedAppointmentData={starts_at?:unknown;when_text?:unknown;time_text?:unknown}

function validDate(value:unknown){
  if(typeof value!=='string'||!value.trim())return null
  const parsed=new Date(value)
  return Number.isNaN(parsed.getTime())?null:parsed
}

export function resolveAppointmentStart(data:ExtractedAppointmentData,referenceIso:string){
  const explicit=validDate(data.starts_at)
  if(explicit)return explicit.toISOString()
  const reference=new Date(referenceIso)
  if(Number.isNaN(reference.getTime()))return null
  const when=typeof data.when_text==='string'?data.when_text.trim().toLowerCase():''
  const time=typeof data.time_text==='string'?data.time_text.trim().toLowerCase():''
  const clock=time.match(/\b([01]?\d|2[0-3])(?:\s*(?:h|:)\s*([0-5]\d)?)?\b/i)
  if(!clock)return null
  const result=new Date(reference)
  result.setSeconds(0,0)
  if(/amanh[ãa]/i.test(when))result.setDate(result.getDate()+1)
  else{
    const numericDate=when.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/)
    if(numericDate){
      const year=numericDate[3]?Number(numericDate[3].length===2?`20${numericDate[3]}`:numericDate[3]):result.getFullYear()
      result.setFullYear(year,Number(numericDate[2])-1,Number(numericDate[1]))
    }else if(!/hoje/i.test(when))return null
  }
  result.setHours(Number(clock[1]),Number(clock[2]??0),0,0)
  return result.toISOString()
}
