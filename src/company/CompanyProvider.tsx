import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import type { Company, CompanyMember, CompanySettings } from './companyTypes'

type CompanyContextValue = {
  companies: Company[]
  currentCompany: Company | null
  currentMembership: CompanyMember | null
  settings: CompanySettings | null
  loading: boolean
  refresh: () => Promise<void>
  selectCompany: (companyId: string) => Promise<void>
}

const CompanyContext = createContext<CompanyContextValue | null>(null)

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [companies, setCompanies] = useState<Company[]>([])
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null)
  const [currentMembership, setCurrentMembership] = useState<CompanyMember | null>(null)
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) {
      setCompanies([])
      setCurrentCompany(null)
      setCurrentMembership(null)
      setSettings(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [{ data: memberRows, error: membersError }, { data: preference, error: preferenceError }] = await Promise.all([
        supabase.from('company_members').select('company_id,user_id,role').eq('user_id', user.id),
        supabase.from('user_preferences').select('current_company_id').eq('user_id', user.id).maybeSingle(),
      ])
      if (membersError) throw membersError
      if (preferenceError) throw preferenceError

      const memberships = (memberRows ?? []) as CompanyMember[]
      const ids = memberships.map((item) => item.company_id)
      if (!ids.length) {
        setCompanies([])
        setCurrentCompany(null)
        setCurrentMembership(null)
        setSettings(null)
        return
      }

      const { data: companyRows, error: companyError } = await supabase
        .from('companies')
        .select('id,name,business_type,timezone,description,phone,city,state,onboarding_completed_at,onboarding_step')
        .in('id', ids)
        .order('created_at', { ascending: true })
      if (companyError) throw companyError

      const available = (companyRows ?? []) as Company[]
      const preferredId = preference?.current_company_id as string | null | undefined
      const selected = available.find((company) => company.id === preferredId) ?? available[0] ?? null
      setCompanies(available)
      setCurrentCompany(selected)
      setCurrentMembership(selected ? memberships.find((m) => m.company_id === selected.id) ?? null : null)

      if (selected) {
        const { data: settingsRow, error: settingsError } = await supabase
          .from('company_settings')
          .select('*')
          .eq('company_id', selected.id)
          .maybeSingle()
        if (settingsError) throw settingsError
        setSettings((settingsRow as CompanySettings | null) ?? null)
      } else {
        setSettings(null)
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { void load() }, [load])

  const selectCompany = useCallback(async (companyId: string) => {
    const { error } = await supabase.rpc('set_current_company', { target_company_id: companyId })
    if (error) throw error
    await load()
  }, [load])

  const value = useMemo<CompanyContextValue>(() => ({
    companies,
    currentCompany,
    currentMembership,
    settings,
    loading,
    refresh: load,
    selectCompany,
  }), [companies, currentCompany, currentMembership, settings, loading, load, selectCompany])

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
}

export function useCompany() {
  const value = useContext(CompanyContext)
  if (!value) throw new Error('useCompany deve ser usado dentro de CompanyProvider')
  return value
}
