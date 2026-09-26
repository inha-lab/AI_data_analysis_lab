import { supabase } from '@/lib/supabase'
import type { Team } from '@/features/teams/team-model'
export type MonitoringTeam = Pick<Team,'id'|'name'|'topic'|'stage'> & { proposal_status:'draft'|'submitted'|'reviewed'|null;proposal_title:string|null;daily_submitted:number;weekly_submitted:number;report_drafts:number;reports_awaiting_review:number;reports_needing_attention:number;deliverable_count:number }
export type MonitoringRound = {type:'daily'|'weekly';round:number;submitted_teams:number;latest_date:string|null;missing_teams:{id:string;name:string}[]}
export type ReviewQueueItem = {id:string;team_id:string;team_name:string;report_type:'daily'|'weekly';round_number:number;title:string;submitted_at:string}
export type ProgramMonitoring = {active_participants:number;team_count:number;proposal_submitted:number;deliverable_submitted_teams:number;deliverable_count:number;reports_awaiting_review:number;review_queue:ReviewQueueItem[];teams:MonitoringTeam[];rounds:MonitoringRound[]}
export function proposalRate(submitted:number,total:number){return total?`${Math.round(submitted/total*100)}%`:'대상 없음'}
export async function loadProgramMonitoring(cohortId:string):Promise<ProgramMonitoring>{
  if(!supabase)throw new Error('데이터베이스 연결 설정이 필요합니다.')
  const {data,error}=await supabase.rpc('AD_program_monitoring',{p_cohort:cohortId})
  if(error){
    if(error.code==='42501')throw new Error('프로그램 진행 현황을 조회할 권한이 없습니다.')
    if(error.code==='22023')throw new Error('프로그램을 찾을 수 없습니다.')
    throw new Error('진행 현황을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
  }
  return data as ProgramMonitoring
}
