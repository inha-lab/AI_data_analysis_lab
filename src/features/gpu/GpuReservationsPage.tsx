import { useEffect,useState,type FormEvent } from 'react'
import { Link,useBlocker,useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { useCohorts } from '@/features/cohorts/use-cohorts'
import { formatScheduleTime } from '@/features/schedules/schedule-model'
import { cancelGpuReservation,listGpuDay,listGpuTeams,saveGpuReservation } from './gpu-api'
import { kstDay,reservationTimes,type GpuChoice,type GpuReservation,type ReservationInput,type TeamOption } from './gpu-model'

function Workspace({cohortId,manage}:{cohortId:string;manage:boolean}){
  const [day,setDay]=useState(kstDay)
  const [revision,setRevision]=useState(0)
  const [result,setResult]=useState<{revision:number;rows:GpuReservation[];teams:TeamOption[];error:string}|null>(null)
  const [teamId,setTeamId]=useState('')
  const [start,setStart]=useState('09:00')
  const [end,setEnd]=useState('10:00')
  const [choice,setChoice]=useState<GpuChoice>('0')
  const [purpose,setPurpose]=useState('')
  const [dirty,setDirty]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const blocker=useBlocker(dirty||busy)
  useEffect(()=>{let active=true;void Promise.all([listGpuDay(cohortId,day),manage?Promise.resolve([]):listGpuTeams(cohortId)]).then(([rows,teams])=>{if(active)setResult({revision,rows,teams,error:''})}).catch(cause=>{if(active)setResult({revision,rows:[],teams:[],error:cause instanceof Error?cause.message:'GPU 현황을 불러오지 못했습니다.'})});return()=>{active=false}},[cohortId,day,manage,revision])
  useEffect(()=>{if(!dirty&&!busy)return;const handler=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler)},[dirty,busy])
  const selectedTeam=teamId||result?.teams[0]?.id||''
  const input:ReservationInput={teamId:selectedTeam,day,start,end,choice,purpose}
  const times=reservationTimes(input)
  const dayStart=Date.parse(`${day}T00:00:00+09:00`)
  const dayEnd=dayStart+86400000
  const summary=[0,1].map(gpu=>{const matching=result?.rows.filter(row=>row.gpu_ids.includes(gpu))??[];const minutes=matching.reduce((total,row)=>total+Math.max(0,Math.min(dayEnd,Date.parse(row.ends_at))-Math.max(dayStart,Date.parse(row.starts_at)))/60000,0);return {gpu,count:matching.length,minutes}})
  function reload(){setRevision(value=>value+1)}
  async function submit(event:FormEvent){event.preventDefault();if(!times)return;setBusy(true);setError('');setNotice('');try{await saveGpuReservation(input);setPurpose('');setDirty(false);setNotice('GPU를 예약했습니다.');reload()}catch(cause){setError(cause instanceof Error?cause.message:'GPU 예약을 저장하지 못했습니다.')}finally{setBusy(false)}}
  async function cancel(item:GpuReservation){if(busy||!window.confirm(`${item.team_name}의 GPU 예약을 취소할까요?`))return;setBusy(true);setError('');setNotice('');try{await cancelGpuReservation(item.id);setNotice('예약을 취소했습니다.');reload()}catch(cause){setError(cause instanceof Error?cause.message:'예약을 취소하지 못했습니다.')}finally{setBusy(false)}}
  return <>
    <div className="cohort-selector"><label htmlFor="gpu-day">예약일 (KST)</label><input id="gpu-day" type="date" value={day} onChange={event=>setDay(event.target.value)}/><Button className="button-secondary" disabled={busy} onClick={reload}>새로고침</Button></div>
    {notice&&<p className="success-message" role="status">{notice}</p>}{error&&<p className="form-error" role="alert">{error}</p>}
    <div className="stats-grid">{summary.map(item=><article className="stat-card" key={item.gpu}><span>GPU_#{item.gpu}</span><strong>{item.count}건</strong><p>사용 예정 {Math.floor(item.minutes/60)}시간 {item.minutes%60}분</p></article>)}</div>
    <section className="panel"><div className="section-heading"><h2>{day} 예약 현황</h2><span className="field-help">GPU별 시작 시각 순</span></div>
      {result?.revision!==revision?<p role="status">GPU 예약을 불러오고 있습니다.</p>:result.error?<p className="form-error" role="alert">{result.error}</p>:!result.rows.length?<p className="empty-state">이 날짜에 예약된 GPU가 없습니다.</p>:<div className="comment-list">{[0,1].map(gpu=><div key={gpu}><h3>GPU_#{gpu}</h3>{result.rows.filter(row=>row.gpu_ids.includes(gpu)).map(row=><article className="comment-item" key={`${gpu}-${row.id}`}><div className="section-heading"><div><strong>{row.team_name}</strong><p className="field-help">{row.program_name} · {formatScheduleTime(row.starts_at)} ~ {formatScheduleTime(row.ends_at)} (KST)</p></div>{row.can_cancel&&<Button className="button-secondary" disabled={busy} onClick={()=>void cancel(row)}>예약 취소</Button>}</div><p className="proposal-text">{row.purpose}</p></article>)}</div>)}</div>}
    </section>
    {!manage&&<section className="panel"><h2>GPU 예약</h2>{result?.teams.length?<form className="cohort-form" onSubmit={event=>void submit(event)}><fieldset disabled={busy}><label htmlFor="gpu-team">팀</label><select id="gpu-team" value={selectedTeam} onChange={event=>{setTeamId(event.target.value);setDirty(true)}}>{result.teams.map(team=><option key={team.id} value={team.id}>{team.name}</option>)}</select><label htmlFor="gpu-choice">GPU</label><select id="gpu-choice" value={choice} onChange={event=>{setChoice(event.target.value as GpuChoice);setDirty(true)}}><option value="0">GPU_#0</option><option value="1">GPU_#1</option><option value="both">두 GPU 동시 예약</option></select><div className="date-fields"><div><label htmlFor="gpu-start">시작 시간 (KST)</label><input id="gpu-start" type="time" required value={start} onChange={event=>{setStart(event.target.value);setDirty(true)}}/></div><div><label htmlFor="gpu-end">종료 시간 (KST)</label><input id="gpu-end" type="time" required value={end} onChange={event=>{setEnd(event.target.value);setDirty(true)}}/></div></div>{times&&<p className="field-help">실제 예약: {formatScheduleTime(times.start.toISOString())} ~ {formatScheduleTime(times.end.toISOString())} (KST){end<=start?' · 다음날 종료':''}</p>}<label htmlFor="gpu-purpose">사용 목적</label><textarea id="gpu-purpose" required rows={3} maxLength={500} value={purpose} onChange={event=>{setPurpose(event.target.value);setDirty(true)}}/><p className="field-help">{purpose.length} / 500자</p><Button type="submit" disabled={!times}>{busy?'예약 중…':'예약 신청'}</Button></fieldset></form>:<p className="empty-state">먼저 이 프로그램의 팀에 배정되어야 예약할 수 있습니다.</p>}</section>}
    {blocker.state==='blocked'&&<div className="notice" role="alert"><p>{busy?'처리가 끝난 뒤 이동해 주세요.':'작성 중인 예약을 버리고 이동할까요?'}</p><div className="button-row"><Button disabled={busy} onClick={()=>blocker.proceed()}>이동</Button><Button className="button-secondary" onClick={()=>blocker.reset()}>계속 작성</Button></div></div>}
  </>
}
export function GpuReservationsPage(){
  const {profile}=useAuth();const manage=profile?.role==='professor'
  const {cohorts,loading,error,reload}=useCohorts()
  const [params,setParams]=useSearchParams()
  const requested=params.get('cohort')
  const selected=requested?cohorts.find(item=>item.id===requested):cohorts.find(item=>item.status==='active')??cohorts[0]
  return <><div className="page-heading"><div><p className="eyebrow">GPU RESERVATIONS</p><h1>GPU 예약</h1><p className="muted">{manage?'프로그램별 GPU 사용 현황을 확인하고 예약을 관리합니다.':'소속 팀의 GPU를 예약하고 날짜별 사용 현황을 확인합니다.'}</p></div></div>
    {loading?<p role="status">프로그램을 불러오고 있습니다.</p>:error?<div className="notice" role="alert"><p>{error}</p><Button onClick={reload}>다시 시도</Button></div>:!cohorts.length?<section className="panel empty-state"><h2>{manage?'먼저 프로그램을 등록해 주세요.':'참여 중인 프로그램이 없습니다.'}</h2>{manage&&<Link className="button" to="/cohorts?new=1">프로그램 등록</Link>}</section>:<><div className="cohort-selector"><label htmlFor="gpu-cohort">프로그램 선택</label><select id="gpu-cohort" value={selected?.id??''} onChange={event=>setParams({cohort:event.target.value})}>{cohorts.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div>{selected?<Workspace key={selected.id} cohortId={selected.id} manage={manage}/>:<p role="alert">요청한 프로그램을 찾을 수 없습니다.</p>}</>}
  </>
}
