import { authenticate,body,handle,json } from '../_shared/http.ts'
import { PublicError } from '../_shared/provision.ts'

Deno.serve(handle(async request=>{
  const {admin}=await authenticate(request,'manager')
  const input=await body(request)
  if(typeof input.participantId!=='string'||typeof input.version!=='string')throw new PublicError('참가자 삭제 요청이 올바르지 않습니다.')
  const {data:participant,error}=await admin.from('AD_participants').select('id,profile_id,updated_at').eq('id',input.participantId).maybeSingle()
  if(error)throw new PublicError('참가자 정보를 확인하지 못했습니다.',502)
  if(!participant)throw new PublicError('참가자 정보를 찾을 수 없습니다.',404)
  if(participant.updated_at!==input.version)throw new PublicError('참가자 정보가 변경되었습니다. 새로고침 후 다시 시도해 주세요.',409)
  const {count:members}=await admin.from('AD_team_members').select('participant_id',{count:'exact',head:true}).eq('participant_id',participant.id)
  if(members)throw new PublicError('팀에 배정된 참가자는 팀에서 먼저 해제해 주세요.',409)
  if(participant.profile_id){
    const {count:others}=await admin.from('AD_participants').select('id',{count:'exact',head:true}).eq('profile_id',participant.profile_id).neq('id',participant.id)
    if(others)throw new PublicError('같은 로그인 계정이 다른 프로그램에도 참여 중입니다. 다른 프로그램의 참가 정보를 먼저 삭제해 주세요.',409)
  }
  const {error:deleteError}=await admin.from('AD_participants').delete().eq('id',participant.id).eq('updated_at',participant.updated_at)
  if(deleteError)throw new PublicError('참가자 정보를 삭제하지 못했습니다.',502)
  if(participant.profile_id){
    const {error:accountError}=await admin.auth.admin.deleteUser(participant.profile_id)
    if(accountError)throw new PublicError('참가 정보는 삭제했지만 로그인 계정을 삭제하지 못했습니다. 관리자에게 문의해 주세요.',502)
  }
  return json({success:true})
}))
