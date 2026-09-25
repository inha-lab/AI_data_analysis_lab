import { jobGroups, type JobGroup } from '../participants/participant-model.ts'
export const teamStages = { planning: '기획', design: '설계', implementation: '구현', presentation: '발표', deliverables: '산출물 확인' } as const
export interface TeamProject { topic: string; stage: keyof typeof teamStages; notion_url: string; github_url: string; demo_url: string }
export interface TeamInput extends TeamProject { name: string }
export interface Team extends TeamInput { id: string; cohort_id: string; updated_at: string }
export interface TeamMember { team_id: string; participant_id: string; full_name: string; department: string; job_group: JobGroup; is_leader: boolean; is_active: boolean; role_title: string }
export const eligibilityLabels = { ready: '배정 가능', unlinked: '계정 연결 필요', inactive_participant: '참가 비활성', inactive_profile: '계정 비활성', wrong_role: '학생 계정 필요' } as const
export interface TeamCandidate { participant_id: string; full_name: string; department: string; job_group: JobGroup; team_id: string | null; eligibility: keyof typeof eligibilityLabels }
export const emptyTeam: TeamInput = { name: '', topic: '', stage: 'planning', notion_url: '', github_url: '', demo_url: '' }
export function safeTeamUrl(value: string): string | null {
  const text = value.trim()
  if (!text) return ''
  if (text.length > 2000 || /\s/.test(text) || !/^https?:\/\//i.test(text)) return null
  try {
    const url = new URL(text)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname || url.href.length > 2000) return null
    // Keep the same host/path contract as the database; credentials and IPv6 literals are unsupported.
    return /^https?:\/\/[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#][^\s]*)?$/.test(url.href) ? url.href : null
  } catch { return null }
}
export function normalizeTeam(input: TeamInput): TeamInput {
  return { ...input, name: input.name.trim(), topic: input.topic.trim(), notion_url: safeTeamUrl(input.notion_url) ?? input.notion_url, github_url: safeTeamUrl(input.github_url) ?? input.github_url, demo_url: safeTeamUrl(input.demo_url) ?? input.demo_url }
}
export function validateTeam(input: TeamInput): string | null {
  if (!input.name.trim() || input.name.trim().length > 80) return '팀명은 1~80자로 입력해 주세요.'
  if (input.topic.length > 2000) return '프로젝트 주제는 2,000자 이내로 입력해 주세요.'
  if (!Object.hasOwn(teamStages, input.stage)) return '프로젝트 단계를 확인해 주세요.'
  for (const [label, value] of [['Notion', input.notion_url], ['GitHub', input.github_url], ['데모', input.demo_url]]) if (safeTeamUrl(value) === null) return `${label} 링크는 계정 정보가 없는 http/https 주소로 입력해 주세요.`
  return null
}
export function validateTeamMembers(ids: string[], leader: string | null, candidates: TeamCandidate[], teamId?: string): string | null {
  if (new Set(ids).size !== ids.length) return '같은 참가자를 중복 배정할 수 없습니다.'
  if (leader && !ids.includes(leader)) return '팀장은 선택한 팀원 중에서 지정해 주세요.'
  for (const id of ids) {
    const candidate = candidates.find(item => item.participant_id === id)
    if (!candidate || candidate.eligibility !== 'ready') return '활성 학생 계정과 연결된 참가자만 배정할 수 있습니다.'
    if (candidate.team_id && candidate.team_id !== teamId) return '다른 팀에 배정된 참가자는 기존 팀에서 해제한 뒤 배정해 주세요.'
  }
  return null
}
export function validateMemberRoles(ids:string[],roles:Record<string,string>):string|null{
  for(const [id,role] of Object.entries(roles))if(!ids.includes(id)||role.trim().length>80)return '팀원 역할은 배정된 팀원에게만 80자 이내로 입력해 주세요.'
  return null
}
export function teamSizeHint(count: number) { return count >= 4 && count <= 5 ? '기본 권장 인원 4~5명에 맞습니다.' : `현재 ${count}명입니다. 기본 권장 인원은 4~5명이며 다른 인원수도 저장할 수 있습니다.` }
export function jobSummary(members: Pick<TeamMember, 'job_group'>[]) {
  return Object.entries(jobGroups).map(([key, label]) => `${label} ${members.filter(member => member.job_group === key).length}명`).join(' · ')
}
