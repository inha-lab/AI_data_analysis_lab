import { safeTeamUrl } from '../teams/team-model.ts'
export const proposalSections = [
  { key: 'overview', label: '프로젝트 개요 및 문제 정의', help: '추진 배경, 공공·사회 문제, 목표와 핵심 분석 질문을 작성하세요.' },
  { key: 'data_plan', label: '활용 데이터 및 데이터 구성', help: '공공데이터 출처, 주요 항목·규모, 외부 데이터 연계와 전처리 계획을 작성하세요.' },
  { key: 'methods', label: '데이터 분석 및 AI 적용 방법', help: 'EDA, 분석 방법, AI·ML 모델, 특성·파생변수와 모델 선정 이유를 작성하세요.' },
  { key: 'validation', label: '모델 검증 및 결과 분석', help: 'Baseline, 학습·검증 데이터, 평가 지표, 검증 방법과 모델 해석 계획을 작성하세요.' },
  { key: 'service_plan', label: '결과 활용·서비스 구현 및 차별성', help: '시각화·서비스 구현, 정책·행정·시민 서비스 활용, 차별성과 확장성을 작성하세요.' },
  { key: 'execution_plan', label: '수행계획 및 기대효과', help: '일정, 역할 분담, 산출물, 기대효과와 개인정보·AI 윤리·편향 고려 사항을 작성하세요.' },
] as const
export type SectionKey = typeof proposalSections[number]['key']
export type ProposalInput = Record<SectionKey, string> & { title: string; notion_url: string }
export type ProposalStatus = 'draft' | 'submitted' | 'reviewed'
export const proposalStatusLabels = { draft: '작성 중', submitted: '제출', reviewed: '검토 완료' } as const
export interface Proposal extends ProposalInput {
  team_id: string; status: ProposalStatus; updated_at: string; updated_name: string
  submitted_at: string | null; submitted_name: string | null; review_note: string
  review_action: 'reviewed' | 'returned' | null; reviewed_at: string | null; reviewer_name: string | null
}
export function emptyProposal(teamName: string): ProposalInput {
  return { title: `${teamName} 프로젝트 기획서`, notion_url: '', overview: '', data_plan: '', methods: '', validation: '', service_plan: '', execution_plan: '' }
}
export function proposalValues(proposal: ProposalInput): ProposalInput {
  return { title: proposal.title.trim(), notion_url: safeTeamUrl(proposal.notion_url) ?? proposal.notion_url, overview: proposal.overview, data_plan: proposal.data_plan, methods: proposal.methods, validation: proposal.validation, service_plan: proposal.service_plan, execution_plan: proposal.execution_plan }
}
export function validateProposal(input: ProposalInput, submit: boolean): string | null {
  if (!input.title.trim() || input.title.trim().length > 120) return '프로젝트명은 1~120자로 입력해 주세요.'
  if (safeTeamUrl(input.notion_url) === null) return 'Notion 보조 링크는 계정 정보가 없는 http/https 주소로 입력해 주세요.'
  for (const section of proposalSections) {
    if (input[section.key].length > 8000) return `${section.label} 항목은 8,000자 이내로 입력해 주세요.`
    if (submit && !input[section.key].trim()) return `${section.label} 항목을 작성한 뒤 제출해 주세요.`
  }
  return null
}
export function validateReview(status: ProposalStatus, action: 'reviewed' | 'returned', note: string): string | null {
  if (note.length > 4000) return '피드백은 4,000자 이내로 입력해 주세요.'
  if (action === 'reviewed' ? status !== 'submitted' : !['submitted', 'reviewed'].includes(status)) return '현재 상태에서는 이 검토 작업을 할 수 없습니다.'
  if (action === 'returned' && !note.trim()) return '수정 요청 사유를 입력해 주세요.'
  return null
}
