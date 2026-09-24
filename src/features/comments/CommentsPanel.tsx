import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { formatScheduleTime } from '@/features/schedules/schedule-model'
import { supabase } from '@/lib/supabase'

type Comment = { id:string;team_id:string;proposal_team_id:string|null;report_id:string|null;author_id:string;author_name:string;body:string;created_at:string;updated_at:string }
function errorMessage(code:string) {
  if(code==='40001') return '다른 곳에서 코멘트가 변경되었습니다. 다시 불러와 주세요.'
  if(code==='42501') return '코멘트를 변경할 권한이 없습니다.'
  if(code==='23514'||code==='23502') return '코멘트 내용을 확인해 주세요.'
  return '코멘트를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}
export function CommentsPanel({teamId,reportId}:{teamId:string;reportId?:string}) {
  const {profile}=useAuth()
  const manage=profile?.role==='professor'
  const [comments,setComments]=useState<Comment[]>([])
  const [revision,setRevision]=useState(0)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [body,setBody]=useState('')
  const [editing,setEditing]=useState<Comment|null>(null)
  const [busy,setBusy]=useState(false)
  useEffect(()=>{
    let active=true
    if(!supabase) return
    const query=supabase.from('AD_comments').select('id,team_id,proposal_team_id,report_id,author_id,author_name,body,created_at,updated_at').eq(reportId?'report_id':'proposal_team_id',reportId??teamId).order('created_at',{ascending:true})
    void query.then(({data,error:failure})=>{if(active){setComments((data??[]) as Comment[]);setError(failure?errorMessage(failure.code):'');setLoading(false)}})
    return ()=>{active=false}
  },[teamId,reportId,revision])
  function reload(){setLoading(true);setRevision(value=>value+1)}
  function startEdit(comment:Comment){setEditing(comment);setBody(comment.body);setError('')}
  function cancel(){setEditing(null);setBody('');setError('')}
  async function save(){
    if(!supabase)return
    const value=body.trim()
    if(!value||value.length>4000){setError('코멘트는 1~4,000자로 입력해 주세요.');return}
    setBusy(true);setError('')
    const {error:failure}=await supabase.rpc('AD_save_comment',{p_team:teamId,p_proposal:!reportId,p_report:reportId??null,p_comment:editing?.id??null,p_version:editing?.updated_at??null,p_body:value})
    setBusy(false)
    if(failure){setError(errorMessage(failure.code));return}
    cancel();reload()
  }
  async function remove(comment:Comment){
    if(!supabase||!window.confirm('이 코멘트를 삭제할까요?'))return
    setBusy(true);setError('')
    const {error:failure}=await supabase.rpc('AD_delete_comment',{p_comment:comment.id,p_version:comment.updated_at})
    setBusy(false)
    if(failure){setError(errorMessage(failure.code));return}
    if(editing?.id===comment.id)cancel()
    reload()
  }
  return <section className="panel comments-panel"><div className="section-heading"><h2>코멘트 · {comments.length}건</h2><Button className="button-secondary" disabled={busy} onClick={reload}>새로고침</Button></div>
    {loading?<p className="field-help">코멘트를 불러오고 있습니다.</p>:comments.length?<div className="comment-list">{comments.map(comment=><article className="comment-item" key={comment.id}><div className="section-heading"><div><strong>{comment.author_name}</strong><p className="field-help">{formatScheduleTime(comment.created_at)} (KST){comment.updated_at!==comment.created_at?' · 수정됨':''}</p></div>{manage&&profile?.id===comment.author_id&&<div className="button-row"><Button className="button-secondary" disabled={busy} onClick={()=>startEdit(comment)}>수정</Button><Button className="button-secondary" disabled={busy} onClick={()=>void remove(comment)}>삭제</Button></div>}</div><p className="proposal-text">{comment.body}</p></article>)}</div>:<p className="field-help">등록된 코멘트가 없습니다.</p>}
    {manage&&<div className="cohort-form"><label htmlFor={`comment-body-${reportId??'proposal'}`}>{editing?'코멘트 수정':'코멘트 작성'}</label><textarea id={`comment-body-${reportId??'proposal'}`} rows={4} maxLength={4000} disabled={busy} value={body} onChange={event=>setBody(event.target.value)} /><p className="field-help">{body.length.toLocaleString()} / 4,000자 · 검토 완료 처리와 별도로 저장됩니다.</p><div className="button-row"><Button disabled={busy} onClick={()=>void save()}>{editing?'수정 저장':'코멘트 등록'}</Button>{editing&&<Button className="button-secondary" disabled={busy} onClick={cancel}>취소</Button>}</div></div>}
    {error&&<p className="form-error" role="alert">{error}</p>}
  </section>
}
