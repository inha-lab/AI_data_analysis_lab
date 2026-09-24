import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyReport, nextReportRound, reportValues, validateReport, validateReportReview } from '../src/features/reports/report-model.ts'
const full = { ...emptyReport('daily'), round_number: '1', report_date: '2026-09-25', title: 'Daily 1', progress_summary: 'Progress', completed_work: 'Done', next_plan: 'Next' }
test('draft accepts unfinished content while submission requires three core sections', () => {
  assert.equal(validateReport(emptyReport('weekly'), false), '제목은 1~120자로 입력해 주세요.')
  assert.equal(validateReport({ ...full, progress_summary: '', completed_work: '', next_plan: '' }, false), null)
  assert.equal(validateReport(full, true), null)
  for (const key of ['progress_summary', 'completed_work', 'next_plan']) assert.ok(validateReport({ ...full, [key]: '  ' }, true))
  assert.equal(validateReport({ ...full, issues: '', support_request: '' }, true), null)
})
test('report type, round, calendar date and bounds are validated', () => {
  for (const patch of [{ report_type: 'other' }, { round_number: '0' }, { round_number: '1001' }, { round_number: '1.5' }, { report_date: '2026-02-29' }, { report_date: '2026-04-31' }, { title: ' ' }, { title: 'x'.repeat(121) }, { issues: 'x'.repeat(8001) }]) assert.ok(validateReport({ ...full, ...patch }, false))
  assert.equal(validateReport({ ...full, report_type: 'weekly' }, true), null)
})
test('student input exposes only report fields and round suggestions are per type', () => {
  const values = reportValues({ ...full, status: 'reviewed', team_id: 'another', updated_name: 'spoof' })
  assert.equal(Object.keys(values).length, 9)
  for (const key of ['status', 'team_id', 'updated_name']) assert.equal(Object.hasOwn(values, key), false)
  assert.equal(nextReportRound([{ report_type: 'daily', round_number: 1 }, { report_type: 'weekly', round_number: 7 }, { report_type: 'daily', round_number: 3 }], 'daily'), 4)
  assert.equal(nextReportRound([], 'weekly'), 1)
})
test('review requires submitted work and return reasons', () => {
  assert.equal(validateReportReview('submitted', 'reviewed', ''), null)
  assert.equal(validateReportReview('reviewed', 'returned', 'Revise'), null)
  assert.ok(validateReportReview('draft', 'reviewed', ''))
  assert.ok(validateReportReview('reviewed', 'reviewed', ''))
  assert.ok(validateReportReview('submitted', 'returned', ' '))
  assert.ok(validateReportReview('submitted', 'reviewed', 'x'.repeat(4001)))
})
