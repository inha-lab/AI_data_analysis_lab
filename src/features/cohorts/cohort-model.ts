export type CohortStatus = 'draft' | 'active' | 'completed'
export interface Cohort {
  id: string
  name: string
  description: string
  starts_on: string | null
  ends_on: string | null
  status: CohortStatus
  created_at: string
  updated_at: string
}
export interface CohortInput {
  name: string
  description: string
  starts_on: string | null
  ends_on: string | null
  status: CohortStatus
}
export const cohortStatusLabels: Record<CohortStatus, string> = { draft: '준비 중', active: '운영 중', completed: '종료' }
export function validateCohort(input: CohortInput): string | null {
  if (!input.name.trim() || input.name.trim().length > 80) return '프로그램명은 1~80자로 입력해 주세요.'
  if (input.description.length > 2000) return '소개는 2,000자 이내로 입력해 주세요.'
  if (!Object.hasOwn(cohortStatusLabels, input.status)) return '운영 상태를 확인해 주세요.'
  if (Boolean(input.starts_on) !== Boolean(input.ends_on)) return '운영 시작일과 종료일을 함께 입력해 주세요.'
  for (const date of [input.starts_on, input.ends_on]) {
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) return '올바른 날짜를 입력해 주세요.'
  }
  if (input.starts_on && input.ends_on && input.ends_on < input.starts_on) return '종료일은 시작일 이후여야 합니다.'
  return null
}
export function cohortPeriod(cohort: Cohort) {
  return cohort.starts_on && cohort.ends_on ? `${cohort.starts_on} ~ ${cohort.ends_on}` : '운영 기간 미정'
}
