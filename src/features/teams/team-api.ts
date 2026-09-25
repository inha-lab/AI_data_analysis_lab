import { supabase } from '@/lib/supabase'
import { normalizeTeam, validateTeam, type Team, type TeamCandidate, type TeamInput, type TeamMember } from './team-model'
function client() { if (!supabase) throw new Error('데이터베이스 연결 설정이 필요합니다.'); return supabase }
export type TeamDocumentCounts={proposal:number;reports:number;deliverables:number}
export async function loadTeamDocumentCounts(teamId:string):Promise<TeamDocumentCounts>{
  const db=client()
  const [proposal,reports,deliverables]=await Promise.all([
    db.from('AD_proposals').select('team_id',{count:'exact',head:true}).eq('team_id',teamId),
    db.from('AD_reports').select('team_id',{count:'exact',head:true}).eq('team_id',teamId),
    db.from('AD_deliverables').select('team_id',{count:'exact',head:true}).eq('team_id',teamId),
  ])
  if(proposal.error||reports.error||deliverables.error)throw new Error('팀 자료 건수를 불러오지 못했습니다.')
  return {proposal:proposal.count??0,reports:reports.count??0,deliverables:deliverables.count??0}
}
function fail(code: string) {
  if (code === '23505') return new Error('같은 프로그램의 팀명이 중복되거나 참가자가 이미 다른 팀에 배정되어 있습니다.')
  if (code === '23503') return new Error('프로그램·참가 정보가 변경되었거나 팀에 소속 자료가 남아 있습니다. 다시 조회해 주세요.')
  if (code === '40001' || code === '40P01') return new Error('다른 사용자가 정보를 수정했습니다. 목록을 새로고침하고 다시 시도해 주세요.')
  if (code === '42501') return new Error('이 팀에 접근하거나 수정할 권한이 없습니다. 소속과 계정 상태를 확인해 주세요.')
  if (code === '23514' || code === '23502' || code.startsWith('22')) return new Error('팀명·링크·단계와 팀원의 계정 연결·참가 상태를 확인해 주세요.')
  if (code === 'PGRST202' || code === 'PGRST205') return new Error('팀 관리 데이터베이스 설정이 필요합니다.')
  return new Error('팀 정보를 처리하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.')
}
export async function loadTeams(cohortId: string): Promise<{ teams: Team[]; roster: TeamMember[]; candidates: TeamCandidate[] }> {
  const { data, error } = await client().rpc('AD_team_workspace', { p_cohort: cohortId })
  if (error) throw fail(error.code)
  return data
}
export async function saveTeam(cohortId: string, input: TeamInput, members: string[], leader: string | null, previous?: Team) {
  const validation = validateTeam(input)
  if (validation) throw new Error(validation)
  if (previous && previous.cohort_id !== cohortId) throw new Error('프로그램이 변경되었습니다. 다시 조회해 주세요.')
  const { error } = await client().rpc('AD_save_team', { p_cohort: cohortId, p_values: normalizeTeam(input), p_members: members, p_leader: leader, p_team: previous?.id ?? null, p_version: previous?.updated_at ?? null })
  if (error) throw fail(error.code)
}
export async function updateTeamProject(input: TeamInput, previous: Team) {
  const validation = validateTeam(input)
  if (validation) throw new Error(validation)
  const normalized = normalizeTeam(input)
  const values = { topic: normalized.topic, stage: normalized.stage, notion_url: normalized.notion_url, github_url: normalized.github_url, demo_url: normalized.demo_url }
  const { error } = await client().rpc('AD_update_team_project', { p_team: previous.id, p_version: previous.updated_at, p_values: values })
  if (error) throw fail(error.code)
}
export async function deleteEmptyTeam(previous: Team) {
  const { error } = await client().rpc('AD_delete_empty_team', { p_team: previous.id, p_version: previous.updated_at })
  if (error) throw fail(error.code)
}
