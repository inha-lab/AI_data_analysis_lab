import { supabase } from '@/lib/supabase'
import type { TeamMember } from '@/features/teams/team-model'
import { proposalValues, validateProposal, validateReview, type Proposal, type ProposalInput } from './proposal-model'
const columns = 'team_id,title,overview,data_plan,methods,validation,service_plan,execution_plan,notion_url,status,updated_at,updated_name,submitted_at,submitted_name,review_note,review_action,reviewed_at,reviewer_name'
function client() { if (!supabase) throw new Error('데이터베이스 연결 설정이 필요합니다.'); return supabase }
function fail(code: string) {
  if (code === '40001' || code === '40P01') return new Error('다른 팀원이나 교수가 기획서를 변경했습니다. 입력 내용을 복사한 뒤 최신 내용을 다시 불러와 주세요.')
  if (code === '42501') return new Error('이 기획서에 접근하거나 수정할 권한이 없습니다. 현재 팀 소속을 확인해 주세요.')
  if (code === '55000') return new Error('기획서 상태가 변경되었거나 제출 후 잠겨 있습니다. 최신 상태를 확인해 주세요.')
  if (code === '23514' || code === '23502' || code.startsWith('22')) return new Error('제목·본문·링크와 제출 필수 항목을 확인해 주세요.')
  if (code === 'PGRST202' || code === 'PGRST205') return new Error('기획서 데이터베이스 설정이 필요합니다.')
  return new Error('기획서를 처리하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.')
}
export async function loadProposal(teamId: string) {
  const db = client()
  const [team, proposal] = await Promise.all([
    db.from('AD_teams').select('id,cohort_id,name,topic').eq('id', teamId).maybeSingle(),
    db.from('AD_proposals').select(columns).eq('team_id', teamId).maybeSingle(),
  ])
  if (team.error) throw fail(team.error.code)
  if (proposal.error) throw fail(proposal.error.code)
  if (!team.data) throw new Error('팀이 없거나 현재 소속 팀에 접근할 수 없습니다.')
  const roster = await db.rpc('AD_team_roster', { p_cohort: team.data.cohort_id })
  if (roster.error) throw fail(roster.error.code)
  return { team: team.data, proposal: proposal.data as Proposal | null, roster: (roster.data as TeamMember[]).filter(row => row.team_id === teamId) }
}
export async function saveProposal(teamId: string, input: ProposalInput, submit: boolean, previous: Proposal | null) {
  const validation = validateProposal(input, submit)
  if (validation) throw new Error(validation)
  const { error } = await client().rpc('AD_save_proposal', { p_team: teamId, p_version: previous?.updated_at ?? null, p_values: proposalValues(input), p_submit: submit })
  if (error) throw fail(error.code)
}
export async function reviewProposal(previous: Proposal, action: 'reviewed' | 'returned', note: string) {
  const validation = validateReview(previous.status, action, note)
  if (validation) throw new Error(validation)
  const { error } = await client().rpc('AD_review_proposal', { p_team: previous.team_id, p_version: previous.updated_at, p_action: action, p_note: note })
  if (error) throw fail(error.code)
}
