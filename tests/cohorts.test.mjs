import test from 'node:test'
import assert from 'node:assert/strict'
import { validateCohort } from '../src/features/cohorts/cohort-model.ts'

const valid = { name: 'AI_DATA_LAB_1기', description: '', starts_on: null, ends_on: null, status: 'draft' }
test('an undecided period and a same-day program are valid', () => {
  assert.equal(validateCohort(valid), null)
  assert.equal(validateCohort({ ...valid, starts_on: '2026-09-24', ends_on: '2026-09-24' }), null)
})
test('partial and reversed periods are rejected', () => {
  assert.ok(validateCohort({ ...valid, starts_on: '2026-09-24' }))
  assert.ok(validateCohort({ ...valid, ends_on: '2026-09-24' }))
  assert.ok(validateCohort({ ...valid, starts_on: '2026-09-24', ends_on: '2026-09-23' }))
})
test('impossible calendar dates and malformed dates are rejected', () => {
  for (const date of ['2026-02-29', '2026-13-01', '2026-04-31', '24/09/2026']) {
    assert.ok(validateCohort({ ...valid, starts_on: date, ends_on: date }))
  }
  assert.equal(validateCohort({ ...valid, starts_on: '2028-02-29', ends_on: '2028-02-29' }), null)
})
test('blank names, overlong descriptions and unsupported status cannot be saved', () => {
  assert.ok(validateCohort({ ...valid, name: '   ' }))
  assert.ok(validateCohort({ ...valid, name: 'x'.repeat(81) }))
  assert.ok(validateCohort({ ...valid, description: 'x'.repeat(2001) }))
  assert.ok(validateCohort({ ...valid, status: 'unknown' }))
})
