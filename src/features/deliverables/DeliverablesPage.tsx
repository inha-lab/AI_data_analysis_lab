import { useEffect,useState,type FormEvent } from 'react'
import { Link,useBlocker,useParams,useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Download,Upload } from 'lucide-react'
import { isManager, useAuth } from '@/features/auth/auth-context'
import { CommentsPanel } from '@/features/comments/CommentsPanel'
import { formatScheduleTime } from '@/features/schedules/schedule-model'
import { safeTeamUrl } from '@/features/teams/team-model'
import { deleteDeliverable,downloadDeliverableFile,loadDeliverables,saveDeliverable } from './deliverable-api'
import { deliverableCategories,deliverableFileAccept,emptyDeliverable,formatFileSize,validateDeliverable,validateDeliverableFile,type Deliverable,type DeliverableCategory,type DeliverableInput } from './deliverable-model'

function Workspace({teamId,selectedId}:{teamId:string;selectedId:string|null}){
  const {profile}=useAuth()
  const manage=isManager(profile?.role)
  const [revision,setRevision]=useState(0)
  const [result,setResult]=useState<{revision:number;data:Awaited<ReturnType<typeof loadDeliverables>>|null;error:string}|null>(null)
  const [editing,setEditing]=useState<string|null>(null)
  const [input,setInput]=useState<DeliverableInput>(emptyDeliverable)
  const [dirty,setDirty]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [category,setCategory]=useState<'all'|DeliverableCategory>('all')
  const [search,setSearch]=useState('')
  const [commentTarget,setCommentTarget]=useState<string|null>(null)
  const [selectedFile,setSelectedFile]=useState<File|null>(null)
  const [fileInputKey,setFileInputKey]=useState(0)
  const blocker=useBlocker(dirty||busy)
  useEffect(()=>{
    let active=true
    void loadDeliverables(teamId).then(data=>{if(active)setResult({revision,data,error:''})}).catch(cause=>{if(active)setResult({revision,data:null,error:cause instanceof Error?cause.message:'산출물을 불러오지 못했습니다.'})})
    return ()=>{active=false}
  },[teamId,revision])
  useEffect(()=>{
    if(result?.revision!==revision||!selectedId||!result.data?.items.some(item=>item.id===selectedId))return
    document.getElementById(`deliverable-${selectedId}`)?.scrollIntoView({behavior:'smooth',block:'center'})
  },[result,revision,selectedId])
  useEffect(()=>{
    if(!dirty&&!busy)return
    const beforeUnload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''}
    window.addEventListener('beforeunload',beforeUnload)
    return ()=>window.removeEventListener('beforeunload',beforeUnload)
  },[dirty,busy])
  function reload(){setRevision(value=>value+1)}
  function choose(item:Deliverable|'new'|null){
    if(busy)return
    if(dirty&&!window.confirm('저장하지 않은 내용을 버릴까요?'))return
    setEditing(item==='new'?'new':item?.id??null)
    setInput(item&&item!=='new'?{category:item.category,title:item.title,description:item.description,url:item.url}:{...emptyDeliverable})
    setSelectedFile(null);setFileInputKey(value=>value+1)
    setDirty(false);setError('')
  }
  function change(key:keyof DeliverableInput,value:string){setInput(current=>({...current,[key]:value}));setDirty(true)}
  async function submit(event:FormEvent){
    event.preventDefault()
    const previous=result?.data?.items.find(item=>item.id===editing)??null
    const validation=validateDeliverable(input,Boolean(selectedFile||previous?.file_path))
    if(validation){setError(validation);return}
    if(selectedFile){const fileError=validateDeliverableFile(selectedFile);if(fileError){setError(fileError);return}}
    setBusy(true);setError('')
    try{
      await saveDeliverable(teamId,input,previous,selectedFile)
      setDirty(false);setEditing(null);setNotice(previous?'산출물을 수정했습니다.':'산출물을 등록했습니다.');reload()
    }catch(cause){setError(cause instanceof Error?cause.message:'산출물을 저장하지 못했습니다.')}
    finally{setBusy(false)}
  }
  async function remove(item:Deliverable){
    if(busy||dirty||!window.confirm(`'${item.title}' 산출물을 삭제할까요?`))return
    setBusy(true);setError('')
    try{await deleteDeliverable(teamId,item);setNotice('산출물을 삭제했습니다.');if(editing===item.id){setEditing(null);setDirty(false)}if(commentTarget===item.id)setCommentTarget(null);reload()}
    catch(cause){setError(cause instanceof Error?cause.message:'산출물을 삭제하지 못했습니다.')}
    finally{setBusy(false)}
  }
  if(result?.revision!==revision)return <p role="status">산출물을 불러오고 있습니다.</p>
  if(!result.data)return <div className="notice" role="alert"><p>{result.error}</p><Button onClick={reload}>다시 시도</Button></div>
  const {team,items,cohortStatus}=result.data
  const writable=!manage&&cohortStatus==='active'
  const shown=items.filter(item=>(category==='all'||item.category===category)&&`${item.title} ${item.description}`.toLowerCase().includes(search.trim().toLowerCase()))
  return <>
    <div className="page-heading"><div><p className="eyebrow">TEAM DELIVERABLES</p><h1>{team.name} 산출물</h1><p className="muted">자료 URL 또는 PDF·PPTX·ZIP 파일을 등록하고 팀원과 교수에게 공유합니다.</p></div><Link className="text-link" to={`/teams?cohort=${team.cohort_id}`}>팀 목록으로 →</Link></div>
    {notice&&<p className="success-message" role="status">{notice}</p>}{error&&<p className="form-error" role="alert">{error}</p>}{!manage&&cohortStatus==='completed'&&<p className="notice">종료된 프로그램입니다. 산출물은 조회만 할 수 있습니다.</p>}
    <section className="panel"><div className="section-heading"><h2>등록된 산출물 · {items.length}건</h2>{writable&&<Button disabled={busy} onClick={()=>choose('new')}>산출물 등록</Button>}</div>
      <div className="list-toolbar schedule-toolbar"><div><input type="search" aria-label="산출물 검색" placeholder="제목·설명 검색" value={search} onChange={event=>setSearch(event.target.value)} /></div><select aria-label="산출물 유형 필터" value={category} onChange={event=>setCategory(event.target.value as 'all'|DeliverableCategory)}><option value="all">전체 유형</option>{Object.entries(deliverableCategories).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select><Button className="button-secondary" disabled={busy||dirty} onClick={reload}>새로고침</Button></div>
      {!shown.length?<p className="empty-state">{items.length?'검색 결과가 없습니다.':'등록된 산출물이 없습니다.'}</p>:<div className="deliverable-list">{shown.map(item=><div id={`deliverable-${item.id}`} className={selectedId===item.id?'deliverable-selected':''} key={item.id}><article className="deliverable-row"><div><span className="badge">{deliverableCategories[item.category]}</span><h3>{item.title}</h3><p className="proposal-text">{item.description||'설명 없음'}</p>{item.file_name&&item.file_size!==null&&<p className="deliverable-file-info"><strong>{item.file_name}</strong><span>{formatFileSize(item.file_size)}</span></p>}<p className="field-help">최근 제출 {item.submitted_name} · {formatScheduleTime(item.submitted_at)} (KST)</p></div><div className="button-row">{item.file_path&&<Button className="button-secondary" onClick={()=>void downloadDeliverableFile(item).catch(cause=>setError(cause instanceof Error?cause.message:'파일을 다운로드하지 못했습니다.'))}><Download size={15} aria-hidden="true" /> 파일 다운로드</Button>}{safeTeamUrl(item.url)&&<a href={safeTeamUrl(item.url)!} className="text-link" target="_blank" rel="noopener noreferrer">링크 열기 ↗</a>}<Button className="button-secondary" aria-expanded={commentTarget===item.id} onClick={()=>setCommentTarget(current=>current===item.id?null:item.id)}>코멘트 {commentTarget===item.id?'닫기':'보기'}</Button>{writable&&<><Button className="button-secondary" disabled={busy} onClick={()=>choose(item)}>수정</Button><Button className="button-secondary" disabled={busy||dirty} onClick={()=>void remove(item)}>삭제</Button></>}</div></article>{commentTarget===item.id&&<CommentsPanel key={item.id} teamId={team.id} deliverableId={item.id}/>}</div>)}</div>}
    </section>
    {editing&&!manage&&<section className="panel deliverable-editor"><h2>{editing==='new'?'새 산출물':'산출물 수정'}</h2><form className="cohort-form" onSubmit={event=>void submit(event)}><fieldset disabled={busy}><label htmlFor="deliverable-category">유형</label><select id="deliverable-category" value={input.category} onChange={event=>change('category',event.target.value)}>{Object.entries(deliverableCategories).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select><label htmlFor="deliverable-title">제목</label><input id="deliverable-title" required maxLength={120} value={input.title} onChange={event=>change('title',event.target.value)} /><label htmlFor="deliverable-url">자료 URL</label><input id="deliverable-url" type="url" maxLength={2000} placeholder="https:// (파일 제출 시 선택)" value={input.url} onChange={event=>change('url',event.target.value)} /><label htmlFor="deliverable-file">파일</label><input key={fileInputKey} id="deliverable-file" type="file" accept={deliverableFileAccept} onChange={event=>{const file=event.target.files?.[0]??null;setSelectedFile(file);setDirty(true);setError(file?validateDeliverableFile(file)??'':'')}}/><p className="field-help"><Upload size={14} aria-hidden="true" /> PDF·PPTX·ZIP, 최대 20MB{selectedFile?` · 선택: ${selectedFile.name} (${formatFileSize(selectedFile.size)})`:editing!=='new'&&result.data.items.find(item=>item.id===editing)?.file_name?` · 현재 파일: ${result.data.items.find(item=>item.id===editing)?.file_name}`:''}</p><label htmlFor="deliverable-description">설명</label><textarea id="deliverable-description" rows={4} maxLength={4000} value={input.description} onChange={event=>change('description',event.target.value)} /><p className="field-help">{input.description.length.toLocaleString()} / 4,000자 · URL 또는 파일 중 하나 이상 필요하며, 수정하면 최근 제출자와 시각이 갱신됩니다.</p><div className="button-row"><Button type="submit">{busy?'저장 중…':'저장'}</Button><Button type="button" className="button-secondary" onClick={()=>choose(null)}>취소</Button></div></fieldset></form></section>}
    {blocker.state==='blocked'&&<div className="notice" role="alert"><p>{busy?'처리가 끝난 뒤 이동해 주세요.':'저장하지 않은 내용을 버리고 이동할까요?'}</p><div className="button-row"><Button disabled={busy} onClick={()=>blocker.proceed()}>이동</Button><Button className="button-secondary" onClick={()=>blocker.reset()}>계속 작성</Button></div></div>}
  </>
}
export function DeliverablesPage(){
  const {teamId}=useParams()
  const [params]=useSearchParams()
  if(!teamId||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId))return <p role="alert">올바른 팀 주소가 아닙니다.</p>
  return <Workspace key={teamId} teamId={teamId} selectedId={params.get('deliverable')}/>
}
