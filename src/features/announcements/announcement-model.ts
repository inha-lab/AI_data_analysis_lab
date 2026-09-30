export type Announcement={id:string;cohort_id:string;title:string;body:string;is_pinned:boolean;file_path:string|null;file_name:string|null;file_size:number|null;file_type:string|null;author_id:string;author_name:string;created_at:string;updated_at:string}
export type AnnouncementInput={title:string;body:string;is_pinned:boolean}
const maxFileSize=20*1024*1024
const allowedExtensions=new Set(['pdf','ppt','pptx','doc','docx','xls','xlsx','hwp','hwpx','zip','jpg','jpeg','png'])
export function validateAnnouncement(input:AnnouncementInput){
  if(!input.title.trim()||input.title.trim().length>120)return '제목은 1~120자로 입력해 주세요.'
  if(!input.body.trim()||input.body.trim().length>10000)return '내용은 1~10,000자로 입력해 주세요.'
  return ''
}
export function validateAnnouncementFile(file:{name:string;size:number}){
  if(!file.name.trim()||file.name.length>255)return '첨부파일 이름은 255자 이내여야 합니다.'
  const extension=file.name.split('.').pop()?.toLowerCase()??''
  if(!allowedExtensions.has(extension))return 'PDF, Office 문서, 한글 문서, ZIP, JPG, PNG 파일만 첨부할 수 있습니다.'
  if(file.size<1||file.size>maxFileSize)return '첨부파일은 20MB 이하만 등록할 수 있습니다.'
  return ''
}
