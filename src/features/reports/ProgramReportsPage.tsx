import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useCohorts } from '@/features/cohorts/use-cohorts'
import { formatScheduleTime } from '@/features/schedules/schedule-model'
import { teamStages, type Team } from '@/features/teams/team-model'
import { supabase } from '@/lib/supabase'
import { reportStatusLabels, reportTypeLabels, type ReportType } from './report-model'

type ReportStatus = 'draft' | 'submitted'
interface ReportItem {
  id:string; report_type:ReportType; round_number:number; report_date:string; title:string; status:ReportStatus
  has_attention:boolean; updated_at:string; updated_name:string; submitted_at:string|null; submitted_name:string|null
}
interface ReportGroup {
  id:string; name:string; topic:string; stage:Team['stage']; daily_count:number; weekly_count:number
  draft_count:number; submitted_count:number; latest_at:string|null; reports:ReportItem[]
}
interface ReportSummary {team_count:number;reporting_team_count:number;daily_count:number;weekly_count:number;groups:ReportGroup[]}

async function loadProgramReports(cohortId:string):Promise<ReportSummary>{
  if(!supabase)throw new Error('데이터베이스 연결 설정이 필요합니다.')
  const {data,error}=await supabase.rpc('AD_program_reports',{p_cohort:cohortId})
  if(error)throw new Error(error.code==='42501'?'프로그램 보고서 현황을 조회할 권한이 없습니다.':'보고서 현황을 불러오지 못했습니다.')
  return data as ReportSummary
}

function ReportsOverview({cohortId}:{cohortId:string}){
  const [revision,setRevision]=useState(0)
  const [result,setResult]=useState<{revision:number;data:ReportSummary|null;error:string}|null>(null)
  const [searchInput,setSearchInput]=useState('')
  const [search,setSearch]=useState('')
  const [type,setType]=useState<'all'|ReportType>('all')
  const [status,setStatus]=useState<'all'|ReportStatus>('all')
  useEffect(()=>{
    let active=true
    void loadProgramReports(cohortId).then(data=>{if(active)setResult({revision,data,error:''})}).catch(cause=>{if(active)setResult({revision,data:null,error:cause instanceof Error?cause.message:'보고서 현황을 불러오지 못했습니다.'})})
    return()=>{active=false}
  },[cohortId,revision])
  if(result?.revision!==revision)return <p className="empty-state" role="status">프로그램 보고서를 불러오고 있습니다.</p>
  if(!result.data)return <div className="notice" role="alert"><p>{result.error}</p><Button onClick={()=>setRevision(value=>value+1)}>다시 시도</Button></div>
  const data=result.data
  const query=search.trim().toLocaleLowerCase()
  const groups=data.groups.map(group=>({...group,reports:group.reports.filter(report=>(type==='all'||report.report_type===type)&&(status==='all'||report.status===status)&&(!query||`${group.name} ${group.topic} ${report.title} ${report.updated_name} ${report.submitted_name??''}`.toLocaleLowerCase().includes(query)))})).filter(group=>{
    if(type!=='all'||status!=='all')return group.reports.length>0
    if(query)return group.name.toLocaleLowerCase().includes(query)||group.topic.toLocaleLowerCase().includes(query)||group.reports.length>0
    return true
  })
  function submitSearch(event:FormEvent){event.preventDefault();setSearch(searchInput)}
  return <>
    <div className="section-heading"><h2>팀별 보고서 현황</h2><Button className="button-secondary" onClick={()=>setRevision(value=>value+1)}>새로고침</Button></div>
    <div className="stats-grid"><article className="stat-card"><p>전체 팀</p><strong>{data.team_count}</strong><span>팀</span></article><article className="stat-card"><p>보고 등록 팀</p><strong>{data.reporting_team_count}</strong><span>팀</span></article><article className="stat-card"><p>일일 보고</p><strong>{data.daily_count}</strong><span>건</span></article><article className="stat-card"><p>주간 보고</p><strong>{data.weekly_count}</strong><span>건</span></article></div>
    <form className="list-toolbar schedule-toolbar" onSubmit={submitSearch}><div><input type="search" aria-label="팀명·보고서 검색" placeholder="팀명·주제·제목·작성자 검색" value={searchInput} onChange={event=>setSearchInput(event.target.value)}/></div><Button type="submit">검색</Button><select aria-label="보고 구분" value={type} onChange={event=>setType(event.target.value as 'all'|ReportType)}><option value="all">전체 구분</option><option value="daily">일일 보고</option><option value="weekly">주간 보고</option></select><select aria-label="보고 상태" value={status} onChange={event=>setStatus(event.target.value as 'all'|ReportStatus)}><option value="all">전체 상태</option><option value="draft">작성 중</option><option value="submitted">제출</option></select></form>
    <p className="field-help" role="status">전체 {data.team_count}개 팀 · 표시 {groups.length}개 팀 · 최근 변경된 팀부터 표시합니다.</p>
    {!groups.length?<p className="empty-state">조건에 맞는 팀 또는 보고서가 없습니다.</p>:<div className="program-report-list">{groups.map(group=><section className="panel program-report-group" key={group.id}><div className="program-report-team"><div><span className="badge">{teamStages[group.stage]}</span><h3>{group.name}</h3><p>{group.topic||'주제 미등록'}</p></div><div className="program-report-counts"><span>일일 <strong>{group.daily_count}</strong></span><span>주간 <strong>{group.weekly_count}</strong></span><span>작성 중 <strong>{group.draft_count}</strong></span><span>제출 <strong>{group.submitted_count}</strong></span></div><Link className="text-link" to={`/teams/${group.id}/reports`}>팀 보고서 전체 보기 →</Link></div>
      {group.reports.length?<div className="program-report-items">{group.reports.map(report=><article key={report.id}><div className="program-report-badges"><span className="badge">{reportTypeLabels[report.report_type]} · {report.round_number}회차</span><span className={`badge ${report.status==='draft'?'status-draft':'status-active'}`}>{reportStatusLabels[report.status]}</span>{report.has_attention&&<span className="badge status-pending">이슈/지원</span>}</div><div><strong>{report.title}</strong><p className="field-help">작성일 {report.report_date} · {report.updated_name} · {formatScheduleTime(report.updated_at)} (KST){report.submitted_name&&` · 제출 ${report.submitted_name}`}</p></div><Link className="button button-secondary" to={`/teams/${group.id}/reports?report=${report.id}`}>조회</Link></article>)}</div>:<p className="field-help">{group.daily_count+group.weekly_count?'선택한 조건에 맞는 보고서가 없습니다.':'아직 등록된 보고서가 없습니다.'}</p>}
    </section>)}</div>}
  </>
}

export function ProgramReportsPage(){
  const {cohorts,loading,error,reload}=useCohorts()
  const [params,setParams]=useSearchParams()
  const requested=params.get('cohort')
  const selected=requested?cohorts.find(item=>item.id===requested):cohorts.find(item=>item.status==='active')??cohorts[0]
  return <>
    <div className="page-heading"><div><p className="eyebrow">PROGRAM REPORTS</p><h1>보고서 현황</h1><p className="muted">프로그램의 팀별 일일·주간 보고서와 제출 상태를 확인합니다.</p></div></div>
    {loading?<p role="status">프로그램을 불러오고 있습니다.</p>:error?<div className="notice" role="alert"><p>{error}</p><Button onClick={reload}>다시 시도</Button></div>:!cohorts.length?<section className="panel empty-state"><h2>등록된 프로그램이 없습니다.</h2><Link to="/cohorts?new=1" className="button">프로그램 만들기</Link></section>:<><div className="cohort-selector"><label htmlFor="report-program">프로그램 선택</label><select id="report-program" value={selected?.id??''} onChange={event=>setParams({cohort:event.target.value})}><option value="" disabled>프로그램을 선택하세요</option>{cohorts.map(cohort=><option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}</select></div>{selected?<ReportsOverview key={selected.id} cohortId={selected.id}/>:<p role="alert">요청한 프로그램을 찾을 수 없습니다.</p>}</>}
  </>
}
