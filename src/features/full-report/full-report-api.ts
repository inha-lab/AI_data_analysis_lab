import { supabase } from '@/lib/supabase'
import type { FullReportData } from './full-report-model'
import { loadDeliverables } from '@/features/deliverables/deliverable-api'
export async function loadFullReport(teamId:string):Promise<FullReportData>{
  if(!supabase)throw new Error('데이터베이스 연결 설정이 필요합니다.')
  const [result,deliverables]=await Promise.all([supabase.rpc('AD_team_full_report',{p_team:teamId}),loadDeliverables(teamId)])
  const {data,error}=result
  if(error)throw new Error(error.code==='42501'?'현재 팀의 전체리포트를 조회할 권한이 없습니다.':'전체리포트를 불러오지 못했습니다. 다시 시도해 주세요.')
  return {...data as Omit<FullReportData,'deliverables'>,deliverables:deliverables.items}
}
