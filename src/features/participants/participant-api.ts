import { supabase } from '@/lib/supabase'
import { normalizeParticipant, validateParticipant, type Participant, type ParticipantInput } from './participant-model'
const columns = 'id,cohort_id,profile_id,full_name,email,department,student_number,grade,phone,job_group,status,created_at,updated_at'
function client() {
  if (!supabase) throw new Error('데이터베이스 연결 설정이 필요합니다.')
  return supabase
}
function errorMessage(code: string) {
  if (code === '23505') return '이 기수에 같은 이메일 또는 학번의 참가자가 이미 등록되어 있습니다.'
  if (code === '23503') return '기수 정보를 확인하지 못했습니다. 새로고침 후 다시 시도해 주세요.'
  if (code === '23514') return '필수 입력값과 이메일·전화번호 형식을 확인해 주세요.'
  if (code === '42501') return '참가자 관리 권한이 없습니다. 다시 로그인해 주세요.'
  if (code === 'PGRST205') return '참가자 데이터베이스 설정이 필요합니다.'
  return '처리하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.'
}
export async function listParticipants(cohortId: string): Promise<Participant[]> {
  const { data, error } = await client().from('AD_participants').select(columns).eq('cohort_id', cohortId).order('created_at', { ascending: false })
  if (error) throw new Error(errorMessage(error.code))
  return data as Participant[]
}
export async function saveParticipant(cohortId: string, input: ParticipantInput, previous?: Participant): Promise<Participant> {
  const validation = validateParticipant(input)
  if (validation) throw new Error(validation)
  if (previous && previous.cohort_id !== cohortId) throw new Error('선택한 기수와 참가자 정보가 일치하지 않습니다.')
  const table = client().from('AD_participants')
  const values = normalizeParticipant(input)
  const request = previous
    ? table.update(values).eq('cohort_id', cohortId).eq('id', previous.id).eq('updated_at', previous.updated_at)
    : table.insert({ ...values, cohort_id: cohortId })
  const { data, error } = await request.select(columns).maybeSingle()
  if (error) throw new Error(errorMessage(error.code))
  if (!data) throw new Error('다른 사용자가 수정했거나 권한이 변경되었습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.')
  return data as Participant
}
