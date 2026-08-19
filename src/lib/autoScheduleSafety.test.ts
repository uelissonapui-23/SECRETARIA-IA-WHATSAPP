import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {describe,expect,it} from 'vitest'

const root=process.cwd()
const worker=readFileSync(resolve(root,'supabase/functions/process-message/index.ts'),'utf8').replace(/\s+/g,' ')
const migration=readFileSync(resolve(root,'supabase/migrations/20260819160000_learning_auto_schedule.sql'),'utf8').toLowerCase().replace(/\s+/g,' ')

describe('contrato de automação segura da agenda',()=>{
  it('autoagenda somente criação com data concreta, aprendizado e limiar',()=>{
    expect(worker).toContain("action==='create'")
    expect(worker).toContain('Boolean(startsAt)')
    expect(worker).toContain('learned.eligible')
    expect(worker).toContain('auto_schedule_threshold')
  })
  it('mantém alteração e cancelamento fora do caminho automático',()=>{
    expect(worker).toContain("action==='reschedule'||action==='cancel'")
    expect(worker).not.toContain("canAuto=detected.type==='appointment'&&action!=='cancel'")
  })
  it('exige 95% e cinco decisões por padrão e registra auditoria',()=>{
    expect(migration).toContain('default 0.950')
    expect(migration).toContain('default 5')
    expect(worker).toContain('appointment_auto_scheduled')
  })
})
