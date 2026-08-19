import {describe,expect,it} from 'vitest'
import {resolveAppointmentStart} from './appointmentDate'

describe('resolveAppointmentStart',()=>{
  it('interpreta amanhã às 15h a partir da data da mensagem',()=>{
    const result=resolveAppointmentStart({when_text:'amanhã',time_text:'15h'},new Date(2026,7,19,14,8).toISOString())
    expect(result).toBe(new Date(2026,7,20,15,0).toISOString())
  })
  it('interpreta horário com minutos',()=>{
    const result=resolveAppointmentStart({when_text:'hoje',time_text:'09:30'},new Date(2026,7,19,8,0).toISOString())
    expect(result).toBe(new Date(2026,7,19,9,30).toISOString())
  })
  it('preserva starts_at explícito e válido',()=>{
    expect(resolveAppointmentStart({starts_at:'2026-08-22T18:00:00.000Z'},'2026-08-19T18:00:00.000Z')).toBe('2026-08-22T18:00:00.000Z')
  })
  it('não inventa data sem indicação temporal suficiente',()=>{
    expect(resolveAppointmentStart({when_text:'depois',time_text:'15h'},'2026-08-19T18:00:00.000Z')).toBeNull()
  })
})
