import assert from 'node:assert/strict'
import test from 'node:test'
import { createAuthorize, type AuthorizationDependencies } from './authorization.js'

const ok = <T>(data: T | null) => ({ data, error: null })

function dependencies(overrides: Partial<AuthorizationDependencies> = {}): AuthorizationDependencies {
  return {
    getUser: async () => ok({ id: 'user-a' }),
    getMembership: async () => ok({ role: 'owner' }),
    getCompany: async () => ok({ created_by: 'user-a' }),
    ...overrides,
  }
}

test('allows an owner from company_members', async () => {
  const result = await createAuthorize(dependencies())('token', 'company-a')
  assert.deepEqual(result, { allowed: true, userId: 'user-a', role: 'owner' })
})

test('allows an administrator from company_members', async () => {
  const result = await createAuthorize(dependencies({ getMembership: async () => ok({ role: 'admin' }) }))('token', 'company-a')
  assert.equal(result.allowed, true)
  if (result.allowed) assert.equal(result.role, 'admin')
})

test('allows the company creator when the historical membership row is absent', async () => {
  const result = await createAuthorize(dependencies({ getMembership: async () => ok(null) }))('token', 'company-a')
  assert.deepEqual(result, { allowed: true, userId: 'user-a', role: 'owner' })
})

test('denies a regular member', async () => {
  const result = await createAuthorize(dependencies({
    getMembership: async () => ok({ role: 'member' }),
    getCompany: async () => ok({ created_by: 'another-user' }),
  }))('token', 'company-a')
  assert.deepEqual(result, { allowed: false, reason: 'not_company_admin', role: 'member' })
})

test('denies cross-tenant access even when the user owns another company', async () => {
  const result = await createAuthorize(dependencies({
    getMembership: async () => ok(null),
    getCompany: async () => ok({ created_by: 'user-b' }),
  }))('token-a', 'company-b')
  assert.deepEqual(result, { allowed: false, reason: 'not_company_admin', role: null })
})

test('distinguishes invalid tokens and missing companies', async () => {
  const invalid = await createAuthorize(dependencies({ getUser: async () => ({ data: null, error: { message: 'bad jwt' } }) }))('bad', 'company-a')
  assert.deepEqual(invalid, { allowed: false, reason: 'invalid_user_token' })

  const missing = await createAuthorize(dependencies({
    getMembership: async () => ok(null),
    getCompany: async () => ok(null),
  }))('token', 'missing-company')
  assert.deepEqual(missing, { allowed: false, reason: 'company_not_found', role: null })
})
