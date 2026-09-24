import { validateReview } from '../proposals/proposal-model.ts'
export type ReportType = 'daily' | 'weekly'
export const reportTypeLabels: Record<ReportType, string> = { daily: '일일 보고', weekly: '주간 보고' }
export const reportStatusLabels = { draft: '작성 중', submitted: '제출', reviewed: '검토 완료' } as const
export const reportFields = [
  { key: 'progress_summary', label: '진행 요약', help: '보고 기간의 목표와 전체 진행 상황을 작성하세요.' },
  { key: 'completed_work', label: '완료 항목', help: '이번 회차에 완료한 작업과 확인 가능한 결과를 작성하세요.' },
  { key: 'next_plan', label: '다음 계획', help: '다음 기간의 작업, 담당과 일정을 작성하세요.' },
  { key: 'issues', label: '이슈', help: '문제점과 지연 사항을 작성하세요. 없으면 비워 둘 수 있습니다.' },
  { key: 'support_request', label: '지원 요청', help: '운영진의 도움이 필요한 사항을 작성하세요. 없으면 비워 둘 수 있습니다.' },
] as const
export type ReportField = typeof reportFields[number]['key']
export interface ReportInput extends Record<ReportField,string> {
  report_type: ReportType; round_number: string; report_date: string; title: string
}
export interface Report extends Omit<ReportInput,'round_number'> {
  id: string; team_id: string; round_number: number; status: keyof typeof reportStatusLabels
  updated_at: string; updated_name: string; submitted_at: string | null; submitted_name: string | null
  review_note: string; review_action: 'reviewed' | 'returned' | null; reviewed_at: string | null; reviewer_name: string | null
}
export function todayKst() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) }
export function emptyReport(type: ReportType, round = 1): ReportInput {
  return { report_type: type, round_number: String(round), report_date: todayKst(), title: '', progress_summary: '', completed_work: '', next_plan: '', issues: '', support_request: '' }
}
export function reportValues(input: ReportInput): ReportInput {
  return { report_type: input.report_type, round_number: input.round_number.trim(), report_date: input.report_date, title: input.title.trim(), progress_summary: input.progress_summary, completed_work: input.completed_work, next_plan: input.next_plan, issues: input.issues, support_request: input.support_request }
}
function validDate(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !date.startsWith('0000') && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date
}
export function validateReport(input: ReportInput, submit: boolean): string | null {
  if (!Object.hasOwn(reportTypeLabels, input.report_type)) return '보고 구분을 선택해 주세요.'
  if (!/^[0-9]{1,4}$/.test(input.round_number) || Number(input.round_number)<1 || Number(input.round_number)>1000) return '회차는 1~1000 사이로 입력해 주세요.'
  if (!validDate(input.report_date)) return '올바른 작성일을 입력해 주세요.'
  if (!input.title.trim() || input.title.trim().length>120) return '제목은 1~120자로 입력해 주세요.'
  for (const field of reportFields) {
    if (input[field.key].length>8000) return `${field.label}은 8,000자 이내로 입력해 주세요.`
    if (submit && ['progress_summary','completed_work','next_plan'].includes(field.key) && !input[field.key].trim()) return `${field.label}을 작성한 뒤 제출해 주세요.`
  }
  return null
}
export function validateReportReview(status: Report['status'], action: 'reviewed' | 'returned', note: string) { return validateReview(status,action,note) }
export function nextReportRound(reports: Report[], type: ReportType) { return Math.min(1000,Math.max(0,...reports.filter(report=>report.report_type===type).map(report=>report.round_number))+1) }
