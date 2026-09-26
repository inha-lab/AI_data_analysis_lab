import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/features/auth/auth-context'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { loadTeams } from '@/features/teams/team-api'
import type { Team, TeamMember } from '@/features/teams/team-model'
import { loadDeliverables } from '@/features/deliverables/deliverable-api'
import { deliverableCategories, type Deliverable } from '@/features/deliverables/deliverable-model'
import { loadProposal } from '@/features/proposals/proposal-api'
import { loadReports } from '@/features/reports/report-api'
import type { Proposal } from '@/features/proposals/proposal-model'
import { listSchedules } from '@/features/schedules/schedule-api'
import { formatScheduleTime, scheduleState, upcomingSchedules, type Schedule } from '@/features/schedules/schedule-model'
import { listGpuApplications } from '@/features/gpu/gpu-api'
import { upcomingTeamApplications, type GpuApplication } from '@/features/gpu/gpu-model'

interface Membership { id: string; cohort_id: string; full_name: string; department: string; student_number: string; grade: string }
interface ProgramDetails { team: Team | null; members: TeamMember[]; deliverables: Deliverable[]; gpuApplications:GpuApplication[]; proposalStatus:Proposal['status']|null; reportCounts:{draft:number;submitted:number;reviewed:number}|null; error: string; deliverablesError: string; proposalError:string; reportsError:string; gpuError:string }
interface ScheduleDetails { items:Schedule[]; error:string }
export function StudentDashboard() {
  const { session } = useAuth()
  const userId = session?.user.id
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ revision: number; rows: Membership[]; names: Record<string, string>; details: Record<string, ProgramDetails>; schedules:Record<string,ScheduleDetails>; error: string } | null>(null)
  useEffect(() => {
    if (!supabase || !userId) return
    let active = true
    void Promise.all([
      supabase.from('AD_participants').select('id,cohort_id,full_name,department,student_number,grade').eq('profile_id', userId).eq('status', 'active'),
      supabase.from('AD_cohorts').select('id,name'),
    ]).then(async ([members, cohorts]) => {
      if (!active) return
      if (members.error || cohorts.error) { setResult({ revision, rows: [], names: {}, details: {}, schedules:{}, error: '참여 정보를 불러오지 못했습니다.' }); return }
      const rows=members.data as Membership[]
      const scheduleEntries=Promise.all(rows.map(async (row):Promise<[string,ScheduleDetails]>=>{
        try{return [row.id,{items:upcomingSchedules(await listSchedules(row.cohort_id)),error:''}]}
        catch{return [row.id,{items:[],error:'일정을 불러오지 못했습니다.'}]}
      }))
      const entries=await Promise.all(rows.map(async (row):Promise<[string,ProgramDetails]>=>{
        try {
          const workspace=await loadTeams(row.cohort_id)
          const team=workspace.teams.find(item=>workspace.roster.some(member=>member.team_id===item.id&&member.participant_id===row.id))??null
          if(!team)return [row.id,{team:null,members:[],deliverables:[],gpuApplications:[],proposalStatus:null,reportCounts:null,error:'',deliverablesError:'',proposalError:'',reportsError:'',gpuError:''}]
          const members=workspace.roster.filter(member=>member.team_id===team.id)
          const [proposal,reports,deliverables,gpu]=await Promise.allSettled([loadProposal(team.id),loadReports(team.id),loadDeliverables(team.id),listGpuApplications(row.cohort_id)])
          const reportItems=reports.status==='fulfilled'?reports.value.reports:null
          return [row.id,{team,members,proposalStatus:proposal.status==='fulfilled'?proposal.value.proposal?.status??null:null,reportCounts:reportItems?{draft:reportItems.filter(item=>item.status==='draft').length,submitted:reportItems.filter(item=>item.status==='submitted').length,reviewed:reportItems.filter(item=>item.status==='reviewed').length}:null,deliverables:deliverables.status==='fulfilled'?deliverables.value.items:[],gpuApplications:gpu.status==='fulfilled'?upcomingTeamApplications(gpu.value,team.id):[],error:'',proposalError:proposal.status==='rejected'?'기획서 현황을 불러오지 못했습니다.':'',reportsError:reports.status==='rejected'?'보고서 현황을 불러오지 못했습니다.':'',deliverablesError:deliverables.status==='rejected'?'산출물 현황을 불러오지 못했습니다.':'',gpuError:gpu.status==='rejected'?'GPU 예약을 불러오지 못했습니다.':''}]
        } catch(cause) { return [row.id,{team:null,members:[],deliverables:[],gpuApplications:[],proposalStatus:null,reportCounts:null,error:cause instanceof Error?cause.message:'팀 정보를 불러오지 못했습니다.',deliverablesError:'',proposalError:'',reportsError:'',gpuError:''}] }
      }))
      const schedules=Object.fromEntries(await scheduleEntries)
      if(active)setResult({ revision, rows, names: Object.fromEntries(cohorts.data.map(row => [row.id, row.name])), details: Object.fromEntries(entries), schedules, error: '' })
    }).catch(() => { if (active) setResult({ revision, rows: [], names: {}, details: {}, schedules:{}, error: '서버에 연결하지 못했습니다.' }) })
    return () => { active = false }
  }, [userId, revision])
  return <><div className="page-heading"><div><p className="eyebrow">MY PROGRAM</p><h1>나의 프로그램</h1><p className="muted">참여 프로그램의 팀·팀원·자료 제출 현황을 확인하세요.</p></div></div>
    <p><Link to="/schedules" className="text-link">프로그램 일정·제출 마감 확인 →</Link></p>
    {result?.revision !== revision ? <p role="status">참여 정보를 확인하고 있습니다.</p> : result.error ? <div role="alert" className="notice"><p>{result.error}</p><Button onClick={() => setRevision(value => value + 1)}>다시 시도</Button></div>
      : !result.rows.length ? <section className="panel empty-state"><h2>참여 중인 프로그램이 없습니다.</h2><p>참가 상태는 운영 담당자에게 문의해 주세요.</p></section>
        : <div className="membership-grid student-program-grid">{result.rows.map(row => {const details=result.details[row.id];const schedule=result.schedules[row.id];const team=details?.team;const recent=details?.deliverables.slice(0,3)??[];return <section className="panel student-program-card" key={row.id}><span className="badge status-active">참여 중</span><h2>{result.names[row.cohort_id] ?? '참여 프로그램'}</h2><p className="muted">{row.full_name} · {row.department} · {row.grade}학년 · 학번 {row.student_number}</p>
          <div className="student-program-section"><div className="section-heading"><h3>다가오는 일정·마감</h3><Link to={`/schedules?cohort=${row.cohort_id}`} className="text-link">전체 일정 →</Link></div>{schedule?.error?<p className="form-error" role="alert">{schedule.error}</p>:schedule?.items.length?<ul className="student-upcoming-schedules">{schedule.items.map(item=><li key={item.id}><span className="badge">{item.kind==='deadline'?'제출 마감':scheduleState(item)==='진행 중'?'진행 중':'예정'}</span><strong>{item.title}</strong><span>{formatScheduleTime(scheduleState(item)==='진행 중'?item.ends_at:item.starts_at)} (KST)</span></li>)}</ul>:<p className="muted">예정된 일정이 없습니다.</p>}</div>
          {details?.error?<div className="form-error" role="alert">{details.error} <Button className="button-secondary" onClick={()=>setRevision(value=>value+1)}>다시 시도</Button></div>:!team?<div className="student-program-section"><h3>소속 팀</h3><p className="muted">아직 팀에 배정되지 않았습니다.</p></div>:<>
            <div className="student-program-section"><div className="section-heading"><h3>소속 팀</h3><Link to={`/teams?cohort=${row.cohort_id}`} className="text-link">워크스페이스 →</Link></div><p className="student-team-name">{team.name}</p><p className="student-team-topic">주제 · {team.topic||'아직 등록되지 않았습니다.'}</p><h3>참여자 · {details.members.length}명</h3><ul className="student-team-members">{details.members.map(member=><li key={member.participant_id}><strong>{member.full_name}</strong><span className={member.is_leader?'badge status-active':'badge'}>{member.is_leader?'팀장':'팀원'}</span><span>{member.department} · 역할: {member.role_title||'미지정'}</span></li>)}</ul></div>
            <div className="student-program-section"><h3>팀 자료 현황</h3><div className="student-work-summary"><Link to={`/teams/${team.id}/proposal`}><strong>기획서</strong><span>{details.proposalError?'조회 실패':details.proposalStatus==='reviewed'?'검토 완료':details.proposalStatus==='submitted'?'제출':details.proposalStatus==='draft'?'작성 중':'미작성'}</span></Link><Link to={`/teams/${team.id}/reports`}><strong>보고서</strong><span>{details.reportsError?'조회 실패':details.reportCounts?`제출 ${details.reportCounts.submitted} · 검토 완료 ${details.reportCounts.reviewed} · 작성 중 ${details.reportCounts.draft}`:'—'}</span></Link><Link to={`/teams/${team.id}/deliverables`}><strong>산출물</strong><span>{details.deliverablesError?'조회 실패':`${details.deliverables.length}건 등록`}</span></Link></div></div>
            <div className="student-program-section"><div className="section-heading"><h3>우리 팀 GPU 예약</h3><Link to={`/gpu?cohort=${row.cohort_id}`} className="text-link">예약 현황 →</Link></div>{details.gpuError?<p className="form-error" role="alert">{details.gpuError}</p>:details.gpuApplications.length?<ul className="student-upcoming-schedules">{details.gpuApplications.map(item=><li key={item.application_id}><span className="badge">{[...new Set(item.segments.flatMap(segment=>segment.gpu_ids))].map(id=>`GPU_#${id}`).join(', ')}</span><strong>{item.purpose}</strong><span>{formatScheduleTime(item.starts_at)} ~ {formatScheduleTime(item.ends_at)} (KST)</span></li>)}</ul>:<p className="muted">다가오는 GPU 예약이 없습니다.</p>}</div>
            <div className="student-program-section"><div className="section-heading"><h3>산출물 제출 현황</h3><Link to={`/teams/${team.id}/deliverables`} className="text-link">전체 보기 →</Link></div>{details.deliverablesError?<p className="form-error" role="alert">{details.deliverablesError}</p>:<><p className="student-deliverable-count"><strong>{details.deliverables.length}</strong>건 제출</p>{recent.length?<ul className="student-recent-deliverables">{recent.map(item=><li key={item.id}><span className="badge">{deliverableCategories[item.category]}</span><span>{item.title}</span></li>)}</ul>:<p className="muted">제출한 산출물이 없습니다.</p>}</>}</div>
          </>}
        </section>})}</div>}
  </>
}
