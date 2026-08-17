export type EvaluationScore={total:number;passed:number;score:number;regressions:number}
export function normalizeTypes(types:string[]){return [...new Set(types.map(v=>v.trim()).filter(Boolean))].sort()}
export function exactTypeMatch(expected:string[],detected:string[]){const a=normalizeTypes(expected),b=normalizeTypes(detected);return a.length===b.length&&a.every((v,i)=>v===b[i])}
export function scoreEvaluation(rows:Array<{passed:boolean;regression?:boolean}>):EvaluationScore{const total=rows.length,passed=rows.filter(r=>r.passed).length,regressions=rows.filter(r=>r.regression).length;return{total,passed,score:total?passed/total:0,regressions}}
export function releaseLabel(state:'locked'|'pilot'|'enabled'){return state==='enabled'?'Liberada':state==='pilot'?'Piloto':'Bloqueada'}
