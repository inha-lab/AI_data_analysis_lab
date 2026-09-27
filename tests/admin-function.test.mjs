import test from 'node:test'
import assert from 'node:assert/strict'
import { assertAdminAccountAvailable, normalizeAdmin, normalizeAdminTarget } from '../supabase/functions/_shared/admin.ts'

test('normalizes administrator input and fixes the supported action', () => {
  assert.deepEqual(normalizeAdmin({ action: 'create', email: ' Admin@Inha.ac.kr ', displayName: ' 관리자 ', phone: ' 010-1234-5678 ', role: 'admin' }), { email: 'admin@inha.ac.kr', displayName: '관리자', phone: '010-1234-5678', role: 'admin' })
  assert.throws(() => normalizeAdmin({ action: 'update', email: 'a@b.co', displayName: '관리자', phone: '010-1234-5678', role: 'admin' }), /요청 형식/)
})
test('validates administrator update targets and active state', () => {
  assert.deepEqual(normalizeAdminTarget({ id: 'facb33f3-cb7a-4d56-b123-fe9507fd38ec', isActive: true }), { id: 'facb33f3-cb7a-4d56-b123-fe9507fd38ec', isActive: true })
  assert.throws(() => normalizeAdminTarget({ id: 'invalid', isActive: true }), /식별/)
  assert.throws(() => normalizeAdminTarget({ id: 'facb33f3-cb7a-4d56-b123-fe9507fd38ec', isActive: 'yes' }), /상태/)
})
test('existing authentication accounts can be linked only when this app has no profile', () => {
  assert.doesNotThrow(() => assertAdminAccountAvailable(null))
  assert.throws(() => assertAdminAccountAvailable({ role: 'admin', is_active: true }), /이미 등록된 관리자/)
  assert.throws(() => assertAdminAccountAvailable({ role: 'student', is_active: true }), /다른 역할/)
})
