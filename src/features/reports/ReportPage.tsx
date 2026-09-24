import { useEffect, useState, type FormEvent } from 'react'
import { Link, useBlocker, useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/auth-context'
import { Button } from '@/components/ui/button'
import { formatScheduleTime } from '@/features/schedules/schedule-model'
import { CommentsPanel } from '@/features/comments/CommentsPanel'
import { loadReports, reviewReport, saveReport } from './report-api'
import { emptyReport, nextReportRound, reportFields, reportStatusLabels, reportTypeLabels, reportValues, type Report, type ReportInput, type ReportType } from './report-model'

function UnsavedGuard({locked,busy=false}:{locked:boolean;busy?:boolean}) {
  const blocker=useBlocker(locked)
  useEffect(()=>{
    if (!locked) return
    const beforeUnload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''}
    window.addEventListener('beforeunload',beforeUnload)
    return ()=>window.removeEventListener('beforeunload',beforeUnload)
  },[locked])
  return blocker.state==='blocked' ? <div className="notice" role="alert"><p>{busy?'처리가 끝난 뒤 이동해 주세요.':'저장하지 않은 내용을 버리고 이동할까요?'}</p><div className="button-row"><Button disabled={busy} onClick={()=>blocker.proceed()}>이동</Button><Button className="button-secondary" onClick={()=>blocker.reset()}>계속 작성</Button></div></div> : null
}
function ReportEditor({teamId,previous,initial,onSaved,onLockedChange,onCancel}:{teamId:string;previous:Report|null;initial:ReportInput;onSaved:(id:string,message:string)=>void;onLockedChange:(locked:boolean)=>void;onCancel:()=>void}) {
  const [input,setInput]=useState<ReportInput>(()=>reportValues(initial))
  const [dirty,setDirty]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  useEffect(()=>{onLockedChange(dirty||busy);return ()=>onLockedChange(false)},[dirty,busy,onLockedChange])
  function change(key:keyof ReportInput,value:string) {setInput(current=>({...current,[key]:value}));setDirty(true)}
  async function save(submit:boolean) {
    if (submit && !window.confirm('보고서를 제출할까요? 검토 완료 전에는 계속 수정할 수 있습니다.')) return
    setBusy(true);setError('')
    try {
      const id=await saveReport(teamId,input,submit,previous)
      setDirty(false);onLockedChange(false)
      onSaved(id,submit?'보고서를 제출했습니다.':previous?.status==='submitted'?'제출 상태를 유지하고 수정 내용을 저장했습니다.':'보고서를 임시 저장했습니다.')
    } catch(cause) {setError(cause instanceof Error?cause.message:'보고서를 저장하지 못했습니다.')}
    finally {setBusy(false)}
  }
  return <section className="panel report-detail"><h2>{previous?`${reportTypeLabels[previous.report_type]} ${previous.round_number}회차 수정`:`새 ${reportTypeLabels[input.report_type]} 작성`}</h2>
    <p className="field-help">같은 팀의 학생이 함께 작성합니다. 제출에는 진행 요약·완료 항목·다음 계획이 필요합니다.</p>
    {previous?.reviewed_at&&<div className="notice"><h3>최근 교수 피드백 · {previous.review_action==='returned'?'수정 요청':'검토 완료'}</h3><p className="field-help">{previous.reviewer_name} · {formatScheduleTime(previous.reviewed_at)} (KST)</p><p className="proposal-text">{previous.review_note||'별도 피드백이 없습니다.'}</p></div>}
    <form className="cohort-form" onSubmit={(event:FormEvent)=>{event.preventDefault();void save(false)}}><fieldset disabled={busy}>
      <div className="report-meta-fields"><div><label htmlFor="report-type">보고 구분</label><select id="report-type" value={input.report_type} onChange={e=>change('report_type',e.target.value as ReportType)}><option value="daily">일일 보고</option><option value="weekly">주간 보고</option></select></div>
        <div><label htmlFor="report-round">회차</label><input id="report-round" type="number" min={1} max={1000} required value={input.round_number} onChange={e=>change('round_number',e.target.value)} /></div>
        <div><label htmlFor="report-date">작성일</label><input id="report-date" type="date" required value={input.report_date} onChange={e=>change('report_date',e.target.value)} /></div></div>
      <label htmlFor="report-title">제목</label><input id="report-title" required maxLength={120} value={input.title} onChange={e=>change('title',e.target.value)} />
      {reportFields.map(field=><div key={field.key}><label htmlFor={`report-${field.key}`}>{field.label}{['progress_summary','completed_work','next_plan'].includes(field.key)?' · 제출 시 필수':''}</label><p id={`report-help-${field.key}`} className="field-help">{field.help}</p><textarea id={`report-${field.key}`} aria-describedby={`report-help-${field.key}`} rows={5} maxLength={8000} value={input[field.key]} onChange={e=>change(field.key,e.target.value)} /><p className="field-help">{input[field.key].length.toLocaleString()} / 8,000자</p></div>)}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="button-row"><Button type="submit">{busy?'저장 중…':previous?'수정 저장':'임시 저장'}</Button><Button onClick={()=>void save(true)}>{previous?'수정 후 제출':'보고서 제출'}</Button><Button className="button-secondary" onClick={onCancel}>수정 취소</Button></div>
  </fieldset></form><UnsavedGuard locked={dirty||busy} busy={busy} />
  </section>
}
function ReportReview({report,onSaved,onLockedChange,onCancel}:{report:Report;onSaved:(message:string)=>void;onLockedChange:(locked:boolean)=>void;onCancel:()=>void}) {
  const [note,setNote]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  useEffect(()=>{onLockedChange(Boolean(note)||busy);return ()=>onLockedChange(false)},[note,busy,onLockedChange])
  async function review(action:'reviewed'|'returned') {
    if (!window.confirm(action==='reviewed'?'보고서를 검토 완료로 처리할까요?':'수정 요청을 보내 팀원이 다시 작성할 수 있게 할까요?')) return
    setBusy(true);setError('')
    try {await reviewReport(report,action,note);setNote('');onLockedChange(false);onSaved(action==='reviewed'?'검토 완료로 처리했습니다.':'수정을 요청했습니다.')}
    catch(cause) {setError(cause instanceof Error?cause.message:'검토 결과를 저장하지 못했습니다.')}
    finally {setBusy(false)}
  }
  return <section className="panel report-review"><h2>교수 검토</h2><div className="cohort-form"><fieldset disabled={busy}><label htmlFor="report-review-note">피드백 · 수정 요청 시 필수</label><textarea id="report-review-note" rows={4} maxLength={4000} value={note} onChange={e=>setNote(e.target.value)} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="button-row">{report.status==='submitted'&&<Button onClick={()=>void review('reviewed')}>검토 완료</Button>}<Button className="button-secondary" onClick={()=>void review('returned')}>수정 요청</Button><Button className="button-secondary" onClick={onCancel}>닫기</Button></div>
  </fieldset></div><UnsavedGuard locked={Boolean(note)||busy} busy={busy} /></section>
}
function ReportWorkspace({teamId}:{teamId:string}) {
  const {profile}=useAuth()
  const manage=profile?.role==='professor'
  const [revision,setRevision]=useState(0)
  const [result,setResult]=useState<{revision:number;data:Awaited<ReturnType<typeof loadReports>>|null;error:string}|null>(null)
  const [selected,setSelected]=useState<string|null>(null)
  const [typeFilter,setTypeFilter]=useState<'all'|ReportType>('all')
  const [statusFilter,setStatusFilter]=useState('all')
  const [locked,setLocked]=useState(false)
  const [reviewing,setReviewing]=useState(false)
  const [notice,setNotice]=useState('')
  useEffect(()=>{
    let active=true
    void loadReports(teamId).then(data=>{if(active)setResult({revision,data,error:''})}).catch(cause=>{if(active)setResult({revision,data:null,error:cause instanceof Error?cause.message:'보고서를 불러오지 못했습니다.'})})
    return ()=>{active=false}
  },[teamId,revision])
  function reload(){setRevision(value=>value+1)}
  function choose(id:string|null) {
    if (locked && !window.confirm('저장하지 않은 내용을 버리고 다른 보고서를 열까요?')) return
    setSelected(id);setReviewing(false);setNotice('')
  }
  function saved(id:string,message:string){setNotice(message);setSelected(id);setReviewing(false);reload()}
  if (result?.revision!==revision) return <p className="empty-state" role="status">보고서를 불러오고 있습니다.</p>
  if (!result.data) return <div className="notice" role="alert"><p>{result.error}</p><div className="button-row"><Button onClick={reload}>다시 시도</Button><Link className="text-link" to="/teams">팀 목록으로 →</Link></div></div>
  const {team,reports}=result.data
  const current=reports.find(report=>report.id===selected)??null
  const newType=selected==='new-daily'?'daily':selected==='new-weekly'?'weekly':null
  const editable=!manage && (Boolean(newType)||Boolean(current&&current.status!=='reviewed'))
  const list=reports.filter(report=>(typeFilter==='all'||report.report_type===typeFilter)&&(statusFilter==='all'||report.status===statusFilter))
  return <>
    <div className="page-heading"><div><p className="eyebrow">TEAM REPORTS</p><h1>{team.name} 보고서</h1><p className="muted">일일·주간 진행 내용과 제출·검토 현황을 관리합니다.</p></div><Link to={`/teams?cohort=${team.cohort_id}`} className="text-link">팀 목록으로 →</Link></div>
    {notice&&<p className="success-message" role="status">{notice}</p>}
    <section className="panel"><div className="section-heading"><h2>보고서 목록 · {reports.length}건</h2>{!manage&&<div className="button-row"><Button onClick={()=>choose('new-daily')}>일일 보고 작성</Button><Button className="button-secondary" onClick={()=>choose('new-weekly')}>주간 보고 작성</Button></div>}</div>
      <div className="list-toolbar schedule-toolbar"><select aria-label="보고 구분 필터" value={typeFilter} onChange={e=>setTypeFilter(e.target.value as 'all'|ReportType)}><option value="all">전체 구분</option><option value="daily">일일 보고</option><option value="weekly">주간 보고</option></select>
        <select aria-label="보고 상태 필터" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">전체 상태</option><option value="draft">작성 중</option><option value="submitted">제출</option><option value="reviewed">검토 완료</option></select>
        <Button className="button-secondary" disabled={locked} onClick={reload}>새로고침</Button></div>
      {!list.length?<div className="empty-state"><h2>{reports.length?'필터에 맞는 보고서가 없습니다.':'아직 등록된 보고서가 없습니다.'}</h2></div>
        :<div className="schedule-list">{list.map(report=><article className="report-row" key={report.id}><div><span className="badge">{reportTypeLabels[report.report_type]} · {report.round_number}회차</span> <span className={`badge ${report.status==='reviewed'?'status-active':'status-draft'}`}>{reportStatusLabels[report.status]}</span><h3>{report.title}</h3><p className="field-help">작성일 {report.report_date} · 최종 변경 {report.updated_name} · {formatScheduleTime(report.updated_at)} (KST)</p></div><Button className="button-secondary" onClick={()=>choose(report.id)}>내용 {manage?'조회':'조회·수정'}</Button></article>)}</div>}
    </section>
    {editable&&<ReportEditor key={current?.id??newType!} teamId={team.id} previous={current} initial={current?{...current,round_number:String(current.round_number)}:emptyReport(newType!,nextReportRound(reports,newType!))} onLockedChange={setLocked} onCancel={()=>choose(null)} onSaved={saved} />}
    {current&&!editable&&<section className="panel report-detail"><div className="section-heading"><h2>{current.title}</h2><span className="badge">{reportStatusLabels[current.status]}</span></div>
      <p className="field-help">{reportTypeLabels[current.report_type]} · {current.round_number}회차 · 작성일 {current.report_date}</p>
      <p className="field-help">최종 변경 {current.updated_name} · {formatScheduleTime(current.updated_at)} (KST){current.submitted_at&&` · 최근 제출 ${current.submitted_name} · ${formatScheduleTime(current.submitted_at)} (KST)`}</p>
      {reportFields.map(field=><section className="proposal-section" key={field.key}><h3>{field.label}</h3><p className="proposal-text">{current[field.key]||'미작성'}</p></section>)}
      {current.reviewed_at&&<div className="notice"><h3>최근 교수 피드백 · {current.review_action==='returned'?'수정 요청':'검토 완료'}</h3><p className="field-help">{current.reviewer_name} · {formatScheduleTime(current.reviewed_at)} (KST)</p><p className="proposal-text">{current.review_note||'별도 피드백 없이 검토를 완료했습니다.'}</p></div>}
      {manage&&current.status!=='draft'&&!reviewing&&<Button onClick={()=>setReviewing(true)}>검토·수정 요청</Button>}
      {!manage&&current.status==='reviewed'&&<p className="field-help">검토가 완료되었습니다. 수정이 필요하면 교수의 수정 요청을 받아 다시 작성할 수 있습니다.</p>}
      {reviewing&&<ReportReview key={current.id} report={current} onLockedChange={setLocked} onCancel={()=>{if(!locked||window.confirm('입력 중인 피드백을 버릴까요?'))setReviewing(false)}} onSaved={message=>{setNotice(message);setReviewing(false);reload()}} />}
    </section>}
    {current&&<CommentsPanel key={current.id} teamId={team.id} reportId={current.id} />}
  </>
}
export function ReportPage() {
  const {teamId}=useParams()
  if(!teamId||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId)) return <p role="alert">올바른 팀 주소가 아닙니다.</p>
  return <ReportWorkspace key={teamId} teamId={teamId} />
}
