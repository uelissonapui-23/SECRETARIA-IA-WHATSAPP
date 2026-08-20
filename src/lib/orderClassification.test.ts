import { describe, expect, it } from 'vitest'
import { analyzeText } from '../../supabase/functions/_shared/analyzer'

describe('classificação de pedidos',()=>{
  it('trata data de entrega como prazo do pedido, não como agendamento',()=>{
    const result=analyzeText('Preciso fazer um novo pedido de 30 camisetas para entregar sexta-feira às 16h.','','',{minConfidence:.65,allowMultiple:true})
    expect(result.some(item=>item.type==='order')).toBe(true)
    expect(result.some(item=>item.type==='appointment')).toBe(false)
    expect(result.find(item=>item.type==='order')?.extracted_data).toMatchObject({quantity:30,when_text:'sexta-feira',time_text:'16:00'})
  })
})
