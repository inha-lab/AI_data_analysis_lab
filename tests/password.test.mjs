import test from 'node:test'
import assert from 'node:assert/strict'
import { validateNewPassword } from '../supabase/functions/_shared/password.ts'

test('passwords require only a length between 8 and 128 characters', () => {
  assert.equal(validateNewPassword('abcdefgh'), '')
  assert.equal(validateNewPassword('12345678'), '')
  assert.equal(validateNewPassword('가나다라마바사아'), '')
  assert.match(validateNewPassword('1234567'), /8~128/)
  assert.match(validateNewPassword('a'.repeat(129)), /8~128/)
})
