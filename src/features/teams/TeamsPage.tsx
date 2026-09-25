import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, RefreshCw } from 'lucide-react'
import { useAuth } from '@/features/auth/auth-context'
import { useCohorts } from '@/features/cohorts/use-cohorts'
import type { Cohort } from '@/features/cohorts/cohort-model'
import { jobGroups } from '@/features/participants/participant-model'
import { Button } from '@/components/ui/button'
import { deleteEmptyTeam, loadTeams } from './team-api'
import { jobSummary, safeTeamUrl, teamStages, type Team, type TeamMember } from './team-model'
import { TeamEditor } from './TeamEditor'

function TeamCard({team,members,manage,editing,deleting,onEdit,onDelete}:{team:Team;members:TeamMember[];manage:boolean;editing:boolean;deleting:boolean;onEdit:()=>void;onDelete:()=>void}){
  const leader=members.find(item=>item.is_leader)
  return <article className={manage?'team-overview-card':'team-overview-card student-team-card'}><div className="team-overview-heading"><span className="badge">{teamStages[team.stage]}</span><span className="field-help">{members.length}명</span></div>
    <h2>{team.name}</h2><p className="team-overview-topic">{team.topic||'프로젝트 주제 미등록'}</p>
    <p className="team-overview-leader">팀장 <strong>{leader?.full_name||'미지정'}</strong></p>
    {manage?<div className="team-overview-links"><Link to={`/teams/${team.id}/proposal`}>기획서 →</Link><Link to={`/teams/${team.id}/reports`}>보고서 →</Link><Link to={`/teams/${team.id}/deliverables`}>산출물 →</Link><Link to={`/teams/${team.id}/full-report`}>전체리포트 →</Link></div>:<nav className="student-team-nav" aria-label={`${team.name} 작업 바로가기`}><Link to={`/teams/${team.id}/proposal`}><strong>기획서 →</strong><span>작성·제출·검토 확인</span></Link><Link to={`/teams/${team.id}/reports`}><strong>보고서 →</strong><span>일일·주간 보고</span></Link><Link to={`/teams/${team.id}/deliverables`}><strong>산출물 →</strong><span>링크 자료 제출·조회</span></Link><Link to={`/teams/${team.id}/full-report`}><strong>전체리포트 →</strong><span>팀 자료 통합 보기</span></Link></nav>}
    <details className="team-overview-details"><summary>팀원·직무·링크 자세히</summary><p className="field-help">{jobSummary(members)}</p>
      {members.length?<ul className="team-roster">{members.map(member=><li key={member.participant_id}><strong>{member.full_name}</strong> {member.is_leader&&<span className="badge status-active">팀장</span>} {!member.is_active&&<span className="badge">비활성</span>}<span>{member.department} · {jobGroups[member.job_group]}</span></li>)}</ul>:<p className="field-help">배정된 팀원이 없습니다.</p>}
      <div className="button-row">{([['Notion',team.notion_url],['GitHub',team.github_url],['데모',team.demo_url]] as const).map(([label,value])=>{const url=safeTeamUrl(value);return url?<a key={label} href={url} target="_blank" rel="noopener noreferrer" className="text-link">{label} ↗</a>:null})}</div>
    </details>
    <div className="team-overview-actions"><Button className="button-secondary" disabled={editing||deleting} onClick={onEdit}>{manage?'팀 수정':'프로젝트 수정'}</Button>{manage&&!members.length&&<Button className="button-secondary" disabled={editing||deleting} onClick={onDelete}>빈 팀 삭제</Button>}</div>
  </article>
}

function TeamWorkspace({ cohort, manage, editing, setEditing, deleting, setDeleting }: {
  cohort: Cohort; manage: boolean; editing: Team | 'new' | null; setEditing: (value: Team | 'new' | null) => void; deleting: boolean; setDeleting: (value: boolean) => void
}) {
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<({ revision: number; error: string } & Awaited<ReturnType<typeof loadTeams>>) | null>(null)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState('all')
  useEffect(() => {
    let active = true
    void loadTeams(cohort.id).then(data => { if (active) setResult({ ...data, revision, error: '' }) }).catch(cause => {
      if (active) setResult({ teams: [], roster: [], candidates: [], revision, error: cause instanceof Error ? cause.message : '팀 정보를 불러오지 못했습니다.' })
    })
    return () => { active = false }
  }, [cohort.id, manage, revision])
  const loading = result?.revision !== revision
  async function remove(team: Team) {
    if (!window.confirm(`빈 팀 '${team.name}'을 삭제할까요? 삭제 후 복구할 수 없습니다.`)) return
    setDeleting(true); setActionError(''); setNotice('')
    try { await deleteEmptyTeam(team); setNotice('빈 팀을 삭제했습니다.'); setRevision(value => value + 1) }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : '팀을 삭제하지 못했습니다.') }
    finally { setDeleting(false) }
  }
  const rosterByTeam=new Map<string,TeamMember[]>()
  for(const member of result?.roster??[]){
    const members=rosterByTeam.get(member.team_id)??[]
    members.push(member)
    rosterByTeam.set(member.team_id,members)
  }
  const visible=(result?.teams??[]).filter(team=>`${team.name} ${team.topic} ${(rosterByTeam.get(team.id)??[]).map(member=>member.full_name).join(' ')}`.toLowerCase().includes(search.trim().toLowerCase())&&(stage==='all'||team.stage===stage)).sort((left,right)=>left.name.localeCompare(right.name,'ko',{numeric:true}))
  return <>
    <div className="participant-summary"><p><strong>{cohort.name}</strong> · {result?.teams.length ?? 0}개 팀</p><div className="button-row"><Button className="button-secondary" disabled={loading || Boolean(editing) || deleting} onClick={() => { setActionError(''); setRevision(value => value + 1) }}><RefreshCw size={16} aria-hidden="true" /> 새로고침</Button>
      {manage && <Button disabled={loading || Boolean(result?.error) || Boolean(editing) || deleting} onClick={() => { setNotice(''); setEditing('new') }}><Plus size={16} aria-hidden="true" /> 새 팀</Button>}</div></div>
    {notice && <p className="success-message" role="status">{notice}</p>}{actionError && <p className="form-error" role="alert">{actionError}</p>}
    <div className={editing ? 'cohort-workspace with-editor' : 'cohort-workspace'}><section className={manage?'panel team-list-panel':'panel team-list-panel student-team-panel'} aria-label={manage?'팀 목록':'내 팀'}>
      {loading ? <p className="empty-state" role="status">팀 정보를 불러오고 있습니다.</p> : result.error ? <p className="form-error" role="alert">{result.error}</p> : <>
        {manage && <p className="field-help">배정 대기 {result.candidates.filter(item => item.eligibility === 'ready' && !item.team_id).length}명 · 계정 연결 필요 {result.candidates.filter(item => item.eligibility === 'unlinked').length}명 · <Link to={`/participants?cohort=${cohort.id}`} className="text-link">참가자 관리 →</Link></p>}
        {manage&&<><div className="list-toolbar schedule-toolbar"><div><input aria-label="팀명·주제·팀원 검색" placeholder="팀명·주제·팀원 검색" type="search" value={search} onChange={e => setSearch(e.target.value)} /></div><select aria-label="프로젝트 단계 필터" value={stage} onChange={e => setStage(e.target.value)}><option value="all">모든 단계</option>{Object.entries(teamStages).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><p className="field-help" role="status">전체 {result.teams.length}개 팀 · 표시 {visible.length}개 팀</p></>}
        {!visible.length ? <div className="empty-state"><h2>{result.teams.length ? '검색 결과가 없습니다.' : manage ? '등록된 팀이 없습니다.' : '배정된 팀이 없습니다.'}</h2><p>{manage ? '참가자 계정을 연결한 뒤 팀을 만들고 팀원을 배정하세요.' : '팀 배정은 운영 담당자에게 문의해 주세요.'}</p></div>
          : <div className={manage?'team-overview-grid':'team-overview-grid student-team-grid'}>{visible.map(team=><TeamCard key={team.id} team={team} members={rosterByTeam.get(team.id)??[]} manage={manage} editing={Boolean(editing)} deleting={deleting} onEdit={()=>{setNotice('');setEditing(team)}} onDelete={()=>void remove(team)}/>)}</div>}
      </>}
    </section>
    {editing && result && <TeamEditor key={editing === 'new' ? 'new' : editing.id} cohortId={cohort.id} team={editing === 'new' ? undefined : editing} roster={editing === 'new' ? [] : result.roster.filter(item => item.team_id === editing.id)} candidates={result.candidates} manage={manage} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); setNotice('팀 정보를 저장했습니다.'); setRevision(value => value + 1) }} />}
    </div>
  </>
}
export function TeamsPage() {
  const { profile } = useAuth()
  const manage = profile?.role === 'professor'
  const { cohorts, loading, error, reload } = useCohorts()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<Team | 'new' | null>(null)
  const [deleting, setDeleting] = useState(false)
  const requested = params.get('cohort')
  const selected = requested ? cohorts.find(item => item.id === requested) : cohorts.find(item => item.status === 'active') ?? cohorts[0]
  return <>
    <div className="page-heading"><div><p className="eyebrow">TEAM WORKSPACE</p><h1>{manage ? '팀 관리' : '내 팀'}</h1><p className="muted">{manage ? '프로그램별 팀을 구성하고 팀장과 프로젝트 정보를 관리합니다.' : '소속 팀과 프로젝트 정보를 확인하고 업데이트하세요.'}</p></div></div>
    {loading ? <p role="status">프로그램을 불러오고 있습니다.</p> : error ? <div className="notice" role="alert"><p>{error}</p><Button onClick={reload}>다시 시도</Button></div>
      : !cohorts.length ? <section className="panel empty-state"><h2>{manage ? '먼저 프로그램을 등록해 주세요.' : '참여 중인 프로그램이 없습니다.'}</h2>{manage && <Link to="/cohorts?new=1" className="button">프로그램 등록</Link>}</section>
        : <><div className="cohort-selector"><label htmlFor="team-cohort">프로그램 선택</label><select id="team-cohort" disabled={Boolean(editing) || deleting} value={selected?.id ?? ''} onChange={e => setParams({ cohort: e.target.value })}><option value="" disabled>프로그램을 선택하세요</option>{cohorts.map(cohort => <option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}</select></div>
          {selected ? <TeamWorkspace key={selected.id} cohort={selected} manage={manage} editing={editing} setEditing={setEditing} deleting={deleting} setDeleting={setDeleting} /> : <p role="alert">요청한 프로그램을 찾을 수 없습니다. 목록에서 다시 선택해 주세요.</p>}</>}
  </>
}
