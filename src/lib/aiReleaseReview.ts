export type ReleaseHealth='healthy'|'attention'|'critical'|'unknown'
export function releaseHealthLabel(v:ReleaseHealth){return v==='healthy'?'Saudável':v==='attention'?'Atenção':v==='critical'?'Crítica':'Sem evidência'}
export function checklistReady(input:{hasRuns:boolean;score:number;regressions:number;severe:number;quarantined:boolean}){return input.hasRuns&&input.score>=.8&&input.regressions===0&&input.severe===0&&!input.quarantined}
