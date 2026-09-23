import test from 'node:test'
import assert from 'node:assert/strict'
import { fromKstInput, toKstInput, validateSchedule, scheduleState, formatScheduleTime } from '../src/features/schedules/schedule-model.ts'
const input = { title: 'Design review', description: '', stage: 'design', kind: 'event', starts_at: '2026-09-24T00:00:00Z', ends_at: '2026-09-24T01:00:00Z', is_public: false, is_cancelled: false }
test('KST input and display do not depend on browser timezone and preserve date boundaries', () => {
  assert.equal(fromKstInput('2026-09-24T00:30'), '2026-09-23T15:30:00.000Z')
  assert.equal(toKstInput('2026-09-23T15:30:00Z'), '2026-09-24T00:30')
  assert.match(formatScheduleTime('2026-09-23T15:30:00Z'), /24/)
  assert.equal(fromKstInput('2028-02-29T23:59'), '2028-02-29T14:59:00.000Z')
})
test('impossible dates, malformed times and out-of-range inputs are rejected', () => {
  for (const value of ['', '2026-02-29T10:00', '2026-04-31T10:00', '2026-09-24T24:00', '2026-09-24T10:60', '0000-01-01T00:00', '2026-09-24T00:00Z']) assert.throws(() => fromKstInput(value))
})
test('event periods and deadline instants enforce different contracts', () => {
  assert.equal(validateSchedule(input), null)
  assert.ok(validateSchedule({ ...input, ends_at: '2026-09-23T00:00:00Z' }))
  assert.ok(validateSchedule({ ...input, kind: 'deadline' }))
  assert.equal(validateSchedule({ ...input, kind: 'deadline', ends_at: input.starts_at }), null)
  for (const patch of [{ title: ' ' }, { title: 'x'.repeat(121) }, { description: 'x'.repeat(4001) }, { stage: 'unknown' }, { kind: 'unknown' }, { starts_at: '' }]) assert.ok(validateSchedule({ ...input, ...patch }))
})
test('schedule state handles event boundaries, deadlines and cancellations', () => {
  const start = Date.parse(input.starts_at), end = Date.parse(input.ends_at)
  assert.equal(scheduleState(input, start - 1), '예정')
  assert.equal(scheduleState(input, start), '진행 중')
  assert.equal(scheduleState(input, end), '진행 중')
  assert.equal(scheduleState(input, end + 1), '종료')
  assert.equal(scheduleState({ ...input, kind: 'deadline', ends_at: input.starts_at }, start + 1), '마감')
  assert.equal(scheduleState({ ...input, is_cancelled: true }, start), '취소')
})
