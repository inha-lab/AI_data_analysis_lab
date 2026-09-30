import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeProfileInput, validateAdminInput, validateProfileInput } from '../src/features/account/account-model.ts'

test('normalizes editable profile values', () => {
  assert.deepEqual(normalizeProfileInput({ displayName: ' 홍길동 ', phone: ' 010-1234-5678 ' }), { displayName: '홍길동', phone: '010-1234-5678' })
})
test('normalizes administrator mobile contact separators',()=>assert.equal(normalizeProfileInput({displayName:'관리자',phone:'01096503328'}).phone,'010-9650-3328'))
test('validates profile name and phone', () => {
  assert.equal(validateProfileInput({ displayName: '홍길동', phone: '010-1234-5678' }), '')
  assert.match(validateProfileInput({ displayName: '', phone: '010-1234-5678' }), /이름/)
  assert.match(validateProfileInput({ displayName: '홍길동', phone: '123' }), /연락처/)
})
test('validates administrator email', () => {
  assert.equal(validateAdminInput({ displayName: '관리자', phone: '010-1234-5678', email: 'admin@inha.ac.kr', role: 'admin' }), '')
  assert.match(validateAdminInput({ displayName: '관리자', phone: '010-1234-5678', email: 'invalid', role: 'admin' }), /이메일/)
})
