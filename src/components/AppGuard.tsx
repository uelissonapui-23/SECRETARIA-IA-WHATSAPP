import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useCompany } from '../company/CompanyProvider'
import { supabase } from '../lib/supabase'

export function AppGuard({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { currentCompany, loading: companyLoading } = useCompany()
  const location = useLocation()
  const [platformRole, setPlatformRole] = useState<string | null>(null)
  const [roleLoading, setRoleLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (!user) {
      setPlatformRole(null)
      setRoleLoading(false)
      return () => { cancelled = true }
    }

    setRoleLoading(true)
    void (async () => {
      try {
        // Seguro e idempotente: só concede Master ao e-mail previamente
        // autorizado na tabela privada de bootstrap e somente após confirmação.
        const claim = await supabase.rpc('claim_platform_master_bootstrap')
        if (claim.error) console.warn('Bootstrap Master não aplicado:', claim.error.message)

        const { data, error } = await supabase.rpc('get_my_platform_role')
        if (error) throw error
        if (!cancelled) setPlatformRole((data as string | null) ?? null)
      } catch (error) {
        console.error('Falha ao verificar papel da plataforma:', error)
        if (!cancelled) setPlatformRole(null)
      } finally {
        if (!cancelled) setRoleLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [user])

  if (authLoading || (user && (companyLoading || roleLoading))) {
    return <main className="loading-page"><div className="loading-card"><div className="spinner"/><span>Carregando...</span></div></main>
  }

  if (!user) return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />

  // Conta administrativa da plataforma pode existir sem uma empresa própria.
  // Nesse caso ela entra diretamente na Área Master e não é forçada ao onboarding.
  if (platformRole && !currentCompany) {
    if (location.pathname !== '/master') return <Navigate to="/master" replace />
    return children
  }

  // Mesmo que a empresa associada ainda não tenha onboarding concluído,
  // o administrador da plataforma continua podendo acessar a Área Master.
  if (platformRole && location.pathname === '/master') return children

  if (!currentCompany?.onboarding_completed_at && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return children
}
