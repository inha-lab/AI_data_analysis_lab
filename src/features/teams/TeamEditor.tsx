import { useEffect, useState, type FormEvent } from 'react'
import { useBlocker } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { jobGroups } from '@/features/participants/participant-model'
import { saveTeam, updateTeamProject } from './team-api'
import { emptyTeam, eligibilityLabels, teamStages, teamSizeHint, validateMemberRoles, validateTeamMembers, type Team, type TeamCandidate, type TeamInput, type TeamMember } from './team-model'

export function TeamEditor({ cohortId, team, roster, candidates, manage, onSaved, onCancel }: {
  cohortId: string; team?: Team; roster: TeamMember[]; candidates: TeamCandidate[]; manage: boolean; onSaved: () => void; onCancel: () => void
}) {
  const [input, setInput] = useState<TeamInput>(() => team ? { name: team.name, topic: team.topic, stage: team.stage, notion_url: team.notion_url, github_url: team.github_url, demo_url: team.demo_url } : { ...emptyTeam })
  const [members, setMembers] = useState(() => roster.map(item => item.participant_id))
  const [leader, setLeader] = useState<string | null>(() => roster.find(item => item.is_leader)?.participant_id ?? null)
  const [roles,setRoles]=useState<Record<string,string>>(()=>Object.fromEntries(roster.map(item=>[item.participant_id,item.role_title])))
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const blocker = useBlocker(dirty || busy)
  useEffect(() => {
    if (!dirty && !busy) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty, busy])
  function change<K extends keyof TeamInput>(key: K, value: TeamInput[K]) { setInput(current => ({ ...current, [key]: value })); setDirty(true) }
  function toggle(id: string) {
    setMembers(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id])
    if(members.includes(id))setRoles(current=>Object.fromEntries(Object.entries(current).filter(([key])=>key!==id)))
    if (leader === id) setLeader(null)
    setDirty(true)
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('')
    if (manage) {
      const validation = validateTeamMembers(members, leader, candidates, team?.id)||validateMemberRoles(members,roles)
      if (validation) { setError(validation); return }
    }
    setBusy(true)
    try {
      if (manage) await saveTeam(cohortId, input, members, leader, roles, team)
      else if (team) await updateTeamProject(input, team)
      onSaved()
    } catch (cause) { setError(cause instanceof Error ? cause.message : '팀 정보를 저장하지 못했습니다.') }
    finally { setBusy(false) }
  }
  const visible = candidates.filter(item => `${item.full_name} ${item.department}`.toLowerCase().includes(search.trim().toLowerCase()))
  return <section className="panel editor-panel"><h2>{manage ? team ? '팀 정보·구성 수정' : '새 팀 만들기' : '우리 팀 프로젝트 수정'}</h2>
    <form className="cohort-form" onSubmit={submit}><fieldset disabled={busy}>
      <label htmlFor="team-name">팀명</label><input id="team-name" value={input.name} required maxLength={80} readOnly={!manage} onChange={e => change('name', e.target.value)} autoFocus={manage} />
      <label htmlFor="team-topic">프로젝트 주제</label><textarea id="team-topic" value={input.topic} rows={4} maxLength={2000} onChange={e => change('topic', e.target.value)} />
      <label htmlFor="team-stage">진행 단계</label><select id="team-stage" value={input.stage} onChange={e => change('stage', e.target.value as TeamInput['stage'])}>{Object.entries(teamStages).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      {(['notion_url', 'github_url', 'demo_url'] as const).map((key, index) => <div key={key}><label htmlFor={`team-${key}`}>{['Notion', 'GitHub', '데모'][index]} URL</label><input id={`team-${key}`} type="url" maxLength={2000} value={input[key]} placeholder="https://" onChange={e => change(key, e.target.value)} /></div>)}
      {manage && <>
        <h3 className="team-members-heading">팀원 배정 · {members.length}명 선택</h3><p className="field-help">{teamSizeHint(members.length)}</p>
        <p className="field-help">다른 팀의 참가자는 기존 팀에서 해제한 뒤 배정하세요. 계정이 연결된 활성 학생만 배정할 수 있습니다.</p>
        <label htmlFor="team-member-search">이름·학과 검색</label><input id="team-member-search" type="search" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="team-candidates" aria-label="팀원 배정 후보">{visible.length ? visible.map(item => {
          const selected = members.includes(item.participant_id)
          const elsewhere = Boolean(item.team_id && item.team_id !== team?.id)
          return <label className="team-candidate" key={item.participant_id}><input type="checkbox" checked={selected} disabled={!selected && (item.eligibility !== 'ready' || elsewhere)} onChange={() => toggle(item.participant_id)} /><span><strong>{item.full_name}</strong> · {item.department}<small>{jobGroups[item.job_group]} · {elsewhere ? '다른 팀 배정' : eligibilityLabels[item.eligibility]}</small></span></label>
        }) : <p className="muted">표시할 참가자가 없습니다. 참가자 등록·계정 연결 상태를 확인해 주세요.</p>}</div>
        <label htmlFor="team-leader">팀장</label><select id="team-leader" value={leader ?? ''} onChange={e => { setLeader(e.target.value || null); setDirty(true) }}><option value="">미지정</option>{candidates.filter(item => members.includes(item.participant_id)).map(item => <option key={item.participant_id} value={item.participant_id}>{item.full_name} · {item.department}</option>)}</select>
        <h3 className="team-members-heading">팀원별 역할</h3><p className="field-help">팀에서 실제 맡는 업무를 입력하세요. 예: 데이터 수집, 모델 개발, 발표 자료.</p>
        {candidates.filter(item=>members.includes(item.participant_id)).map(item=><div key={item.participant_id}><label htmlFor={`team-role-${item.participant_id}`}>{item.full_name} 역할</label><input id={`team-role-${item.participant_id}`} maxLength={80} value={roles[item.participant_id]??''} placeholder="역할 미지정" onChange={event=>{setRoles(current=>({...current,[item.participant_id]:event.target.value}));setDirty(true)}}/></div>)}
      </>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="button-row"><Button type="submit">{busy ? '저장 중…' : '저장'}</Button><Button className="button-secondary" onClick={() => { if (!dirty || window.confirm('작성 중인 내용을 저장하지 않고 닫을까요?')) onCancel() }}>닫기</Button></div>
    </fieldset></form>
    {blocker.state === 'blocked' && <div className="notice" role="alert"><p>{busy ? '저장이 끝난 후 이동해 주세요.' : '작성 중인 내용을 저장하지 않고 이동할까요?'}</p><div className="button-row"><Button disabled={busy} onClick={() => blocker.proceed()}>이동</Button><Button className="button-secondary" onClick={() => blocker.reset()}>계속 작성</Button></div></div>}
  </section>
}
