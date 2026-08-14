import { describe, expect, it } from 'vitest'
import { normalizeWorkingDays, isOnboardingComplete } from './onboarding'

describe('onboarding', () => {
  it('normaliza dias úteis sem duplicar e em ordem', () => {
    expect(normalizeWorkingDays([5, 1, 1, 3])).toEqual([1, 3, 5])
  })

  it('considera concluído quando a empresa possui marca de conclusão', () => {
    expect(isOnboardingComplete({ onboarding_completed_at: '2026-08-14T10:00:00Z' })).toBe(true)
    expect(isOnboardingComplete({ onboarding_completed_at: null })).toBe(false)
  })
})
