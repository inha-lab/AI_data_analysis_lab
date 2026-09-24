import { supabase } from '@/lib/supabase'
import { reportValues, validateReport, validateReportReview, type Report, type ReportInput } from './report-model'
const columns = 'id,team_id,report_type,round_number,report_date,title,progress_summary,completed_work,next_plan,issues,support_request,status,updated_at,updated_name,submitted_at,submitted_name,review_note,review_action,reviewed_at,reviewer_name'
function client() { if (!supabase) throw new Error('데이터베이스 연결 설정이 필요합니다.'); return supabase }
function fail(code: string) {
  if (code==='23505') return new Error('같은 팀의 동일한 보고 구분·회차가 이미 있습니다. 목록을 확인해 주세요.')
  if (code==='40001' || code==='40P01') return new Error('다른 팀원이나 교수가 보고서를 수정했습니다. 입력 내용을 복사한 뒤 최신 목록을 불러와 주세요.')
  if (code==='42501') return new Error('이 팀의 보고서에 접근하거나 수정할 권한이 없습니다.')
  if (code==='55000') return new Error('검토 완료되었거나 보고서 상태가 변경되었습니다. 최신 목록을 확인해 주세요.')
  if (code==='23514' || code==='23502' || code.startsWith('22')) return new Error('구분·회차·작성일·제목과 필수 내용을 확인해 주세요.')
  if (code==='PGRST202' || code==='PGRST205') return new Error('보고서 데이터베이스 설정이 필요합니다.')
  return new Error('보고서를 처리하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.')
}
export async function loadReports(teamId: string) {
  const db=client()
  const [team,reports]=await Promise.all([
    db.from('AD_teams').select('id,cohort_id,name').eq('id',teamId).maybeSingle(),
    db.from('AD_reports').select(columns).eq('team_id',teamId).order('report_date',{ascending:false}).order('updated_at',{ascending:false}),
  ])
  if (team.error) throw fail(team.error.code)
  if (reports.error) throw fail(reports.error.code)
  if (!team.data) throw new Error('팀이 없거나 현재 소속 팀에 접근할 수 없습니다.')
  return {team:team.data,reports:reports.data as Report[]}
}
export async function saveReport(teamId:string,input:ReportInput,submit:boolean,previous:Report|null):Promise<string> {
  const validation=validateReport(input,submit)
  if (validation) throw new Error(validation)
  const {data,error}=await client().rpc('AD_save_report',{p_team:teamId,p_report:previous?.id??null,p_version:previous?.updated_at??null,p_values:reportValues(input),p_submit:submit})
  if (error) throw fail(error.code)
  return data as string
}
export async function reviewReport(previous:Report,action:'reviewed'|'returned',note:string) {
  const validation=validateReportReview(previous.status,action,note)
  if (validation) throw new Error(validation)
  const {error}=await client().rpc('AD_review_report',{p_report:previous.id,p_version:previous.updated_at,p_action:action,p_note:note})
  if (error) throw fail(error.code)
}
