import {describe,expect,it} from 'vitest'
import {checklistReady,releaseHealthLabel} from './aiReleaseReview'
describe('ai release review',()=>{it('só libera checklist com evidência saudável',()=>{expect(checklistReady({hasRuns:true,score:.92,regressions:0,severe:0,quarantined:false})).toBe(true);expect(checklistReady({hasRuns:true,score:.92,regressions:0,severe:1,quarantined:false})).toBe(false)});it('rotula saúde',()=>{expect(releaseHealthLabel('critical')).toBe('Crítica')})})
