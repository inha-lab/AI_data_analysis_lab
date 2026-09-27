import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeParticipant, validateBulkParticipantStatus, validateParticipant } from '../src/features/participants/participant-model.ts'

const valid = { full_name: 'Test Student', email: 'student@example.test', department: 'Data Science', student_number: '00123456', grade: '3', phone: '010-0000-0000', job_group: 'ai_development', status: 'active' }
test('normalization preserves leading zeros and normalizes email', () => {
  const result = normalizeParticipant({ ...valid, email: ' STUDENT@EXAMPLE.TEST ', student_number: ' 00123456 ' })
  assert.equal(result.email, 'student@example.test')
  assert.equal(result.student_number, '00123456')
  assert.equal(validateParticipant(result), null)
})
test('required academic fields and valid contact information are enforced', () => {
  for (const field of ['full_name', 'department', 'student_number', 'grade']) {
    assert.ok(validateParticipant({ ...valid, [field]: '  ' }))
  }
  for (const email of ['missing-at', 'two@@example.test', 'has space@example.test']) {
    assert.ok(validateParticipant({ ...valid, email }))
  }
  for (const phone of ['123', '010-abcd-0000', '1'.repeat(16)]) {
    assert.ok(validateParticipant({ ...valid, phone }))
  }
})
test('only supported job groups and participation statuses are accepted', () => {
  assert.ok(validateParticipant({ ...valid, job_group: 'professor' }))
  assert.ok(validateParticipant({ ...valid, status: 'deleted' }))
  assert.equal(validateParticipant({ ...valid, status: 'inactive' }), null)
  assert.equal(validateParticipant({ ...valid, status: 'completed' }), null)
  assert.equal(validateParticipant({ ...valid, status: 'dropout' }), null)
})

test('other job group requires a manual label', () => {
  assert.match(validateParticipant({ ...valid, job_group: 'other', job_group_other: '' }), /기타 희망 직무/)
  assert.equal(validateParticipant({ ...valid, job_group: 'other', job_group_other: '데이터 기획' }), null)
})
test('bulk status changes require unique participant ids and a supported status',()=>{
  const ids=['facb33f3-cb7a-4d56-b123-fe9507fd38ec','6dc57c8e-f997-4f74-9aa4-cc899c1d37f4']
  assert.equal(validateBulkParticipantStatus(ids,'completed'),null)
  assert.ok(validateBulkParticipantStatus([],'active'))
  assert.ok(validateBulkParticipantStatus([ids[0],ids[0]],'active'))
  assert.ok(validateBulkParticipantStatus(ids,'unknown'))
})
