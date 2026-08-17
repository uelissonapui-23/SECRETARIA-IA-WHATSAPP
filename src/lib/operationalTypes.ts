export type Contact = {
  id: string
  company_id: string
  name: string | null
  whatsapp_id: string | null
  phone: string | null
  email?: string | null
  notes?: string | null
  tags?: string[]
  last_interaction_at?: string | null
  created_at: string
}

export type Appointment = {
  id: string
  company_id: string
  contact_id: string | null
  suggestion_id: string | null
  title: string
  starts_at: string
  ends_at: string | null
  address: string | null
  notes: string | null
  status: string
  kind?: string
  reminder_minutes?: number
  created_at: string
}

export type Task = {
  id: string
  company_id: string
  contact_id: string | null
  suggestion_id: string | null
  title: string
  description?: string | null
  due_at: string | null
  status: string
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  completed_at?: string | null
  created_at: string
}

export type WorkItem = {
  id: string
  company_id: string
  contact_id: string | null
  suggestion_id: string | null
  type: 'order' | 'service' | 'quote' | 'payment' | 'follow_up' | 'deadline' | 'awaiting_reply'
  title: string
  description: string | null
  amount: number | null
  due_at: string | null
  status: 'open' | 'in_progress' | 'waiting' | 'done' | 'cancelled'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  completed_at: string | null
  created_at: string
}

export type Suggestion = {
  id: string
  company_id: string
  contact_id: string | null
  conversation_id: string | null
  source_message_id: string
  context_message_ids: string[]
  type: 'appointment' | 'task' | 'order' | 'quote' | 'payment_promise' | 'follow_up' | 'awaiting_reply' | 'deadline'
  title: string
  summary: string | null
  extracted_data: Record<string, unknown>
  reason: string | null
  confidence: number | null
  status: 'pending' | 'confirmed' | 'edited' | 'ignored'
  created_at: string
}

export type OperationalMemory = {
  id: string
  company_id: string
  contact_id: string | null
  kind: 'context' | 'preference' | 'commitment' | 'important' | 'instruction'
  content: string
  source: 'manual' | 'conversation' | 'assistant' | 'system'
  importance: 'low' | 'normal' | 'high'
  is_active: boolean
  created_at: string
  updated_at: string
}
