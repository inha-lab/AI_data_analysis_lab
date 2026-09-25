import { useEffect,useState } from 'react'
import { Link,useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useCohorts } from '@/features/cohorts/use-cohorts'
import { formatScheduleTime } from '@/features/schedules/schedule-model'
import { loadLoginActivity,type LoginActivity } from './login-activity-api'

type Period='today'|'7'|'30'|'all'
function sinceFor(period:Period){
  if(period==='all')return null
  if(period==='today'){
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
    const part=(name:string)=>parts.find(item=>item.type===name)?.value??''
    return new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00+09:00`).toISOString()
  }
  return new Date(Date.now()-Number(period)*86400000).toISOString()
}
function Workspace({cohortId}:{cohortId:string}){
  const [period,setPeriod]=useState<Period>('7')
  const [search,setSearch]=useState('')
  const [revision,setRevision]=useState(0)
  const [result,setResult]=useState<{revision:number;rows:LoginActivity[];error:string}|null>(null)
  useEffect(()=>{let active=true;void loadLoginActivity(cohortId,sinceFor(period)).then(rows=>{if(active)setResult({revision,rows,error:''})}).catch(cause=>{if(active)setResult({revision,rows:[],error:cause instanceof Error?cause.message:'로그인 활동을 불러오지 못했습니다.'})});return()=>{active=false}},[cohortId,period,revision])
  const rows=result?.rows.filter(row=>`${row.full_name} ${row.student_number} ${row.email}`.toLowerCase().includes(search.trim().toLowerCase()))??[]
  return <section className="panel"><div className="section-heading"><h2>로그인 기록 · {result?.rows.length??0}건</h2><Button className="button-secondary" onClick={()=>setRevision(value=>value+1)}>새로고침</Button></div><div className="list-toolbar schedule-toolbar"><div><input type="search" aria-label="참가자 검색" placeholder="이름·학번·이메일 검색" value={search} onChange={event=>setSearch(event.target.value)}/></div><select aria-label="조회 기간" value={period} onChange={event=>setPeriod(event.target.value as Period)}><option value="today">오늘 (KST)</option><option value="7">최근 7일</option><option value="30">최근 30일</option><option value="all">전체 기간</option></select></div>
    {result?.revision!==revision?<p role="status">로그인 활동을 불러오고 있습니다.</p>:result.error?<p className="form-error" role="alert">{result.error}</p>:!rows.length?<p className="empty-state">조회된 로그인 활동이 없습니다.</p>:<div className="monitoring-table-wrap"><table className="monitoring-table"><thead><tr><th>이름</th><th>학번</th><th>이메일</th><th>로그인 시각</th><th>최근 로그인</th><th>기기</th><th>브라우저</th></tr></thead><tbody>{rows.map((row,index)=><tr key={`${row.participant_id}-${row.signed_in_at}-${index}`}><td>{row.full_name}</td><td>{row.student_number}</td><td>{row.email}</td><td>{formatScheduleTime(row.signed_in_at)} (KST)</td><td>{formatScheduleTime(row.last_sign_in_at)} (KST)</td><td>{({desktop:'데스크톱',mobile:'모바일',tablet:'태블릿',unknown:'알 수 없음'} as Record<string,string>)[row.device_type]??'알 수 없음'}</td><td>{row.browser_name}</td></tr>)}</tbody></table></div>}
    <p className="field-help">이 화면은 앱의 이메일·비밀번호 로그인 성공 후 기록된 활동을 표시합니다. 과거 로그인은 소급되지 않습니다.</p>
  </section>
}
export function LoginActivityPage(){
  const {cohorts,loading,error,reload}=useCohorts()
  const [params,setParams]=useSearchParams()
  const requested=params.get('cohort')
  const selected=requested?cohorts.find(item=>item.id===requested):cohorts.find(item=>item.status==='active')??cohorts[0]
  return <><div className="page-heading"><div><p className="eyebrow">LOGIN ACTIVITY</p><h1>로그인 활동</h1><p className="muted">프로그램 참가자의 최근 로그인 기록을 조회합니다.</p></div></div>
    {loading?<p role="status">프로그램을 불러오고 있습니다.</p>:error?<div className="notice" role="alert"><p>{error}</p><Button onClick={reload}>다시 시도</Button></div>:!cohorts.length?<section className="panel empty-state"><h2>먼저 프로그램을 등록해 주세요.</h2><Link className="button" to="/cohorts?new=1">프로그램 등록</Link></section>:<><div className="cohort-selector"><label htmlFor="activity-cohort">프로그램 선택</label><select id="activity-cohort" value={selected?.id??''} onChange={event=>setParams({cohort:event.target.value})}>{cohorts.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div>{selected?<Workspace key={selected.id} cohortId={selected.id}/>:<p role="alert">요청한 프로그램을 찾을 수 없습니다.</p>}</>}
  </>
}
