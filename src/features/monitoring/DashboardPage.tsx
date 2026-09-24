import { Link } from 'react-router-dom'
import { ArrowUpRight, CalendarDays, Layers3 } from 'lucide-react'
import { StudentDashboard } from './StudentDashboard'
import { useAuth, roleLabels } from '@/features/auth/auth-context'
import { useCohorts } from '@/features/cohorts/use-cohorts'
import { cohortPeriod, cohortStatusLabels } from '@/features/cohorts/cohort-model'
import { Button } from '@/components/ui/button'

function ProfessorDashboard() {
  const { cohorts, loading, error, reload } = useCohorts()
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
      <section className="panel"><div className="section-heading"><h2><CalendarDays size={20} aria-hidden="true" /> 최근 등록한 프로그램</h2><Link to="/cohorts" className="text-link">전체 보기 →</Link></div>
        {loading ? <p className="empty-state" role="status">운영 현황을 불러오고 있습니다.</p> : cohorts.length ? <div className="cohort-list">{cohorts.slice(0, 5).map(cohort => <article className="cohort-row" key={cohort.id}><div><span className={`badge status-${cohort.status}`}>{cohortStatusLabels[cohort.status]}</span><h3>{cohort.name}</h3><p className="muted">{cohortPeriod(cohort)}</p></div><Link to="/cohorts" className="text-link">관리 →</Link></article>)}</div>
          : <div className="empty-state"><Layers3 size={32} aria-hidden="true" /><h2>아직 등록된 프로그램이 없습니다.</h2><p>첫 프로그램을 만들고 운영 기간을 설정해 주세요.</p><Link to="/cohorts?new=1" className="button">첫 프로그램 만들기</Link></div>}
      </section>
    </>}
    <div className="notice"><h2>프로그램 운영</h2><p><Link to="/schedules" className="text-link">단계별 일정·제출 마감 관리 →</Link></p><p><Link to="/participants" className="text-link">프로그램별 참가자 관리로 이동 →</Link></p><p><Link to="/teams" className="text-link">팀 구성·프로젝트 정보 관리 →</Link></p><p>기획서·보고서·산출물 제출 기능은 순차적으로 추가될 예정입니다.</p></div>
  </>
}
export function DashboardPage() {
  const { profile } = useAuth()
  if (profile?.role === 'professor') return <ProfessorDashboard />
  if (profile?.role === 'student') return <StudentDashboard />
  return <><div className="page-heading"><div><p className="eyebrow">MY PROGRAM</p><h1>{profile ? roleLabels[profile.role] : ''} 대시보드</h1></div></div><section className="panel empty-state"><h2>프로그램 참여가 확인되었습니다.</h2><p>소속 프로그램과 팀 연결 화면을 준비하고 있습니다.</p></section></>
}
