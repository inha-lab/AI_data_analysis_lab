import { supabase } from '@/lib/supabase'

export type Announcement={id:string;cohort_id:string;title:string;body:string;is_pinned:boolean;author_id:string;author_name:string;created_at:string;updated_at:string}
export type AnnouncementInput={title:string;body:string;is_pinned:boolean}
function client(){if(!supabase)throw new Error('데이터베이스 연결 설정이 필요합니다.');return supabase}
function fail(code:string){
  if(code==='42501')return new Error('공지사항을 관리할 권한이 없습니다.')
  if(code==='40001')return new Error('다른 곳에서 공지가 변경되었습니다. 새로고침해 주세요.')
  if(code==='23514'||code==='23502')return new Error('공지 제목과 내용을 확인해 주세요.')
  return new Error('공지사항을 처리하지 못했습니다. 다시 시도해 주세요.')
}
export function validateAnnouncement(input:AnnouncementInput){
  if(!input.title.trim()||input.title.trim().length>120)return '제목은 1~120자로 입력해 주세요.'
  if(!input.body.trim()||input.body.trim().length>10000)return '내용은 1~10,000자로 입력해 주세요.'
  return ''
}
export async function listAnnouncements(cohortId:string){
  const rows:Announcement[]=[]
  for(let start=0;;start+=1000){
    const {data,error}=await client().from('AD_announcements').select('id,cohort_id,title,body,is_pinned,author_id,author_name,created_at,updated_at').eq('cohort_id',cohortId).order('is_pinned',{ascending:false}).order('created_at',{ascending:false}).order('id',{ascending:false}).range(start,start+999)
    if(error)throw fail(error.code)
    const page=data as Announcement[];rows.push(...page)
    if(page.length<1000)break
  }
  return rows
}
export async function saveAnnouncement(cohortId:string,input:AnnouncementInput,previous:Announcement|null){
  const validation=validateAnnouncement(input);if(validation)throw new Error(validation)
  const {error}=await client().rpc('AD_save_announcement',{p_cohort:cohortId,p_announcement:previous?.id??null,p_version:previous?.updated_at??null,p_title:input.title.trim(),p_body:input.body.trim(),p_pinned:input.is_pinned})
  if(error)throw fail(error.code)
}
export async function deleteAnnouncement(cohortId:string,previous:Announcement){
  const {error}=await client().rpc('AD_delete_announcement',{p_cohort:cohortId,p_announcement:previous.id,p_version:previous.updated_at})
  if(error)throw fail(error.code)
}
