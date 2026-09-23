import { supabase } from '@/lib/supabase'
import { validateSchedule, type Schedule, type ScheduleInput, type ScheduleDisplay } from './schedule-model'
const columns = 'id,cohort_id,title,description,stage,kind,starts_at,ends_at,is_public,is_cancelled,updated_at'
function client() {
  if (!supabase) throw new Error('데이터베이스 연결 설정이 필요합니다.')
  return supabase
}
function fail(code: string) {
  if (code === '23514' || code.startsWith('22')) return new Error('일정 제목·단계·일시를 확인해 주세요.')
  if (code === '42501') return new Error('일정을 관리할 권한이 없습니다. 다시 로그인해 주세요.')
  if (code === 'PGRST205' || code === 'PGRST202') return new Error('일정 데이터베이스 설정이 필요합니다.')
  return new Error('일정을 처리하지 못했습니다. 새로고침 후 다시 시도해 주세요.')
}
export async function listSchedules(cohortId: string): Promise<Schedule[]> {
  const { data, error } = await client().from('AD_schedules').select(columns).eq('cohort_id', cohortId).order('starts_at').order('id')
  if (error) throw fail(error.code)
  return data as Schedule[]
}
export async function listPublicSchedules(): Promise<ScheduleDisplay[]> {
  const { data, error } = await client().rpc('AD_public_schedules')
  if (error) throw fail(error.code)
  return data as ScheduleDisplay[]
}
export async function saveSchedule(cohortId: string, input: ScheduleInput, previous?: Schedule): Promise<Schedule> {
  const validation = validateSchedule(input)
  if (validation) throw new Error(validation)
  if (previous && previous.cohort_id !== cohortId) throw new Error('선택한 프로그램이 변경되었습니다. 다시 조회해 주세요.')
  const values = { ...input, title: input.title.trim(), description: input.description.trim() }
  const table = client().from('AD_schedules')
  const request = previous ? table.update(values).eq('id', previous.id).eq('cohort_id', cohortId).eq('updated_at', previous.updated_at) : table.insert({ ...values, cohort_id: cohortId })
  const { data, error } = await request.select(columns).maybeSingle()
  if (error) throw fail(error.code)
  if (!data) throw new Error('다른 사용자가 수정했거나 권한이 변경되었습니다. 목록을 새로고침하고 다시 시도해 주세요.')
  return data as Schedule
}
