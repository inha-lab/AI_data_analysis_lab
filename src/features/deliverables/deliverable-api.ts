import { supabase } from '@/lib/supabase'
import { deliverableFileContentType,deliverableFileExtension,deliverableValues,validateDeliverable,validateDeliverableFile,type Deliverable,type DeliverableInput } from './deliverable-model'
const bucket='AD_deliverables'
function client(){if(!supabase)throw new Error('데이터베이스 연결 설정이 필요합니다.');return supabase}
function fail(code:string){
  if(code==='42501')return new Error('현재 팀의 산출물을 조회하거나 변경할 권한이 없습니다.')
  if(code==='40001'||code==='40P01')return new Error('다른 팀원이 산출물을 변경했습니다. 최신 목록을 불러와 주세요.')
  if(code==='23503')return new Error('코멘트가 남은 산출물은 삭제할 수 없습니다. 교수에게 코멘트 삭제를 요청해 주세요.')
  if(code==='23514'||code==='23502'||code.startsWith('22'))return new Error('유형·제목·설명·URL을 확인해 주세요.')
  return new Error('산출물을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.')
}
export async function loadDeliverables(teamId:string){
  const db=client()
  const team=await db.from('AD_teams').select('id,cohort_id,name').eq('id',teamId).maybeSingle()
  if(team.error)throw fail(team.error.code)
  if(!team.data)throw new Error('팀이 없거나 현재 소속 팀에 접근할 수 없습니다.')
  const cohort=await db.from('AD_cohorts').select('status').eq('id',team.data.cohort_id).single()
  if(cohort.error)throw fail(cohort.error.code)
  const items:Deliverable[]=[]
  for(let start=0;;start+=1000){
    const response=await db.from('AD_deliverables').select('id,team_id,category,title,description,url,file_path,file_name,file_size,file_type,submitted_by,submitted_name,submitted_at,updated_at').eq('team_id',teamId).order('submitted_at',{ascending:false}).order('id',{ascending:false}).range(start,start+999)
    if(response.error)throw fail(response.error.code)
    const page=response.data as Deliverable[]
    items.push(...page)
    if(page.length<1000)break
  }
  return {team:team.data,cohortStatus:cohort.data.status as 'active'|'completed',items}
}
export async function saveDeliverable(teamId:string,input:DeliverableInput,previous:Deliverable|null,file:File|null){
  const validation=validateDeliverable(input,Boolean(file||previous?.file_path))
  if(validation)throw new Error(validation)
  if(file){const fileError=validateDeliverableFile(file);if(fileError)throw new Error(fileError)}
  const db=client()
  let uploadedPath:string|null=null
  const filePath=file?`${teamId}/${crypto.randomUUID()}/${crypto.randomUUID()}.${deliverableFileExtension(file.name)}`:previous?.file_path??null
  if(file&&filePath){
    const upload=await db.storage.from(bucket).upload(filePath,file,{contentType:deliverableFileContentType(file.name),upsert:false})
    if(upload.error)throw new Error('파일을 업로드하지 못했습니다. 형식과 크기를 확인해 주세요.')
    uploadedPath=filePath
  }
  const values={...deliverableValues(input),file_path:filePath,file_name:file?.name??previous?.file_name??null,file_size:file?.size??previous?.file_size??null,file_type:file?deliverableFileContentType(file.name):previous?.file_type??null}
  const {error}=await db.rpc('AD_save_deliverable',{p_team:teamId,p_deliverable:previous?.id??null,p_version:previous?.updated_at??null,p_values:values})
  if(error){if(uploadedPath)await db.storage.from(bucket).remove([uploadedPath]);throw fail(error.code)}
  if(file&&previous?.file_path)await db.storage.from(bucket).remove([previous.file_path])
}
export async function deleteDeliverable(teamId:string,previous:Deliverable){
  const db=client()
  const {error}=await db.rpc('AD_delete_deliverable',{p_team:teamId,p_deliverable:previous.id,p_version:previous.updated_at})
  if(error)throw fail(error.code)
  if(previous.file_path)await db.storage.from(bucket).remove([previous.file_path])
}
export async function downloadDeliverableFile(item:Pick<Deliverable,'file_path'|'file_name'>){
  if(!item.file_path)throw new Error('등록된 파일이 없습니다.')
  const {data,error}=await client().storage.from(bucket).createSignedUrl(item.file_path,60,{download:item.file_name??true})
  if(error||!data.signedUrl)throw new Error('파일 다운로드 주소를 만들지 못했습니다.')
  const anchor=document.createElement('a');anchor.href=data.signedUrl;anchor.download=item.file_name??'';anchor.rel='noopener';document.body.append(anchor);anchor.click();anchor.remove()
}
