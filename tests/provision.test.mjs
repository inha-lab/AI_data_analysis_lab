import test from 'node:test'
import assert from 'node:assert/strict'
import { provisionAccount, generateTemporaryPassword } from '../supabase/functions/_shared/provision.ts'
const participantId = '11111111-1111-4111-8111-111111111111'
const participant = { id: participantId, email: 'student@example.test', status: 'active', profile_id: null, updated_at: '2026-09-24T00:00:00Z' }
function setup(overrides = {}) {
  const calls = []
  const gateway = {
    participant: async () => ({ ...participant }),
    findAccount: async () => null,
    profile: async () => null,
    createAccount: async (_email, password) => { calls.push({ operation: 'create', password }); return { id: 'new', banned: false, managed: true } },
    link: async (_participant, id) => { calls.push({ operation: 'link', id }) },
    ...overrides,
  }
  return { gateway, calls }
}
test('a new account receives an unpredictable password and is linked', async () => {
  const { gateway, calls } = setup()
  const result = await provisionAccount(gateway, 'professor', participantId, 'provision')
  assert.equal(result.status, 'created')
  assert.ok(result.temporaryPassword.length >= 24)
  assert.deepEqual(calls.map(call => call.operation), ['create', 'link'])
  assert.notEqual(generateTemporaryPassword(), generateTemporaryPassword())
})
test('existing account is linked without changing its password or role', async () => {
  const { gateway, calls } = setup({ findAccount: async () => ({ id: 'existing', banned: false, managed: false }) })
  const result = await provisionAccount(gateway, 'professor', participantId, 'provision')
  assert.equal(result.status, 'linked'); assert.equal(result.temporaryPassword, null)
  assert.deepEqual(calls, [{ operation: 'link', id: 'existing' }])
})
test('inactive participant, banned account and nonstudent profile cannot be provisioned', async () => {
  const cases = [
    { participant: async () => ({ ...participant, status: 'inactive' }) },
    { findAccount: async () => ({ id: 'banned', banned: true, managed: false }) },
    { findAccount: async () => ({ id: 'professor', banned: false, managed: false }), profile: async () => ({ role: 'professor', is_active: true, must_change_password: false }) },
  ]
  for (const overrides of cases) { const { gateway, calls } = setup(overrides); await assert.rejects(provisionAccount(gateway, 'professor', participantId, 'provision')); assert.equal(calls.length, 0) }
})
test('partial link failure retains newly issued credential for recovery', async () => {
  const { gateway } = setup({ link: async () => { throw new Error('conflict') } })
  const result = await provisionAccount(gateway, 'professor', participantId, 'provision')
  assert.equal(result.status, 'link_failed'); assert.ok(result.temporaryPassword)
})
test('concurrent email creation is reused and never silently reset', async () => {
  let queries = 0
  const { gateway, calls } = setup({
    findAccount: async () => ++queries === 1 ? null : { id: 'concurrent', banned: false, managed: true },
    createAccount: async () => { throw new Error('email exists') },
  })
  const result = await provisionAccount(gateway, 'professor', participantId, 'provision')
  assert.equal(result.status, 'linked'); assert.equal(result.temporaryPassword, null)
  assert.deepEqual(calls, [{ operation: 'link', id: 'concurrent' }])
})
test('account mismatch and unsupported password reset actions are rejected', async () => {
  const { gateway } = setup({ participant: async () => ({ ...participant, profile_id: 'wrong' }) })
  await assert.rejects(provisionAccount(gateway, 'professor', participantId, 'provision'))
  await assert.rejects(provisionAccount(gateway, 'professor', participantId, 'reset_temporary'))
})
