import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useCompany } from '../company/CompanyProvider'

export function AppGuard({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { currentCompany, loading: companyLoading } = useCompany()
  const location = useLocation()

  if (authLoading || (user && companyLoading)) return <main className="loading-page"><div className="loading-card"><div className="spinner"/><span>Carregando...</span></div></main>
  if (!user) return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />
  if (!currentCompany?.onboarding_completed_at && location.pathname !== '/onboarding') return <Navigate to="/onboarding" replace />
  return children
}
