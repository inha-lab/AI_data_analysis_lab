import { useEffect,useState } from 'react'
import { Link,useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useCohorts } from '@/features/cohorts/use-cohorts'
import { formatScheduleTime } from '@/features/schedules/schedule-model'
import { safeTeamUrl,teamStages,type Team } from '@/features/teams/team-model'
import { supabase } from '@/lib/supabase'
import { deliverableCategories,type DeliverableCategory } from './deliverable-model'

interface Item {id:string;category:DeliverableCategory;title:string;description:string;url:string;submitted_name:string;submitted_at:string}
interface Group {id:string;name:string;stage:Team['stage'];item_count:number;latest_at:string|null;items:Item[]}
interface Summary {team_count:number;submitted_team_count:number;deliverable_count:number;groups:Group[]}
async function loadSummary(cohortId:string):Promise<Summary>{
  if(!supabase)throw new Error('데이터베이스 연결 설정이 필요합니다.')
  const {data,error}=await supabase.rpc('AD_program_deliverables',{p_cohort:cohortId})
  if(error)throw new Error(error.code==='42501'?'프로그램 산출물 현황을 조회할 권한이 없습니다.':'산출물 현황을 불러오지 못했습니다.')
  return data as Summary
}
function Overview({cohortId}:{cohortId:string}){
  const [revision,setRevision]=useState(0)
  const [result,setResult]=useState<{revision:number;data:Summary|null;error:string}|null>(null)
  const [search,setSearch]=useState('')
  const [category,setCategory]=useState<'all'|DeliverableCategory>('all')
  const [submittedOnly,setSubmittedOnly]=useState(false)
  useEffect(()=>{
    let active=true
    void loadSummary(cohortId).then(data=>{if(active)setResult({revision,data,error:''})}).catch(cause=>{if(active)setResult({revision,data:null,error:cause instanceof Error?cause.message:'산출물 현황을 불러오지 못했습니다.'})})
    return ()=>{active=false}
  },[cohortId,revision])
  if(result?.revision!==revision)return <p className="empty-state" role="status">프로그램 산출물을 불러오고 있습니다.</p>
  if(!result.data)return <div className="notice" role="alert"><p>{result.error}</p><Button onClick={()=>setRevision(value=>value+1)}>다시 시도</Button></div>
  const data=result.data
  const query=search.trim().toLocaleLowerCase()
  const visible=data.groups.map(group=>({...group,items:group.items.filter(item=>(category==='all'||item.category===category)&&(!query||`${group.name} ${item.title} ${item.description}`.toLocaleLowerCase().includes(query)))})).filter(group=>{
    if(submittedOnly&&!group.item_count)return false
    if(category!=='all'&&!group.items.length)return false
    if(query&&!group.name.toLocaleLowerCase().includes(query)&&!group.items.length)return false
    return true
  })
  return <>
    <div className="section-heading"><h2>팀별 제출 현황</h2><Button className="button-secondary" onClick={()=>setRevision(value=>value+1)}>새로고침</Button></div>
    <div className="stats-grid"><article className="stat-card"><p>전체 팀</p><strong>{data.team_count}</strong><span>팀</span></article><article className="stat-card"><p>산출물 제출 팀</p><strong>{data.submitted_team_count}</strong><span>팀</span></article><article className="stat-card"><p>미제출 팀</p><strong>{data.team_count-data.submitted_team_count}</strong><span>팀</span></article><article className="stat-card"><p>등록 산출물</p><strong>{data.deliverable_count}</strong><span>건</span></article></div>
    <div className="list-toolbar schedule-toolbar"><div><input type="search" aria-label="팀명·산출물 검색" placeholder="팀명·산출물 제목·설명 검색" value={search} onChange={event=>setSearch(event.target.value)} /></div><select aria-label="산출물 유형" value={category} onChange={event=>setCategory(event.target.value as 'all'|DeliverableCategory)}><option value="all">전체 유형</option>{Object.entries(deliverableCategories).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><label className="deliverable-overview-toggle"><input type="checkbox" checked={submittedOnly} onChange={event=>setSubmittedOnly(event.target.checked)}/> 제출 팀만</label></div>
    <p className="field-help" role="status">전체 {data.team_count}개 팀 · 표시 {visible.length}개 팀 · 팀은 최근 제출 순, 팀 안의 자료는 최신 제출 순입니다.</p>
    {!visible.length?<p className="empty-state">조건에 맞는 팀이 없습니다.</p>:<div className="deliverable-group-list">{visible.map(group=><section className="panel deliverable-group" key={group.id}><div className="section-heading"><div><span className="badge">{teamStages[group.stage]}</span><h3>{group.name}</h3><p className="field-help">전체 {group.item_count}건 · 최근 제출 {group.latest_at?`${formatScheduleTime(group.latest_at)} (KST)`:'없음'}</p></div><Link to={`/teams/${group.id}/deliverables`} className="text-link">팀 산출물 보기 →</Link></div>
      {group.items.length?<div className="deliverable-group-items">{group.items.map(item=><article key={item.id}><span className="badge">{deliverableCategories[item.category]}</span><div><strong>{item.title}</strong><p className="field-help">{item.submitted_name} · {formatScheduleTime(item.submitted_at)} (KST)</p>{item.description&&<p className="proposal-text">{item.description}</p>}</div>{safeTeamUrl(item.url)&&<a href={safeTeamUrl(item.url)!} className="text-link" target="_blank" rel="noopener noreferrer">링크 열기 ↗</a>}</article>)}</div>:<p className="field-help">{group.item_count?'선택한 조건에 맞는 산출물이 없습니다.':'아직 제출한 산출물이 없습니다.'}</p>}
    </section>)}</div>}
  </>
}
export function ProgramDeliverablesPage(){
  const {cohorts,loading,error,reload}=useCohorts()
  const [params,setParams]=useSearchParams()
  const requested=params.get('cohort')
  const selected=requested?cohorts.find(item=>item.id===requested):cohorts.find(item=>item.status==='active')??cohorts[0]
  return <>
    <div className="page-heading"><div><p className="eyebrow">PROGRAM DELIVERABLES</p><h1>산출물 현황</h1><p className="muted">프로그램의 팀별 링크 산출물을 최근 제출 순으로 확인합니다.</p></div></div>
    {loading?<p role="status">프로그램을 불러오고 있습니다.</p>:error?<div className="notice" role="alert"><p>{error}</p><Button onClick={reload}>다시 시도</Button></div>:!cohorts.length?<section className="panel empty-state"><h2>등록된 프로그램이 없습니다.</h2><Link to="/cohorts?new=1" className="button">프로그램 만들기</Link></section>:<><div className="cohort-selector"><label htmlFor="deliverable-program">프로그램 선택</label><select id="deliverable-program" value={selected?.id??''} onChange={event=>setParams({cohort:event.target.value})}><option value="" disabled>프로그램을 선택하세요</option>{cohorts.map(cohort=><option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}</select></div>{selected?<Overview key={selected.id} cohortId={selected.id}/>:<p role="alert">요청한 프로그램을 찾을 수 없습니다.</p>}</>}
  </>
}
