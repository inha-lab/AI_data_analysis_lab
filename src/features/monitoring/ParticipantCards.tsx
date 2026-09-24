import { useEffect,useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

type Counts={total:number;active:number;completed:number;dropout:number;inactive:number}
async function loadCounts():Promise<Counts>{
  if(!supabase)throw new Error('데이터베이스 연결 설정이 필요합니다.')
  const {data,error}=await supabase.rpc('AD_dashboard_participant_counts')
  if(error)throw new Error(error.code==='42501'?'참가자 현황을 조회할 권한이 없습니다.':'참가자 현황을 불러오지 못했습니다.')
  return data as Counts
}
export function ParticipantCards(){
  const [revision,setRevision]=useState(0)
  const [result,setResult]=useState<{revision:number;data:Counts|null;error:string}|null>(null)
  useEffect(()=>{
    let active=true
    void loadCounts().then(data=>{if(active)setResult({revision,data,error:''})}).catch(cause=>{if(active)setResult({revision,data:null,error:cause instanceof Error?cause.message:'참가자 현황을 불러오지 못했습니다.'})})
    return ()=>{active=false}
  },[revision])
  const loading=result?.revision!==revision
  const cards=[
    {label:'전체 참여자 수',value:result?.data?.total},
    {label:'참여 진행',value:result?.data?.active},
    {label:'프로그램 수료',value:result?.data?.completed},
    {label:'프로그램 중탈',value:result?.data?.dropout},
  ]
  return <section className="participant-cards" aria-labelledby="participant-cards-title"><div className="section-heading"><div><h2 id="participant-cards-title">참가자 현황</h2><p className="field-help">전체 프로그램의 참가 등록 건수 기준입니다. 기존 ‘비활성’은 전체 수에 포함되며 중탈로 계산하지 않습니다.</p></div><div className="button-row"><Button className="button-secondary" onClick={()=>setRevision(value=>value+1)}>새로고침</Button><Link to="/participants" className="text-link">참가자 관리 →</Link></div></div>
    {result?.revision===revision&&result.error&&<p className="form-error" role="alert">{result.error}</p>}
    <div className="stats-grid">{cards.map(card=><article className="stat-card" key={card.label}><p>{card.label}</p><strong>{loading||result?.error?'—':card.value}</strong><span>명</span></article>)}</div>
  </section>
}
