import { supabase } from '@/lib/supabase'
import { invokeFunction } from '@/lib/functions'
import { normalizeParticipant, validateBulkParticipantStatus, validateParticipant, type Participant, type ParticipantInput, type ParticipantStatus } from './participant-model'
const columns = 'id,cohort_id,profile_id,full_name,email,department,student_number,grade,gender,phone,job_group,job_group_other,status,created_at,updated_at'
function client() {
  if (!supabase) throw new Error('데이터베이스 연결 설정이 필요합니다.')
  return supabase
}
function errorMessage(code: string) {
  if (code === '23505') return '이 프로그램에 같은 이메일 또는 학번의 참가자가 이미 등록되어 있습니다.'
  if (code === '23503') return '프로그램 정보를 확인하지 못했습니다. 새로고침 후 다시 시도해 주세요.'
  if (code === '23514') return '필수 입력값과 이메일·연락처 형식을 확인해 주세요.'
  if (code === '42501') return '참가자 관리 권한이 없습니다. 다시 로그인해 주세요.'
  if (code === 'PGRST205') return '참가자 데이터베이스 설정이 필요합니다.'
  if (code === '40001') return '다른 사용자가 참가자 정보를 변경했습니다. 목록을 새로고침한 뒤 다시 수정해 주세요.'
  if (code === 'P0002') return '참가자 정보를 찾을 수 없습니다. 목록을 새로고침해 주세요.'
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
  if (previous && previous.cohort_id !== cohortId) throw new Error('선택한 프로그램과 참가자 정보가 일치하지 않습니다.')
  const values = normalizeParticipant(input)
  const request = previous
    ? client().rpc('AD_update_participant', {
      p_participant: previous.id, p_cohort: cohortId, p_version: previous.updated_at,
      p_full_name: values.full_name, p_email: values.email, p_department: values.department,
      p_student_number: values.student_number, p_grade: values.grade, p_gender: values.gender,
      p_phone: values.phone, p_job_group: values.job_group,
      p_job_group_other: values.job_group_other ?? null, p_status: values.status,
    }).select(columns).maybeSingle()
    : client().rpc('AD_create_participant', {
      p_cohort: cohortId, p_full_name: values.full_name, p_email: values.email,
      p_department: values.department, p_student_number: values.student_number,
      p_grade: values.grade, p_gender: values.gender, p_phone: values.phone,
      p_job_group: values.job_group, p_job_group_other: values.job_group_other ?? null,
      p_status: values.status,
    }).select(columns).maybeSingle()
  const { data, error } = await request
  if (error) throw new Error(errorMessage(error.code))
  if (!data) throw new Error('다른 사용자가 수정했거나 권한이 변경되었습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.')
  return data as Participant
}
export async function bulkUpdateParticipantStatus(cohortId:string,participantIds:string[],status:ParticipantStatus):Promise<number>{
  const validation=validateBulkParticipantStatus(participantIds,status)
  if(validation)throw new Error(validation)
  const {data,error}=await client().rpc('AD_bulk_update_participant_status',{p_cohort:cohortId,p_participants:participantIds,p_status:status})
  if(error)throw new Error(errorMessage(error.code))
  return data as number
}
export async function deleteParticipant(participant:Participant):Promise<void>{
  await invokeFunction<{success:boolean}>('ad-delete-participant',{participantId:participant.id,version:participant.updated_at})
}
