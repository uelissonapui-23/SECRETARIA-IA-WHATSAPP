import { createClient } from 'npm:@supabase/supabase-js@2'

type Detected = { type: string; title: string; summary?: string; reason: string; confidence: number; extracted_data: Record<string, unknown> }

function mockDetect(text: string): Detected | null {
  const lower = text.toLocaleLowerCase('pt-BR')
  if (/(amanh[ãa]|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo).*\b\d{1,2}(?::\d{2})?\s*h?\b/i.test(lower) || /pode vir|marcado|agend/i.test(lower)) {
    return { type: 'appointment', title: 'Possível agendamento detectado', summary: text, reason: 'A mensagem menciona disponibilidade ou combinação de atendimento.', confidence: 0.72, extracted_data: {} }
  }
  if (/pix|pago|pagamento|deposito|depósito/i.test(lower)) {
    return { type: 'payment_promise', title: 'Possível compromisso de pagamento', summary: text, reason: 'A mensagem contém linguagem relacionada a pagamento.', confidence: 0.68, extracted_data: {} }
  }
  if (/me chama|me lembra|m[eê]s que vem|semana que vem/i.test(lower)) {
    return { type: 'follow_up', title: 'Possível retorno futuro', summary: text, reason: 'A mensagem pede contato ou acompanhamento posterior.', confidence: 0.69, extracted_data: {} }
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  const secret = Deno.env.get('WORKER_SECRET') ?? ''
  if (!secret) return new Response('Worker not configured', { status: 503 })
  if (req.headers.get('x-worker-secret') !== secret) return new Response('Unauthorized', { status: 401 })

  const { message_id } = await req.json()
  if (!message_id) return new Response(JSON.stringify({ error: 'message_id required' }), { status: 400, headers: { 'content-type': 'application/json' } })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')!)
  const { data: message, error } = await supabase.from('messages').select('*').eq('id', message_id).single()
  if (error || !message) return new Response(JSON.stringify({ error: 'message not found' }), { status: 404, headers: { 'content-type': 'application/json' } })
  if (!message.eligible_for_ai || !message.body_text) return new Response(JSON.stringify({ skipped: true }), { headers: { 'content-type': 'application/json' } })

  // V0 deliberadamente usa classificador local para validar o pipeline sem custo de IA.
  // Na etapa IA, este ponto será substituído pelo AI Service com saída estruturada e contexto curto.
  const { data: contextRows } = await supabase
    .from('messages')
    .select('id,body_text,provider_timestamp')
    .eq('conversation_id', message.conversation_id)
    .eq('message_type', 'text')
    .lt('created_at', message.created_at)
    .order('created_at', { ascending: false })
    .limit(5)

  const context = (contextRows ?? []).reverse()
  const contextText = context.map((row) => row.body_text).filter(Boolean).join('\n')
  const detected = mockDetect(`${contextText}\n${message.body_text}`.trim())
  if (detected) {
    await supabase.from('ai_suggestions').insert({
      company_id: message.company_id,
      contact_id: message.contact_id,
      conversation_id: message.conversation_id,
      source_message_id: message.id,
      context_message_ids: context.map((row) => row.id),
      type: detected.type,
      title: detected.title,
      summary: detected.summary,
      reason: detected.reason,
      confidence: detected.confidence,
      extracted_data: detected.extracted_data,
    })
  }

  await supabase.from('message_jobs').update({ status: 'done', updated_at: new Date().toISOString() }).eq('message_id', message.id)
  return new Response(JSON.stringify({ ok: true, detected }), { headers: { 'content-type': 'application/json' } })
})
