export type QualitySummary={total:number;correct:number;incorrect:number;missed:number;accuracy:number}
export function qualitySummary(rows:Array<{verdict:'correct'|'incorrect'|'missed'}>):QualitySummary{
 const total=rows.length,correct=rows.filter(r=>r.verdict==='correct').length,incorrect=rows.filter(r=>r.verdict==='incorrect').length,missed=rows.filter(r=>r.verdict==='missed').length
 return{total,correct,incorrect,missed,accuracy:total?correct/total:0}
}
export function qualityLabel(accuracy:number,total:number){if(!total)return'Sem avaliações';if(accuracy>=.9)return'Excelente';if(accuracy>=.75)return'Boa';if(accuracy>=.6)return'Em ajuste';return'Requer atenção'}
