export type Company = {
  id: string
  name: string
  business_type: string | null
  timezone: string
  description: string | null
  phone: string | null
  city: string | null
  state: string | null
  onboarding_completed_at: string | null
}

export type CompanySettings = {
  company_id: string
  working_days: number[]
  workday_start: string
  workday_end: string
  monitor_appointments: boolean
  monitor_orders: boolean
  monitor_quotes: boolean
  monitor_payment_promises: boolean
  monitor_follow_ups: boolean
  monitor_awaiting_reply: boolean
  monitor_deadlines: boolean
  monitor_tasks: boolean
  default_reminder_minutes: number
  ai_mode: 'observe'
}

export type CompanyMember = {
  company_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
}
