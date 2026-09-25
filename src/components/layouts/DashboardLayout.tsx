import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { CalendarDays, Cpu, FileStack, LayoutDashboard, Layers3, LogOut, Megaphone, UserRoundSearch, Users, UsersRound } from 'lucide-react'
import { useAuth, roleLabels } from '@/features/auth/auth-context'
import { Button } from '@/components/ui/button'

export function DashboardLayout() {
  const { profile, session, signOut } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function logout() {
    setBusy(true); setError('')
    try { await signOut() }
    catch { setError('로그아웃하지 못했습니다. 다시 시도해 주세요.') }
    finally { setBusy(false) }
  }
  return <div className="workspace">
    <aside className="workspace-sidebar">
      <Link to="/dashboard" className="workspace-brand">INHA<span>AI DATA ANALYSIS LAB</span></Link>
      <p className="nav-caption">프로그램 운영</p>
      <nav aria-label="관리 메뉴">
        <NavLink to="/dashboard"><LayoutDashboard size={18} aria-hidden="true" /> 대시보드</NavLink>
        {(profile?.role === 'professor' || profile?.role === 'student') && <NavLink to="/schedules"><CalendarDays size={18} aria-hidden="true" /> 프로그램 일정</NavLink>}
        {(profile?.role === 'professor' || profile?.role === 'student') && <NavLink to="/announcements"><Megaphone size={18} aria-hidden="true" /> 공지사항</NavLink>}
        {(profile?.role === 'professor' || profile?.role === 'student') && <NavLink to="/gpu"><Cpu size={18} aria-hidden="true" /> GPU 서버 사용 신청</NavLink>}
        {(profile?.role === 'professor' || profile?.role === 'student') && <NavLink to="/teams"><UsersRound size={18} aria-hidden="true" /> {profile.role === 'professor' ? '팀 관리' : '워크스페이스'}</NavLink>}
        {profile?.role === 'professor' && <><NavLink to="/cohorts"><Layers3 size={18} aria-hidden="true" /> 프로그램 관리</NavLink><NavLink to="/participants"><Users size={18} aria-hidden="true" /> 참가자 관리</NavLink><NavLink to="/deliverables"><FileStack size={18} aria-hidden="true" /> 산출물 현황</NavLink><NavLink to="/login-activity"><UserRoundSearch size={18} aria-hidden="true" /> 로그인 활동</NavLink></>}
      </nav>
      <div className="sidebar-note">공공데이터에서 시작하는<br />새로운 가능성.</div>
    </aside>
    <div className="workspace-body">
      <header className="workspace-topbar"><div><span className="badge">{profile && roleLabels[profile.role]}</span><span className="account-name">{profile?.display_name || session?.user.email}</span></div>
        <Button className="button-secondary" onClick={() => void logout()} disabled={busy}><LogOut size={16} aria-hidden="true" /> 로그아웃</Button>
      </header>
      {error && <p className="notice" role="alert">{error}</p>}
      <main className="workspace-content"><Outlet /></main>
    </div>
  </div>
}
