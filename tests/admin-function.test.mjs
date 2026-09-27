import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAdmin } from '../supabase/functions/_shared/admin.ts'

test('normalizes administrator input and fixes the supported action', () => {
  assert.deepEqual(normalizeAdmin({ action: 'create', email: ' Admin@Inha.ac.kr ', displayName: ' 관리자 ', phone: ' 010-1234-5678 ' }), { email: 'admin@inha.ac.kr', displayName: '관리자', phone: '010-1234-5678' })
  assert.throws(() => normalizeAdmin({ action: 'update', email: 'a@b.co', displayName: '관리자', phone: '010-1234-5678' }), /요청 형식/)
})
