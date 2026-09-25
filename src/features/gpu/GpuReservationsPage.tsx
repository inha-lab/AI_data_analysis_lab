import { useEffect,useState,type FormEvent } from 'react'
import { Link,useBlocker,useSearchParams } from 'react-router-dom'
import { Cpu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { useCohorts } from '@/features/cohorts/use-cohorts'
import { formatScheduleTime } from '@/features/schedules/schedule-model'
import { cancelGpuApplication,listGpuApplications,listGpuDay,listGpuTeams,saveGpuReservation } from './gpu-api'
import { GpuHourlyGrid } from './GpuHourlyGrid'
import { kstDay,overlapsKstHour,reservationTimes,type GpuApplication,type GpuChoice,type GpuReservation,type ReservationInput,type TeamOption } from './gpu-model'

const hours=Array.from({length:24},(_,hour)=>`${String(hour).padStart(2,'0')}:00`)

function Workspace({cohortId,manage}:{cohortId:string;manage:boolean}){
  const [day,setDay]=useState(kstDay)
  const [listDay,setListDay]=useState('')
  const scheduleDay=listDay||day
  const [revision,setRevision]=useState(0)
  const [result,setResult]=useState<{revision:number;viewDay:string;rows:GpuReservation[];teams:TeamOption[];applications:GpuApplication[];error:string}|null>(null)
  const [teamId,setTeamId]=useState('')
  const [start,setStart]=useState('09:00')
  const [end,setEnd]=useState('10:00')
  const [selectedGpus,setSelectedGpus]=useState<number[]>([0])
  const [purpose,setPurpose]=useState('')
  const [dirty,setDirty]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const blocker=useBlocker(dirty||busy)
  useEffect(()=>{
    let active=true
    void Promise.all([listGpuDay(cohortId,scheduleDay),listGpuTeams(cohortId),listGpuApplications(cohortId)]).then(([rows,teams,applications])=>{
      if(active)setResult({revision,viewDay:scheduleDay,rows,teams,applications,error:''})
    }).catch(cause=>{
      if(active)setResult({revision,viewDay:scheduleDay,rows:[],teams:[],applications:[],error:cause instanceof Error?cause.message:'GPU 현황을 불러오지 못했습니다.'})
    })
    return()=>{active=false}
  },[cohortId,scheduleDay,revision])
  useEffect(()=>{
    if(!dirty&&!busy)return
    const handler=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''}
    window.addEventListener('beforeunload',handler)
    return()=>window.removeEventListener('beforeunload',handler)
  },[dirty,busy])

  const selectedTeam=teamId||result?.teams[0]?.id||''
  const choice:GpuChoice=selectedGpus.length===2?'both':selectedGpus[0]===1?'1':'0'
  const input:ReservationInput={teamId:selectedTeam,day,start,end,choice,purpose}
  const times=reservationTimes(input)
  const dayStart=Date.parse(`${scheduleDay}T00:00:00+09:00`)
  const dayEnd=dayStart+86400000
  const filteredApplications=result?.applications.filter(item=>!listDay||item.segments.some(segment=>{
    const start=Date.parse(`${listDay}T00:00:00+09:00`)
    return Date.parse(segment.starts_at)<start+86400000&&Date.parse(segment.ends_at)>start
  }))??[]
  const summary=[0,1].map(gpu=>{
    const matching=result?.rows.filter(row=>row.gpu_ids.includes(gpu))??[]
    const minutes=matching.reduce((total,row)=>total+Math.max(0,Math.min(dayEnd,Date.parse(row.ends_at))-Math.max(dayStart,Date.parse(row.starts_at)))/60000,0)
    const count=hours.filter((_,hour)=>matching.some(row=>overlapsKstHour(row,scheduleDay,hour))).length
    return {gpu,count,minutes}
  })
  function reload(){setRevision(value=>value+1)}
  function toggleGpu(gpu:number){setSelectedGpus(current=>current.includes(gpu)?current.filter(value=>value!==gpu):[...current,gpu].sort());setDirty(true)}
  async function submit(event:FormEvent){
    event.preventDefault()
    if(!times||!selectedGpus.length){setError('GPU를 한 개 이상 선택해 주세요.');return}
    setBusy(true);setError('');setNotice('')
    try{await saveGpuReservation(input);setPurpose('');setDirty(false);setNotice('GPU 예약이 완료되었습니다.');reload()}
    catch(cause){setError(cause instanceof Error?cause.message:'GPU 예약을 저장하지 못했습니다.')}
    finally{setBusy(false)}
  }
  async function cancel(item:GpuApplication){
    if(busy||!window.confirm(`${item.team_name}의 신청 1건을 삭제할까요? 포함된 모든 GPU·시간 예약이 함께 삭제됩니다.`))return
    setBusy(true);setError('');setNotice('')
    try{await cancelGpuApplication(item.application_id);setNotice('신청 1건의 모든 GPU·시간 예약을 삭제했습니다.');reload()}
    catch(cause){setError(cause instanceof Error?cause.message:'예약을 취소하지 못했습니다.')}
    finally{setBusy(false)}
  }
  return <>
    {notice&&<p className="success-message" role="status">{notice}</p>}{error&&<p className="form-error" role="alert">{error}</p>}
    <div className="gpu-main-grid">
      <section className="panel gpu-request-panel"><div className="section-heading"><h2><Cpu size={19} aria-hidden="true"/> 예약 신청</h2></div>
        {result?.revision!==revision||result?.viewDay!==scheduleDay?<p role="status">팀과 예약 현황을 불러오고 있습니다.</p>:result.error?<p className="form-error" role="alert">{result.error}</p>:!result.teams.length?<p className="empty-state">{manage?'이 프로그램에 팀을 먼저 등록해 주세요.':'팀 배정 후 GPU 서버 예약을 신청할 수 있습니다.'}</p>:<form className="cohort-form" onSubmit={event=>void submit(event)}><fieldset disabled={busy}>
          <label htmlFor="gpu-team">팀</label><select id="gpu-team" value={selectedTeam} disabled={!manage&&result.teams.length===1} onChange={event=>{setTeamId(event.target.value);setDirty(true)}}>{result.teams.map(team=><option key={team.id} value={team.id}>{team.name} · {team.topic||'프로젝트 미정'}</option>)}</select>
          <label htmlFor="gpu-day">예약일 (KST)</label><input id="gpu-day" type="date" required value={day} onChange={event=>{setDay(event.target.value);setDirty(true)}}/>
          <div className="date-fields"><div><label htmlFor="gpu-start">시작 시간</label><select id="gpu-start" value={start} onChange={event=>{setStart(event.target.value);setDirty(true)}}>{hours.map(hour=><option key={hour}>{hour}</option>)}</select></div><div><label htmlFor="gpu-end">종료 시간</label><select id="gpu-end" value={end} onChange={event=>{setEnd(event.target.value);setDirty(true)}}>{hours.map(hour=><option key={hour}>{hour}</option>)}</select></div></div>
          <p className="field-help">종료시간이 시작 시간과 같거나 빠르면 다음날 종료됩니다.</p>
          <fieldset className="gpu-choice-fieldset"><legend>GPU 선택</legend><div className="gpu-choice-row">{[0,1].map(gpu=><label key={gpu}><input type="checkbox" checked={selectedGpus.includes(gpu)} onChange={()=>toggleGpu(gpu)}/> GPU_#{gpu}</label>)}</div><p className="field-help">두 GPU를 선택하면 같은 시간에 함께 예약합니다.</p></fieldset>
          <label htmlFor="gpu-purpose">사용 목적</label><input id="gpu-purpose" required maxLength={500} placeholder="예: 모델 학습, 데모 테스트, 실험 재현" value={purpose} onChange={event=>{setPurpose(event.target.value);setDirty(true)}}/>
          {times&&<p className="field-help">실제 예약: {formatScheduleTime(times.start.toISOString())} ~ {formatScheduleTime(times.end.toISOString())} (KST)</p>}
          <Button type="submit" disabled={!times||!selectedGpus.length}>{busy?'예약 중…':'GPU 예약 신청'}</Button>
        </fieldset></form>}
      </section>
      <div className="gpu-overview-grid">{summary.map(item=><article className="stat-card" key={item.gpu}><Cpu size={18} aria-hidden="true"/><span>GPU_#{item.gpu}</span><strong>{item.count}개 시간대</strong><p>사용 예정 {Math.floor(item.minutes/60)}시간 {item.minutes%60}분</p></article>)}</div>
    </div>
    <section className="panel gpu-schedule-panel"><div className="section-heading gpu-list-heading"><div><h2>전체 예약 현황</h2><p className="field-help">선택 프로그램의 다른 팀 예약도 확인할 수 있습니다. 신청 1건당 목록 1건입니다.</p></div><div className="gpu-list-controls"><label htmlFor="gpu-list-day">조회 날짜</label><input id="gpu-list-day" type="date" value={listDay} onChange={event=>setListDay(event.target.value)}/><Button className="button-secondary" disabled={!listDay} onClick={()=>setListDay('')}>전체 날짜</Button><Button className="button-secondary" disabled={busy} onClick={reload}>새로고침</Button></div></div>{result?.revision!==revision||result?.viewDay!==scheduleDay?<p role="status">전체 예약을 불러오고 있습니다.</p>:result.error?<p className="form-error" role="alert">{result.error}</p>:!filteredApplications.length?<p className="empty-state">{listDay?'선택한 날짜의 예약 신청이 없습니다.':'예약 신청이 없습니다.'}</p>:<div className="gpu-application-list">{filteredApplications.map(item=><article className="gpu-application" key={item.application_id}><div className="gpu-application-main"><div className="gpu-application-time">{formatScheduleTime(item.starts_at)} ~ {formatScheduleTime(item.ends_at)}</div><div className="gpu-application-team"><strong>{item.team_name}</strong><span>{item.program_name}</span></div><div className="gpu-application-gpus">{[...new Set(item.segments.flatMap(segment=>segment.gpu_ids))].map(gpu=>`GPU_#${gpu}`).join(', ')}</div><div className="gpu-application-purpose">{item.purpose}{manage&&item.requester_name&&<span> · 신청: {item.requester_name}</span>}</div>{item.can_cancel&&<Button className="button-secondary" disabled={busy} onClick={()=>void cancel(item)}>신청 삭제</Button>}</div>{item.segments.length>1&&<details><summary>예약 구간 {item.segments.length}개 보기</summary><ul>{item.segments.map((segment,index)=><li key={index}>{segment.gpu_ids.map(gpu=>`GPU_#${gpu}`).join(', ')} · {formatScheduleTime(segment.starts_at)} ~ {formatScheduleTime(segment.ends_at)}</li>)}</ul></details>}</article>)}</div>}</section>
    <section className="panel gpu-schedule-panel"><div className="section-heading"><h2>{scheduleDay} 시간대별 예약표</h2><span className="field-help">한국 시간(KST)</span></div>{result?.revision!==revision||result?.viewDay!==scheduleDay?<p role="status">예약표를 불러오고 있습니다.</p>:result.error?<p className="form-error" role="alert">{result.error}</p>:<GpuHourlyGrid day={scheduleDay} rows={result.rows} manage={manage}/>}</section>
    {blocker.state==='blocked'&&<div className="notice" role="alert"><p>{busy?'처리가 끝난 뒤 이동해 주세요.':'작성 중인 예약을 버리고 이동할까요?'}</p><div className="button-row"><Button disabled={busy} onClick={()=>blocker.proceed()}>이동</Button><Button className="button-secondary" onClick={()=>blocker.reset()}>계속 작성</Button></div></div>}
  </>
}
export function GpuReservationsPage(){
  const {profile}=useAuth();const manage=profile?.role==='professor'
  const {cohorts,loading,error,reload}=useCohorts()
  const [params,setParams]=useSearchParams()
  const requested=params.get('cohort')
  const selected=requested?cohorts.find(item=>item.id===requested):cohorts.find(item=>item.status==='active')??cohorts[0]
  return <><div className="page-heading"><div><p className="eyebrow">GPU SERVER</p><h1>GPU 서버 사용 신청</h1><p className="muted">GPU_#0, GPU_#1을 정시 단위로 예약하고 팀별 사용 현황을 확인합니다.</p></div></div>
    {loading?<p role="status">프로그램을 불러오고 있습니다.</p>:error?<div className="notice" role="alert"><p>{error}</p><Button onClick={reload}>다시 시도</Button></div>:!cohorts.length?<section className="panel empty-state"><h2>{manage?'먼저 프로그램을 등록해 주세요.':'참여 중인 프로그램이 없습니다.'}</h2>{manage&&<Link className="button" to="/cohorts?new=1">프로그램 등록</Link>}</section>:<><div className="cohort-selector"><label htmlFor="gpu-cohort">프로그램 선택</label><select id="gpu-cohort" value={selected?.id??''} onChange={event=>setParams({cohort:event.target.value})}>{cohorts.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div>{selected?<Workspace key={selected.id} cohortId={selected.id} manage={manage}/>:<p role="alert">요청한 프로그램을 찾을 수 없습니다.</p>}</>}
  </>
}
