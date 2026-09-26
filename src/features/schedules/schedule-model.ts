export const stageLabels = { planning: '기획', design: '설계', implementation: '구현', presentation: '발표', deliverables: '산출물 확인', other: '기타' } as const
export type Stage = keyof typeof stageLabels
export interface ScheduleInput {
  title: string; description: string; stage: Stage; kind: 'event' | 'deadline'
  starts_at: string; ends_at: string; is_public: boolean; is_cancelled: boolean
}
export interface Schedule extends ScheduleInput { id: string; cohort_id: string; updated_at: string }
export type ScheduleDisplay = Pick<Schedule, 'id' | 'title' | 'description' | 'stage' | 'kind' | 'starts_at' | 'ends_at' | 'is_cancelled'> & { program_name: string }
export function toKstInput(iso: string): string {
  return new Date(Date.parse(iso) + 9 * 60 * 60 * 1000).toISOString().slice(0, 16)
}
export function fromKstInput(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || value.startsWith('0000')) throw new Error('올바른 일시를 입력해 주세요.')
  const millis = Date.parse(`${value}:00+09:00`)
  if (!Number.isFinite(millis) || toKstInput(new Date(millis).toISOString()) !== value) throw new Error('올바른 일시를 입력해 주세요.')
  return new Date(millis).toISOString()
}
export function validateSchedule(input: ScheduleInput): string | null {
  if (!input.title.trim() || input.title.trim().length > 120) return '일정 제목은 1~120자로 입력해 주세요.'
  if (input.description.length > 4000) return '설명은 4,000자 이내로 입력해 주세요.'
  if (!Object.hasOwn(stageLabels, input.stage) || !['event', 'deadline'].includes(input.kind)) return '단계와 일정 종류를 확인해 주세요.'
  const start = Date.parse(input.starts_at), end = Date.parse(input.ends_at)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return '시작·종료 일시를 입력해 주세요.'
  if (end < start) return '종료 일시는 시작 일시 이후여야 합니다.'
  if (input.kind === 'deadline' && end !== start) return '제출 마감은 하나의 마감 일시로 설정해 주세요.'
  return null
}
export function scheduleState(schedule: Pick<Schedule, 'starts_at' | 'ends_at' | 'kind' | 'is_cancelled'>, now = Date.now()) {
  if (schedule.is_cancelled) return '취소'
  if (now > Date.parse(schedule.ends_at)) return schedule.kind === 'deadline' ? '마감' : '종료'
  if (now < Date.parse(schedule.starts_at) || schedule.kind === 'deadline') return '예정'
  return '진행 중'
}
export function upcomingSchedules(schedules: Schedule[], now = Date.now(), limit = 3): Schedule[] {
  return schedules.filter(item => !item.is_cancelled && Date.parse(item.ends_at) >= now)
    .sort((left, right) => Math.max(Date.parse(left.starts_at), now) - Math.max(Date.parse(right.starts_at), now) || Date.parse(left.ends_at) - Date.parse(right.ends_at))
    .slice(0, limit)
}
export function formatScheduleTime(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
}
