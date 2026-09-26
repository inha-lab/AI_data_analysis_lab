import { useEffect,useState,type FormEvent } from 'react'
import { Link,useBlocker,useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { useCohorts } from '@/features/cohorts/use-cohorts'
import { formatScheduleTime } from '@/features/schedules/schedule-model'
import { deleteAnnouncement,listAnnouncements,saveAnnouncement,type Announcement,type AnnouncementInput } from './announcement-api'

const empty:AnnouncementInput={title:'',body:'',is_pinned:false}
function Workspace({cohortId,manage}:{cohortId:string;manage:boolean}){
  const [revision,setRevision]=useState(0)
  const [result,setResult]=useState<{revision:number;rows:Announcement[];error:string}|null>(null)
  const [editing,setEditing]=useState<Announcement|'new'|null>(null)
  const [input,setInput]=useState<AnnouncementInput>(empty)
  const [dirty,setDirty]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [search,setSearch]=useState('')
  const [pinnedOnly,setPinnedOnly]=useState(false)
  const blocker=useBlocker(dirty||busy)
  useEffect(()=>{let active=true;void listAnnouncements(cohortId).then(rows=>{if(active)setResult({revision,rows,error:''})}).catch(cause=>{if(active)setResult({revision,rows:[],error:cause instanceof Error?cause.message:'공지를 불러오지 못했습니다.'})});return()=>{active=false}},[cohortId,revision])
  useEffect(()=>{if(!dirty&&!busy)return;const handler=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler)},[dirty,busy])
  function reload(){setRevision(value=>value+1)}
  function choose(item:Announcement|'new'|null){if(busy)return;if(dirty&&!window.confirm('저장하지 않은 내용을 버릴까요?'))return;setEditing(item);setInput(item&&item!=='new'?{title:item.title,body:item.body,is_pinned:item.is_pinned}:{...empty});setDirty(false);setError('')}
  function change(values:Partial<AnnouncementInput>){setInput(current=>({...current,...values}));setDirty(true)}
  async function submit(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{await saveAnnouncement(cohortId,input,editing==='new'?null:editing);setDirty(false);setEditing(null);setNotice('공지를 저장했습니다.');reload()}catch(cause){setError(cause instanceof Error?cause.message:'공지를 저장하지 못했습니다.')}finally{setBusy(false)}}
  async function remove(item:Announcement){if(busy||dirty||!window.confirm(`'${item.title}' 공지를 삭제할까요?`))return;setBusy(true);setError('');try{await deleteAnnouncement(cohortId,item);if(editing!=='new'&&editing?.id===item.id){setEditing(null);setDirty(false)}setNotice('공지를 삭제했습니다.');reload()}catch(cause){setError(cause instanceof Error?cause.message:'공지를 삭제하지 못했습니다.')}finally{setBusy(false)}}
  const query=search.trim().toLocaleLowerCase()
  const visible=(result?.rows??[]).filter(item=>(!pinnedOnly||item.is_pinned)&&(!query||`${item.title} ${item.body}`.toLocaleLowerCase().includes(query)))
  return <>
    {notice&&<p className="success-message" role="status">{notice}</p>}{error&&<p className="form-error" role="alert">{error}</p>}
    <section className="panel"><div className="section-heading"><h2>공지 목록 · {result?.rows.length??0}건</h2><div className="button-row"><Button className="button-secondary" disabled={busy} onClick={reload}>새로고침</Button>{manage&&<Button disabled={busy} onClick={()=>choose('new')}>공지 작성</Button>}</div></div>
      <div className="list-toolbar schedule-toolbar"><div><label className="sr-only" htmlFor="announcement-search">공지 제목·내용 검색</label><input id="announcement-search" type="search" placeholder="공지 제목·내용 검색" value={search} onChange={event=>setSearch(event.target.value)}/></div><label className="announcement-filter"><input type="checkbox" checked={pinnedOnly} onChange={event=>setPinnedOnly(event.target.checked)}/> 중요 공지만</label></div>
      {result?.revision!==revision?<p role="status">공지를 불러오고 있습니다.</p>:result.error?<p className="form-error" role="alert">{result.error}</p>:!result.rows.length?<p className="empty-state">등록된 공지가 없습니다.</p>:!visible.length?<p className="empty-state">검색 조건에 맞는 공지가 없습니다.</p>:<><p className="field-help" role="status">전체 {result.rows.length}건 · 표시 {visible.length}건</p><div className="comment-list">{visible.map(item=><article className="comment-item" key={item.id}><div className="section-heading"><div>{item.is_pinned&&<span className="badge">중요</span>}<h3>{item.title}</h3><p className="field-help">{item.author_name} · {formatScheduleTime(item.created_at)} (KST){item.updated_at!==item.created_at?' · 수정됨':''}</p></div>{manage&&<div className="button-row"><Button className="button-secondary" disabled={busy} onClick={()=>choose(item)}>수정</Button><Button className="button-secondary" disabled={busy||dirty} onClick={()=>void remove(item)}>삭제</Button></div>}</div><p className="proposal-text">{item.body}</p></article>)}</div></>}
    </section>
    {manage&&editing&&<section className="panel"><h2>{editing==='new'?'새 공지':'공지 수정'}</h2><form className="cohort-form" onSubmit={event=>void submit(event)}><fieldset disabled={busy}><label htmlFor="announcement-title">제목</label><input id="announcement-title" required maxLength={120} value={input.title} onChange={event=>change({title:event.target.value})}/><label htmlFor="announcement-body">내용</label><textarea id="announcement-body" required rows={8} maxLength={10000} value={input.body} onChange={event=>change({body:event.target.value})}/><p className="field-help">{input.body.length.toLocaleString()} / 10,000자</p><label className="announcement-pin"><input type="checkbox" checked={input.is_pinned} onChange={event=>change({is_pinned:event.target.checked})}/> 중요 공지로 상단 고정</label><div className="button-row"><Button type="submit">{busy?'저장 중…':'저장'}</Button><Button type="button" className="button-secondary" onClick={()=>choose(null)}>취소</Button></div></fieldset></form></section>}
    {blocker.state==='blocked'&&<div className="notice" role="alert"><p>{busy?'처리가 끝난 뒤 이동해 주세요.':'저장하지 않은 내용을 버리고 이동할까요?'}</p><div className="button-row"><Button disabled={busy} onClick={()=>blocker.proceed()}>이동</Button><Button className="button-secondary" onClick={()=>blocker.reset()}>계속 작성</Button></div></div>}
  </>
}
export function AnnouncementsPage(){
  const {profile}=useAuth();const manage=profile?.role==='professor'
  const {cohorts,loading,error,reload}=useCohorts()
  const [params,setParams]=useSearchParams()
  const requested=params.get('cohort')
  const selected=requested?cohorts.find(item=>item.id===requested):cohorts.find(item=>item.status==='active')??cohorts[0]
  return <><div className="page-heading"><div><p className="eyebrow">PROGRAM ANNOUNCEMENTS</p><h1>공지사항</h1><p className="muted">{manage?'프로그램별 공지를 관리합니다.':'참여 프로그램의 공지를 확인하세요.'}</p></div></div>
    {loading?<p role="status">프로그램을 불러오고 있습니다.</p>:error?<div className="notice" role="alert"><p>{error}</p><Button onClick={reload}>다시 시도</Button></div>:!cohorts.length?<section className="panel empty-state"><h2>{manage?'먼저 프로그램을 등록해 주세요.':'참여 중인 프로그램이 없습니다.'}</h2>{manage&&<Link className="button" to="/cohorts?new=1">프로그램 등록</Link>}</section>:<><div className="cohort-selector"><label htmlFor="announcement-cohort">프로그램 선택</label><select id="announcement-cohort" value={selected?.id??''} onChange={event=>setParams({cohort:event.target.value})}>{cohorts.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div>{selected?<Workspace key={selected.id} cohortId={selected.id} manage={manage}/>:<p role="alert">요청한 프로그램을 찾을 수 없습니다.</p>}</>}
  </>
}
