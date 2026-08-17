export type ReleaseEvidence={runs:number;avgScore:number;regressions:number;severeRegressions:number;companies:number;quarantined:boolean}
export function evidenceState(e:ReleaseEvidence){
  if(e.quarantined||e.severeRegressions>0)return 'risk' as const
  if(e.runs<3)return 'insufficient' as const
  if(e.avgScore>=.9&&e.regressions===0)return 'healthy' as const
  return 'attention' as const
}
export function evidenceLabel(state:ReturnType<typeof evidenceState>){return state==='healthy'?'Evidência saudável':state==='risk'?'Risco / quarentena':state==='attention'?'Revisar evidências':'Evidência insuficiente'}
export function shouldAutoRollback(input:{severe:boolean;hasPrevious:boolean;autoLock:boolean}){return input.severe&&input.hasPrevious&&input.autoLock}
