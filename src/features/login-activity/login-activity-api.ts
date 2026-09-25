import { supabase } from '@/lib/supabase'

export type LoginActivity={participant_id:string;full_name:string;student_number:string;email:string;device_type:string;browser_name:string;signed_in_at:string;last_sign_in_at:string}
export function clientDevice(userAgent:string){
  const device_type=/iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)?'tablet':/iPhone|iPod|Android.*Mobile|Mobile/i.test(userAgent)?'mobile':userAgent?'desktop':'unknown'
  const browser_name=/Edg\//.test(userAgent)?'Edge':/Firefox\//.test(userAgent)?'Firefox':/Chrome\//.test(userAgent)?'Chrome':/Safari\//.test(userAgent)?'Safari':'Other'
  return {device_type,browser_name}
}
export async function recordLoginActivity(){
  if(!supabase)return
  const device=clientDevice(navigator.userAgent)
  await supabase.rpc('AD_record_login_activity',{p_device:device.device_type,p_browser:device.browser_name})
}
export async function loadLoginActivity(cohortId:string,since:string|null){
  if(!supabase)throw new Error('데이터베이스 연결 설정이 필요합니다.')
  const rows:LoginActivity[]=[]
  for(let start=0;;start+=1000){
    const {data,error}=await supabase.rpc('AD_program_login_activity',{p_cohort:cohortId,p_since:since}).range(start,start+999)
    if(error)throw new Error(error.code==='42501'?'로그인 활동을 조회할 권한이 없습니다.':'로그인 활동을 불러오지 못했습니다.')
    const page=data as LoginActivity[];rows.push(...page)
    if(page.length<1000)break
  }
  return rows
}
