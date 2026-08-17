import{describe,expect,it}from'vitest'
import{qualityLabel,qualitySummary}from'./analysisQuality'
describe('analysis quality',()=>{it('calcula acurácia sem divisão por zero',()=>{expect(qualitySummary([]).accuracy).toBe(0)});it('resume feedback humano',()=>{expect(qualitySummary([{verdict:'correct'},{verdict:'correct'},{verdict:'incorrect'}])).toEqual({total:3,correct:2,incorrect:1,missed:0,accuracy:2/3})});it('classifica qualidade',()=>{expect(qualityLabel(.92,10)).toBe('Excelente');expect(qualityLabel(.7,10)).toBe('Em ajuste')})})
