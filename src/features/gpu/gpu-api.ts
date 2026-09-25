import { supabase } from '@/lib/supabase'
import { gpuIds,validateReservation,type GpuApplication,type GpuReservation,type ReservationInput,type TeamOption } from './gpu-model'
function client(){if(!supabase)throw new Error('데이터베이스 연결 설정이 필요합니다.');return supabase}
function fail(code:string){
  if(code==='23P01')return new Error('선택한 시간에 GPU 예약이 겹칩니다. 다른 시간이나 GPU를 선택해 주세요.')
  if(code==='42501')return new Error('이 프로그램의 GPU 예약을 조회하거나 변경할 권한이 없습니다.')
  if(code==='23514'||code==='23502'||code.startsWith('22'))return new Error('예약일·시간·GPU·사용 목적을 확인해 주세요.')
  return new Error('GPU 예약을 처리하지 못했습니다. 다시 시도해 주세요.')
}
export async function listGpuTeams(cohortId:string){
  const {data,error}=await client().from('AD_teams').select('id,name,topic').eq('cohort_id',cohortId).order('name')
  if(error)throw fail(error.code)
  return data as TeamOption[]
}
export async function listGpuDay(cohortId:string,day:string){
  const {data,error}=await client().rpc('AD_gpu_day_schedule_v2',{p_cohort:cohortId,p_day:day})
  if(error)throw fail(error.code)
  return data as GpuReservation[]
}
export async function saveGpuReservation(input:ReservationInput){
  const message=validateReservation(input);if(message)throw new Error(message)
  const {error}=await client().rpc('AD_save_gpu_reservation',{p_team:input.teamId,p_day:input.day,p_start:input.start,p_end:input.end,p_gpu_ids:gpuIds(input.choice),p_purpose:input.purpose.trim()})
  if(error)throw fail(error.code)
}
export async function listGpuApplications(cohortId:string){
  const rows:GpuApplication[]=[]
  for(let start=0;;start+=1000){
    const {data,error}=await client().rpc('AD_gpu_application_list',{p_cohort:cohortId}).range(start,start+999)
    if(error)throw fail(error.code)
    rows.push(...data as GpuApplication[])
    if(!data||data.length<1000)return rows
  }
}
export async function cancelGpuApplication(id:string){
  const {error}=await client().rpc('AD_cancel_gpu_application',{p_application:id})
  if(error)throw error.code==='23514'?new Error('이미 삭제된 신청입니다. 현황을 새로고침해 주세요.'):fail(error.code)
}
