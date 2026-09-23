import { supabase } from '@/lib/supabase'
import { validateCohort, type Cohort, type CohortInput } from './cohort-model'
const columns = 'id,name,description,starts_on,ends_on,status,created_at,updated_at'

function client() {
  if (!supabase) throw new Error('데이터베이스 연결 설정이 필요합니다.')
  return supabase
}
function errorMessage(code: string) {
  if (code === '23505') return '같은 이름의 프로그램이 이미 있습니다.'
  if (code === '23514' || code === '22007' || code === '22008') return '프로그램명과 운영 기간을 확인해 주세요.'
  if (code === '42501') return '프로그램 관리 권한이 없습니다. 다시 로그인해 주세요.'
  if (code === 'PGRST205') return '프로그램 관리 데이터베이스 설정이 필요합니다.'
  return '처리하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.'
}
export async function listCohorts(): Promise<Cohort[]> {
  const { data, error } = await client().from('AD_cohorts').select(columns).order('created_at', { ascending: false })
  if (error) throw new Error(errorMessage(error.code))
  return data as Cohort[]
}
export async function saveCohort(input: CohortInput, previous?: Cohort): Promise<Cohort> {
  const validation = validateCohort(input)
  if (validation) throw new Error(validation)
  const values = { ...input, name: input.name.trim(), description: input.description.trim() }
  const table = client().from('AD_cohorts')
  const request = previous ? table.update(values).eq('id', previous.id).eq('updated_at', previous.updated_at) : table.insert(values)
  const { data, error } = await request.select(columns).maybeSingle()
  if (error) throw new Error(errorMessage(error.code))
  if (!data) throw new Error('다른 사용자가 수정했거나 권한이 변경되었습니다. 목록을 새로고침하고 다시 시도해 주세요.')
  return data as Cohort
}
