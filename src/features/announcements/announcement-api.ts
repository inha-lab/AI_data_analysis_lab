import { supabase } from '@/lib/supabase'
import { validateAnnouncement, validateAnnouncementFile, type Announcement, type AnnouncementInput } from './announcement-model'

const bucket='AD_announcements'
function safeFileName(name:string){return name.normalize('NFC').replace(/[^0-9A-Za-z가-힣._-]+/g,'_').slice(-180)||'attachment'}
function client(){if(!supabase)throw new Error('데이터베이스 연결 설정이 필요합니다.');return supabase}
function fail(code:string){
  if(code==='42501')return new Error('공지사항을 관리할 권한이 없습니다.')
  if(code==='40001')return new Error('다른 곳에서 공지가 변경되었습니다. 새로고침해 주세요.')
  if(code==='23514'||code==='23502')return new Error('공지 제목과 내용을 확인해 주세요.')
  return new Error('공지사항을 처리하지 못했습니다. 다시 시도해 주세요.')
}
export async function listAnnouncements(cohortId:string){
  const rows:Announcement[]=[]
  for(let start=0;;start+=1000){
    const {data,error}=await client().from('AD_announcements').select('id,cohort_id,title,body,is_pinned,file_path,file_name,file_size,file_type,author_id,author_name,created_at,updated_at').eq('cohort_id',cohortId).order('is_pinned',{ascending:false}).order('created_at',{ascending:false}).order('id',{ascending:false}).range(start,start+999)
    if(error)throw fail(error.code)
    const page=data as Announcement[];rows.push(...page)
    if(page.length<1000)break
  }
  return rows
}
export async function listRecentAnnouncements(cohortId:string,limit=3){
  const {data,error}=await client().from('AD_announcements').select('id,cohort_id,title,body,is_pinned,file_path,file_name,file_size,file_type,author_id,author_name,created_at,updated_at').eq('cohort_id',cohortId).order('is_pinned',{ascending:false}).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(limit)
  if(error)throw fail(error.code)
  return data as Announcement[]
}
export async function saveAnnouncement(cohortId:string,input:AnnouncementInput,previous:Announcement|null,file:File|null,removeFile:boolean){
  const validation=validateAnnouncement(input);if(validation)throw new Error(validation)
  if(file){const fileError=validateAnnouncementFile(file);if(fileError)throw new Error(fileError)}
  const db=client();let uploadedPath:string|null=null
  let filePath=removeFile?null:previous?.file_path??null,fileName=removeFile?null:previous?.file_name??null,fileSize=removeFile?null:previous?.file_size??null,fileType=removeFile?null:previous?.file_type??null
  if(file){uploadedPath=`${cohortId}/${crypto.randomUUID()}/${safeFileName(file.name)}`;const upload=await db.storage.from(bucket).upload(uploadedPath,file,{contentType:file.type||'application/octet-stream',upsert:false});if(upload.error)throw new Error('첨부파일을 업로드하지 못했습니다.');filePath=uploadedPath;fileName=file.name;fileSize=file.size;fileType=file.type||'application/octet-stream'}
  const {error}=await db.rpc('AD_save_announcement',{p_cohort:cohortId,p_announcement:previous?.id??null,p_version:previous?.updated_at??null,p_title:input.title.trim(),p_body:input.body.trim(),p_pinned:input.is_pinned,p_file_path:filePath,p_file_name:fileName,p_file_size:fileSize,p_file_type:fileType})
  if(error){if(uploadedPath)await db.storage.from(bucket).remove([uploadedPath]);throw fail(error.code)}
  if(previous?.file_path&&previous.file_path!==filePath)await db.storage.from(bucket).remove([previous.file_path])
}
export async function deleteAnnouncement(cohortId:string,previous:Announcement){
  const db=client();const {error}=await db.rpc('AD_delete_announcement',{p_cohort:cohortId,p_announcement:previous.id,p_version:previous.updated_at})
  if(error)throw fail(error.code)
  if(previous.file_path)await db.storage.from(bucket).remove([previous.file_path])
}
export async function downloadAnnouncementFile(item:Announcement){
  if(!item.file_path)throw new Error('첨부파일이 없습니다.')
  const {data,error}=await client().storage.from(bucket).createSignedUrl(item.file_path,60,{download:item.file_name??true})
  if(error||!data?.signedUrl)throw new Error('첨부파일 다운로드 주소를 만들지 못했습니다.')
  window.location.assign(data.signedUrl)
}
