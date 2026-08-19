import { describe,expect,it } from 'vitest'
import { canRetryAnalysisJob,queueLabel,queueSeverity } from './analysisQueue'

describe('analysis queue helpers',()=>{
  it('permite recuperar itens aguardando e falhos dentro do limite',()=>{expect(canRetryAnalysisJob({status:'failed',attempts:1,max_attempts:3,last_error:'x'})).toBe(true);expect(canRetryAnalysisJob({status:'failed',attempts:3,max_attempts:3,last_error:'x'})).toBe(false);expect(canRetryAnalysisJob({status:'pending',attempts:0,max_attempts:3,last_error:null})).toBe(true)})
  it('prioriza fila esgotada como crítica',()=>{expect(queueSeverity(0,0,1)).toBe('critical');expect(queueSeverity(0,2,0)).toBe('attention');expect(queueSeverity(11,0,0)).toBe('busy');expect(queueSeverity(2,0,0)).toBe('healthy')})
  it('traduz status operacionais',()=>{expect(queueLabel('processing')).toBe('Processando');expect(queueLabel('failed')).toBe('Falhou')})
})
