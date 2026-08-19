import {describe,expect,it} from 'vitest'
import {appointmentStartUtc,learnedAppointmentConfidence} from '../../supabase/functions/_shared/appointmentTime'
import {analyzeText,normalizeWhatsAppText} from '../../supabase/functions/_shared/analyzer'

describe('aprendizado seguro de agenda',()=>{
  it('converte amanhã 10:30 de Manaus para UTC',()=>expect(appointmentStartUtc({when_text:'amanhã',time_text:'10:30'},'2026-08-19T18:49:00.000Z','America/Manaus')).toBe('2026-08-20T14:30:00.000Z'))
  it('não automatiza antes de cinco decisões',()=>expect(learnedAppointmentConfidence(.88,4,0,5).eligible).toBe(false))
  it('eleva para 96% após cinco decisões corretas',()=>expect(learnedAppointmentConfidence(.88,5,0,5)).toMatchObject({confidence:.96,eligible:true,accuracy:1}))
  it('reduz a confiança quando o usuário corrige decisões',()=>expect(learnedAppointmentConfidence(.88,1,4,5).confidence).toBeLessThan(.88))
  it('normaliza abreviações comuns',()=>expect(normalizeWhatsAppText('qro agnd amnh 10hrs')).toContain('quero agendar amanhã 10horas'))
  it('identifica reagendamento abreviado',()=>{const[c]=analyzeText('remarc p amnh 16h','','',{minConfidence:.65,allowMultiple:true});expect(c.extracted_data).toMatchObject({action:'reschedule',when_text:'amanhã',time_text:'16:00'})})
  it('identifica cancelamento abreviado',()=>{const[c]=analyzeText('canc meu horario','','',{minConfidence:.65,allowMultiple:true});expect(c.extracted_data).toMatchObject({action:'cancel'})})
  it('corrige erros prováveis em palavras operacionais',()=>{const[c]=analyzeText('qro ajendar uma vizita amanha as 9h','','',{minConfidence:.65,allowMultiple:true});expect(c.extracted_data).toMatchObject({action:'create',when_text:'amanhã',time_text:'09:00'})})
})
