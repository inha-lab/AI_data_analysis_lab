export const jobGroups = {
  sw_engineering: 'SW 엔지니어링', sw_development: 'SW 개발', ai_development: 'AI 개발',
} as const
export type JobGroup = keyof typeof jobGroups
export type ParticipantStatus = 'active' | 'completed' | 'dropout' | 'inactive'
export const participantStatusLabels: Record<ParticipantStatus,string> = { active:'참여 중',completed:'프로그램 수료',dropout:'프로그램 중탈',inactive:'비활성' }
export interface ParticipantInput {
  full_name: string
  email: string
  department: string
  student_number: string
  grade: string
  phone: string
  job_group: JobGroup
  status: ParticipantStatus
}
export interface Participant extends ParticipantInput {
  id: string
  cohort_id: string
  profile_id: string | null
  created_at: string
  updated_at: string
}
export function validateParticipant(input: ParticipantInput): string | null {
  const required = [
    ['이름', input.full_name, 80], ['학과', input.department, 100],
    ['학번', input.student_number, 40], ['학년', input.grade, 30],
  ] as const
  for (const [label, value, limit] of required) {
    if (!value.trim() || value.trim().length > limit) return `${label}은(는) 1~${limit}자로 입력해 주세요.`
  }
  if (input.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return '올바른 이메일을 입력해 주세요.'
  if (!/^[+0-9() .-]+$/.test(input.phone.trim()) || input.phone.trim().length > 30 || !/^\d{9,15}$/.test(input.phone.replace(/\D/g, ''))) return '전화번호는 숫자 9~15자리로 입력해 주세요.'
  if (!Object.hasOwn(jobGroups, input.job_group)) return '희망 직무를 선택해 주세요.'
  if (!Object.hasOwn(participantStatusLabels,input.status)) return '참여 상태를 확인해 주세요.'
  return null
}
export function normalizeParticipant(input: ParticipantInput): ParticipantInput {
  return { ...input, full_name: input.full_name.trim(), email: input.email.trim().toLowerCase(),
    department: input.department.trim(), student_number: input.student_number.trim(),
    grade: input.grade.trim(), phone: input.phone.trim() }
}
