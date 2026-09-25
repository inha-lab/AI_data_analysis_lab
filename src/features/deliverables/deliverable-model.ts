import { safeTeamUrl } from '../teams/team-model.ts'
export const deliverableCategories = {
  data_source:'데이터 출처',data_dictionary:'데이터 설명서',analysis:'분석 결과',model_validation:'모델 검증',github:'GitHub',notion:'Notion',presentation:'발표자료',demo:'데모',erd:'ERD',uml:'UML',other:'기타',
} as const
export type DeliverableCategory=keyof typeof deliverableCategories
export interface DeliverableInput {category:DeliverableCategory;title:string;description:string;url:string}
export interface Deliverable extends DeliverableInput {id:string;team_id:string;submitted_by:string;submitted_name:string;submitted_at:string;updated_at:string}
export const emptyDeliverable:DeliverableInput={category:'data_source',title:'',description:'',url:''}
export function deliverableValues(input:DeliverableInput):DeliverableInput{return {category:input.category,title:input.title.trim(),description:input.description,url:safeTeamUrl(input.url)??input.url}}
export function validateDeliverable(input:DeliverableInput):string|null{
  if(!Object.hasOwn(deliverableCategories,input.category))return '산출물 유형을 선택해 주세요.'
  if(!input.title.trim()||input.title.trim().length>120)return '제목은 1~120자로 입력해 주세요.'
  if(input.description.length>4000)return '설명은 4,000자 이내로 입력해 주세요.'
  if(!input.url.trim()||safeTeamUrl(input.url)===null)return '계정 정보가 없는 http/https URL을 입력해 주세요.'
  return null
}
