import { useEffect, useState } from 'react'
import { Link, useBlocker, useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/auth-context'
import { Button } from '@/components/ui/button'
import { safeTeamUrl } from '@/features/teams/team-model'
import { formatScheduleTime } from '@/features/schedules/schedule-model'
import { CommentsPanel } from '@/features/comments/CommentsPanel'
import { loadProposal, saveProposal, reviewProposal } from './proposal-api'
import { emptyProposal, proposalSections, proposalStatusLabels, proposalValues, type Proposal, type ProposalInput } from './proposal-model'

function UnsavedGuard({ dirty, busy }: { dirty: boolean; busy: boolean }) {
  const blocker = useBlocker(dirty || busy)
  useEffect(() => {
    if (!dirty && !busy) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty, busy])
  return blocker.state === 'blocked' ? <div className="notice" role="alert"><p>{busy ? '처리가 끝난 후 이동해 주세요.' : '저장하지 않은 내용을 버리고 이동할까요?'}</p><div className="button-row"><Button disabled={busy} onClick={() => blocker.proceed()}>이동</Button><Button className="button-secondary" onClick={() => blocker.reset()}>계속 작성</Button></div></div> : null
}
function ProposalEditor({ teamId, teamName, proposal, onSaved, reload }: { teamId: string; teamName: string; proposal: Proposal | null; onSaved: (message: string) => void; reload: () => void }) {
  const [input, setInput] = useState<ProposalInput>(() => proposal ? proposalValues(proposal) : emptyProposal(teamName))
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  function change(key: keyof ProposalInput, value: string) { setInput(current => ({ ...current, [key]: value })); setDirty(true) }
  async function save(submit: boolean) {
    if (submit && !window.confirm('기획서를 제출할까요? 제출 후에는 교수의 수정 요청이 있어야 다시 작성할 수 있습니다.')) return
    setBusy(true); setError('')
    try { await saveProposal(teamId, input, submit, proposal); setDirty(false); onSaved(submit ? '기획서를 제출했습니다.' : '기획서를 임시 저장했습니다.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : '저장하지 못했습니다.') }
    finally { setBusy(false) }
  }
  return <section className="panel"><form className="cohort-form" onSubmit={event => { event.preventDefault(); void save(false) }}><fieldset disabled={busy}>
    <label htmlFor="proposal-title">프로젝트명</label><input id="proposal-title" required maxLength={120} value={input.title} onChange={e => change('title', e.target.value)} />
    <p className="field-help">팀원 모두가 같은 기획서를 작성합니다. 항목별 8,000자까지 입력할 수 있으며 제출 시 6개 항목을 모두 작성해야 합니다.</p>
    {proposalSections.map((section, index) => <div key={section.key}><label htmlFor={`proposal-${section.key}`}>{index + 1}. {section.label}</label><p id={`help-${section.key}`} className="field-help">{section.help}</p><textarea id={`proposal-${section.key}`} aria-describedby={`help-${section.key}`} rows={6} maxLength={8000} value={input[section.key]} onChange={e => change(section.key, e.target.value)} /><p className="field-help">{input[section.key].length.toLocaleString()} / 8,000자</p></div>)}
    <label htmlFor="proposal-notion">Notion 보조 링크 (선택)</label><input id="proposal-notion" type="url" maxLength={2000} value={input.notion_url} placeholder="https://" onChange={e => change('notion_url', e.target.value)} />
    <p className="field-help">링크만 저장하며 외부 문서 내용을 자동으로 가져오지 않습니다.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="button-row"><Button type="submit">{busy ? '처리 중…' : '임시 저장'}</Button><Button onClick={() => void save(true)}>기획서 제출</Button><Button className="button-secondary" onClick={() => { if (!dirty || window.confirm('입력 중인 내용을 버리고 저장된 기획서를 다시 불러올까요?')) reload() }}>다시 불러오기</Button></div>
  </fieldset></form><UnsavedGuard dirty={dirty} busy={busy} /></section>
}
function ReviewPanel({ proposal, onSaved, reload }: { proposal: Proposal; onSaved: (message: string) => void; reload: () => void }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function review(action: 'reviewed' | 'returned') {
    if (!window.confirm(action === 'reviewed' ? '기획서를 검토 완료로 처리할까요?' : '수정 요청을 보내 팀원이 다시 작성할 수 있게 할까요?')) return
    setBusy(true); setError('')
    try { await reviewProposal(proposal, action, note); setNote(''); onSaved(action === 'reviewed' ? '검토 완료로 처리했습니다.' : '수정을 요청했습니다. 팀원이 다시 작성할 수 있습니다.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : '검토 결과를 저장하지 못했습니다.') }
    finally { setBusy(false) }
  }
  return <section className="panel proposal-review"><h2>교수 검토</h2><div className="cohort-form"><fieldset disabled={busy}><label htmlFor="proposal-review-note">피드백 · 수정 요청 시 필수</label><textarea id="proposal-review-note" rows={4} maxLength={4000} value={note} onChange={e => setNote(e.target.value)} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="button-row">{proposal.status === 'submitted' && <Button onClick={() => void review('reviewed')}>검토 완료</Button>}<Button className="button-secondary" onClick={() => void review('returned')}>수정 요청</Button><Button className="button-secondary" onClick={() => { if (!note || window.confirm('입력 중인 피드백을 버리고 최신 기획서를 불러올까요?')) reload() }}>최신 내용 조회</Button></div>
  </fieldset></div><UnsavedGuard dirty={Boolean(note)} busy={busy} /></section>
}
function ProposalWorkspace({ teamId }: { teamId: string }) {
  const { profile } = useAuth()
  const manage = profile?.role === 'professor'
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ revision: number; data: Awaited<ReturnType<typeof loadProposal>> | null; error: string } | null>(null)
  const [notice, setNotice] = useState('')
  const reload = () => setRevision(value => value + 1)
  function saved(message: string) { setNotice(message); reload() }
  useEffect(() => {
    let active = true
    void loadProposal(teamId).then(data => { if (active) setResult({ revision, data, error: '' }) }).catch(cause => {
      if (active) setResult({ revision, data: null, error: cause instanceof Error ? cause.message : '기획서를 불러오지 못했습니다.' })
    })
    return () => { active = false }
  }, [teamId, revision])
  if (result?.revision !== revision) return <p className="empty-state" role="status">기획서를 불러오고 있습니다.</p>
  if (!result.data) return <div className="notice" role="alert"><p>{result.error}</p><div className="button-row"><Button onClick={reload}>다시 시도</Button><Link className="text-link" to="/teams">팀 목록으로 →</Link></div></div>
  const { team, roster, proposal } = result.data
  const edit = !manage && (!proposal || proposal.status === 'draft')
  const notion = proposal ? safeTeamUrl(proposal.notion_url) : null
  return <>
    <div className="page-heading"><div><p className="eyebrow">PROJECT PROPOSAL</p><h1>프로젝트 기획서</h1><p className="muted">{team.name} · {roster.map(member => `${member.full_name}${member.is_leader ? ' (팀장)' : ''}`).join(', ') || '팀원 미배정'}</p></div><Link to={`/teams?cohort=${team.cohort_id}`} className="text-link">팀 목록으로 →</Link></div>
    {notice && <p className="success-message" role="status">{notice}</p>}
    <section className="notice"><span className={`badge ${proposal?.status === 'reviewed' ? 'status-active' : 'status-draft'}`}>{proposal ? proposalStatusLabels[proposal.status] : '미작성'}</span>
      {proposal && <><p>최종 변경: {proposal.updated_name} · {formatScheduleTime(proposal.updated_at)} (KST)</p>{proposal.submitted_at && <p>최근 제출: {proposal.submitted_name} · {formatScheduleTime(proposal.submitted_at)} (KST)</p>}</>}
      {manage ? <p>팀원이 작성한 기획서를 확인하고 제출된 자료에 검토 결과를 남기세요.</p> : !edit && <p>제출된 기획서입니다. 교수의 수정 요청 후 다시 작성할 수 있습니다.</p>}
    </section>
    {proposal?.reviewed_at && <section className="panel proposal-review"><h2>최근 교수 피드백 · {proposal.review_action === 'returned' ? '수정 요청' : '검토 완료'}</h2><p className="field-help">{proposal.reviewer_name} · {formatScheduleTime(proposal.reviewed_at)} (KST)</p><p className="proposal-text">{proposal.review_note || '별도 피드백 없이 검토를 완료했습니다.'}</p></section>}
    {edit ? <ProposalEditor teamId={team.id} teamName={team.name} proposal={proposal} onSaved={saved} reload={reload} />
      : proposal ? <section className="panel"><h2>{proposal.title}</h2>{proposalSections.map((section, index) => <section className="proposal-section" key={section.key}><h3>{index + 1}. {section.label}</h3><p className="proposal-text">{proposal[section.key] || '미작성'}</p></section>)}{notion && <a className="text-link" href={notion} target="_blank" rel="noopener noreferrer">Notion 보조 문서 ↗</a>}</section>
        : <section className="panel empty-state"><h2>아직 작성된 기획서가 없습니다.</h2><p>소속 학생이 ‘워크스페이스’에서 기획서를 작성할 수 있습니다.</p></section>}
    {manage && proposal && proposal.status !== 'draft' && <ReviewPanel proposal={proposal} onSaved={saved} reload={reload} />}
    {proposal && <CommentsPanel teamId={team.id} />}
  </>
}
export function ProposalPage() {
  const { teamId } = useParams()
  if (!teamId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId)) return <p role="alert">올바른 팀 주소가 아닙니다.</p>
  return <ProposalWorkspace key={teamId} teamId={teamId} />
}
