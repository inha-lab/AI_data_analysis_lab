import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyProposal, proposalSections, proposalValues, validateProposal, validateReview } from '../src/features/proposals/proposal-model.ts'
test('drafts allow unfinished sections but submissions require every section', () => {
  const input = emptyProposal('Team A')
  assert.equal(validateProposal(input, false), null)
  assert.ok(validateProposal(input, true))
  for (const section of proposalSections) input[section.key] = `Plan for ${section.key}`
  assert.equal(validateProposal(input, true), null)
  for (const section of proposalSections) assert.ok(validateProposal({ ...input, [section.key]: '  ' }, true))
})
test('proposal bounds and auxiliary link restrictions are enforced', () => {
  const input = emptyProposal('Team A')
  for (const patch of [{ title: '' }, { title: 'x'.repeat(121) }, { overview: 'x'.repeat(8001) }, { notion_url: 'javascript:alert(1)' }, { notion_url: 'https://user:pass@example.com' }]) assert.ok(validateProposal({ ...input, ...patch }, false))
  assert.equal(validateProposal({ ...input, execution_plan: 'x'.repeat(8000), notion_url: 'https://notion.so/example' }, false), null)
})
test('editable values exclude status and audit metadata', () => {
  const values = proposalValues({ ...emptyProposal('Team A'), status: 'reviewed', updated_name: 'Spoof', team_id: 'other', review_note: 'Injected' })
  assert.equal(Object.keys(values).length, 8)
  for (const key of ['status','updated_name','team_id','review_note']) assert.equal(Object.hasOwn(values, key), false)
})
test('review transitions require submitted work and reasons for reopening', () => {
  assert.equal(validateReview('submitted', 'reviewed', ''), null)
  assert.equal(validateReview('submitted', 'returned', 'Add data sources'), null)
  assert.equal(validateReview('reviewed', 'returned', 'Update the plan'), null)
  assert.ok(validateReview('draft', 'reviewed', ''))
  assert.ok(validateReview('reviewed', 'reviewed', ''))
  assert.ok(validateReview('submitted', 'returned', ' '))
  assert.ok(validateReview('submitted', 'reviewed', 'x'.repeat(4001)))
})
