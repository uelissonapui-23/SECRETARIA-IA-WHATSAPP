export function normalizeWorkingDays(days: number[]) {
  return [...new Set(days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b)
}

export function isOnboardingComplete(company: { onboarding_completed_at: string | null } | null | undefined) {
  return Boolean(company?.onboarding_completed_at)
}
