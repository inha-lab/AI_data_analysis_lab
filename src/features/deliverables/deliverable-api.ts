import { supabase } from '@/lib/supabase'
import { deliverableValues,validateDeliverable,type Deliverable,type DeliverableInput } from './deliverable-model'
function client(){if(!supabase)throw new Error('데이터베이스 연결 설정이 필요합니다.');return supabase}
function fail(code:string){
  if(code==='42501')return new Error('현재 팀의 산출물을 조회하거나 변경할 권한이 없습니다.')
  if(code==='40001'||code==='40P01')return new Error('다른 팀원이 산출물을 변경했습니다. 최신 목록을 불러와 주세요.')
  if(code==='23514'||code==='23502'||code.startsWith('22'))return new Error('유형·제목·설명·URL을 확인해 주세요.')
  return new Error('산출물을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.')
}
export async function loadDeliverables(teamId:string){
  const db=client()
  const team=await db.from('AD_teams').select('id,cohort_id,name').eq('id',teamId).maybeSingle()
  if(team.error)throw fail(team.error.code)
  if(!team.data)throw new Error('팀이 없거나 현재 소속 팀에 접근할 수 없습니다.')
  const items:Deliverable[]=[]
  for(let start=0;;start+=1000){
    const response=await db.from('AD_deliverables').select('id,team_id,category,title,description,url,submitted_by,submitted_name,submitted_at,updated_at').eq('team_id',teamId).order('submitted_at',{ascending:false}).order('id',{ascending:false}).range(start,start+999)
    if(response.error)throw fail(response.error.code)
    const page=response.data as Deliverable[]
    items.push(...page)
    if(page.length<1000)break
  }
  return {team:team.data,items}
}
export async function saveDeliverable(teamId:string,input:DeliverableInput,previous:Deliverable|null){
  const validation=validateDeliverable(input)
  if(validation)throw new Error(validation)
  const {error}=await client().rpc('AD_save_deliverable',{p_team:teamId,p_deliverable:previous?.id??null,p_version:previous?.updated_at??null,p_values:deliverableValues(input)})
  if(error)throw fail(error.code)
}
export async function deleteDeliverable(teamId:string,previous:Deliverable){
  const {error}=await client().rpc('AD_delete_deliverable',{p_team:teamId,p_deliverable:previous.id,p_version:previous.updated_at})
  if(error)throw fail(error.code)
}
