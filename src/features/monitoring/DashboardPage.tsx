import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { StudentDashboard } from './StudentDashboard'
import { isManager, useAuth, roleLabels } from '@/features/auth/auth-context'
import { useCohorts } from '@/features/cohorts/use-cohorts'
import { Button } from '@/components/ui/button'
import { ProgramMonitoringPanel } from './ProgramMonitoringPanel'
import { ParticipantCards } from './ParticipantCards'

function ProfessorDashboard() {
  const { cohorts, loading, error, reload } = useCohorts()
  const [selectedId,setSelectedId]=useState('')
  const selected=cohorts.find(item=>item.id===selectedId)??cohorts.find(item=>item.status==='active')??cohorts[0]
  const counts = [
    { label: '전체 프로그램', count: cohorts.length },
    { label: '운영 중', count: cohorts.filter(item => item.status === 'active').length },
    { label: '준비 중', count: cohorts.filter(item => item.status === 'draft').length },
    { label: '종료', count: cohorts.filter(item => item.status === 'completed').length },
  ]
  return <>
    <div className="page-heading"><div><p className="eyebrow">PROGRAM OVERVIEW</p><h1>프로그램 대시보드</h1><p className="muted">프로그램별 운영 현황을 확인하고 다음 프로그램을 준비하세요.</p></div><Link to="/cohorts?new=1" className="button">새 프로그램 만들기 <ArrowUpRight size={18} aria-hidden="true" /></Link></div>
    {error ? <div className="notice" role="alert"><p>{error}</p><Button onClick={reload}>다시 시도</Button></div> : <>
      <div className="stats-grid">{counts.map(item => <article className="stat-card" key={item.label}><p>{item.label}</p><strong>{loading ? '—' : item.count}</strong><span>프로그램</span></article>)}</div>
      <ParticipantCards />
      {selected&&<><div className="cohort-selector"><label htmlFor="monitor-cohort">프로그램 현황</label><select id="monitor-cohort" value={selected.id} onChange={event=>setSelectedId(event.target.value)}>{cohorts.map(cohort=><option key={cohort.id} value={cohort.id}>{cohort.name}</option>)}</select></div><ProgramMonitoringPanel key={selected.id} cohortId={selected.id} /></>}
    </>}
    <div className="notice"><h2>프로그램 운영</h2><p><Link to="/schedules" className="text-link">단계별 일정·제출 마감 관리 →</Link></p><p><Link to="/participants" className="text-link">프로그램별 참가자 관리로 이동 →</Link></p><p><Link to="/teams" className="text-link">팀 구성·프로젝트 정보 관리 →</Link></p><p><Link to="/deliverables" className="text-link">프로그램 산출물 현황 →</Link></p><p>파일 첨부와 평가 기능은 순차적으로 추가될 예정입니다.</p></div>
  </>
}
export function DashboardPage() {
  const { profile } = useAuth()
  if (isManager(profile?.role)) return <ProfessorDashboard />
  if (profile?.role === 'student') return <StudentDashboard />
  return <><div className="page-heading"><div><p className="eyebrow">MY PROGRAM</p><h1>{profile ? roleLabels[profile.role] : ''} 대시보드</h1></div></div><section className="panel empty-state"><h2>프로그램 참여가 확인되었습니다.</h2><p>소속 프로그램과 팀 연결 화면을 준비하고 있습니다.</p></section></>
}
