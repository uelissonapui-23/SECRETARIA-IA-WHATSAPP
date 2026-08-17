import{describe,expect,it}from'vitest'
import{evidenceLabel,evidenceState,shouldAutoRollback}from'./aiReleaseSafety'
describe('ai release safety',()=>{
 it('classifica evidência saudável somente com amostra suficiente',()=>{expect(evidenceState({runs:4,avgScore:.95,regressions:0,severeRegressions:0,companies:1,quarantined:false})).toBe('healthy');expect(evidenceState({runs:1,avgScore:1,regressions:0,severeRegressions:0,companies:1,quarantined:false})).toBe('insufficient')})
 it('quarentena sempre sinaliza risco',()=>expect(evidenceLabel(evidenceState({runs:10,avgScore:.99,regressions:0,severeRegressions:0,companies:2,quarantined:true}))).toBe('Risco / quarentena'))
 it('rollback automático exige versão anterior e proteção ligada',()=>{expect(shouldAutoRollback({severe:true,hasPrevious:true,autoLock:true})).toBe(true);expect(shouldAutoRollback({severe:true,hasPrevious:false,autoLock:true})).toBe(false)})
})
