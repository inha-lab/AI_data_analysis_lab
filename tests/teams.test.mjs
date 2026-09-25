import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyTeam, normalizeTeam, safeTeamUrl, validateTeam, validateTeamMembers, validateMemberRoles, teamSizeHint, jobSummary } from '../src/features/teams/team-model.ts'
const valid = { ...emptyTeam, name: ' Team A ', topic: ' Topic ', github_url: 'https://github.com/example/project' }
const candidates = [
  { participant_id: 'one', eligibility: 'ready', team_id: null },
  { participant_id: 'two', eligibility: 'ready', team_id: 'team-a' },
  { participant_id: 'three', eligibility: 'unlinked', team_id: null },
]
test('team metadata validates stages, bounds and normalizes display text', () => {
  assert.equal(validateTeam(valid), null)
  assert.equal(normalizeTeam(valid).name, 'Team A')
  assert.equal(normalizeTeam(valid).topic, 'Topic')
  for (const patch of [{ name: ' ' }, { name: 'x'.repeat(81) }, { topic: 'x'.repeat(2001) }, { stage: 'other' }]) assert.ok(validateTeam({ ...valid, ...patch }))
})
test('team links permit web URLs and reject active schemes, credentials and malformed inputs', () => {
  assert.equal(safeTeamUrl(''), '')
  assert.equal(safeTeamUrl(' https://example.com '), 'https://example.com/')
  assert.equal(safeTeamUrl('https://example.com/path?q=1#part'), 'https://example.com/path?q=1#part')
  for (const url of ['javascript:alert(1)', 'data:text/html,test', '//example.com', 'https://user:pass@example.com', 'https://example.com/has space', 'https://', 'https://example.com:999999', 'ftp://example.com']) {
    assert.equal(safeTeamUrl(url), null)
    assert.ok(validateTeam({ ...valid, demo_url: url }))
  }
})
test('team membership rejects duplicates, outsiders, unlinked and ineligible candidates', () => {
  assert.equal(validateTeamMembers(['one', 'two'], 'two', candidates, 'team-a'), null)
  assert.equal(validateTeamMembers([], null, candidates), null)
  for (const [ids, leader] of [[['one', 'one'], null], [['one'], 'two'], [['missing'], null], [['three'], null], [['two'], null]]) assert.ok(validateTeamMembers(ids, leader, candidates))
  for (const eligibility of ['inactive_participant', 'inactive_profile', 'wrong_role']) assert.ok(validateTeamMembers(['one'], null, [{ ...candidates[0], eligibility }]))
})
test('team roles belong to selected members and fit the stored length',()=>{
  assert.equal(validateMemberRoles(['one','two'],{one:'모델 개발',two:''}),null)
  assert.ok(validateMemberRoles(['one'],{two:'데이터 수집'}))
  assert.ok(validateMemberRoles(['one'],{one:'가'.repeat(81)}))
})
test('recommended size stays advisory and job composition is counted separately', () => {
  assert.match(teamSizeHint(3), /저장할 수/)
  assert.match(teamSizeHint(5), /맞습니다/)
  assert.match(jobSummary([{ job_group: 'ai_development' }, { job_group: 'ai_development' }, { job_group: 'sw_development' }]), /AI 개발 2명/)
})
