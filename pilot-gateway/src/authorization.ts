export type AuthorizationFailureReason =
  | 'invalid_user_token'
  | 'membership_query_failed'
  | 'company_query_failed'
  | 'company_not_found'
  | 'not_company_admin'

export type AuthorizationResult =
  | { allowed: true; userId: string; role: 'owner' | 'admin' }
  | { allowed: false; reason: AuthorizationFailureReason; role?: string | null }

type QueryResult<T> = { data: T | null; error: { code?: string; message?: string } | null }

export type AuthorizationDependencies = {
  getUser: (token: string) => Promise<QueryResult<{ id: string }>>
  getMembership: (companyId: string, userId: string) => Promise<QueryResult<{ role: string }>>
  getCompany: (companyId: string) => Promise<QueryResult<{ created_by: string | null }>>
  log?: (level: 'warn' | 'error', event: string, details: Record<string, unknown>) => void
}

export function createAuthorize(deps: AuthorizationDependencies) {
  const log = deps.log ?? (() => undefined)

  return async (token: string, companyId: string): Promise<AuthorizationResult> => {
    const userResult = await deps.getUser(token)
    if (userResult.error || !userResult.data) {
      log('warn', 'auth-user-rejected', {
        company_id: companyId,
        reason: userResult.error?.message ?? 'user_not_found',
      })
      return { allowed: false, reason: 'invalid_user_token' }
    }

    const userId = userResult.data.id
    const membershipResult = await deps.getMembership(companyId, userId)
    if (membershipResult.error) {
      log('error', 'membership-query-failed', {
        company_id: companyId,
        user_id: userId,
        code: membershipResult.error.code,
        message: membershipResult.error.message,
      })
      return { allowed: false, reason: 'membership_query_failed' }
    }

    const role = membershipResult.data?.role ?? null
    if (role === 'owner' || role === 'admin') {
      return { allowed: true, userId, role }
    }

    const companyResult = await deps.getCompany(companyId)
    if (companyResult.error) {
      log('error', 'company-owner-query-failed', {
        company_id: companyId,
        user_id: userId,
        code: companyResult.error.code,
        message: companyResult.error.message,
      })
      return { allowed: false, reason: 'company_query_failed', role }
    }

    if (!companyResult.data) {
      log('warn', 'company-not-found', { company_id: companyId, user_id: userId })
      return { allowed: false, reason: 'company_not_found', role }
    }

    if (companyResult.data.created_by === userId) {
      log('warn', 'owner-fallback-used', { company_id: companyId, user_id: userId })
      return { allowed: true, userId, role: 'owner' }
    }

    log('warn', 'access-forbidden', { company_id: companyId, user_id: userId, role })
    return { allowed: false, reason: 'not_company_admin', role }
  }
}
