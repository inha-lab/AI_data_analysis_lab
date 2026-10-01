import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { CalendarDays, CircleUserRound, Cpu, FileStack, LayoutDashboard, Layers3, LogOut, Menu, Megaphone, ShieldCheck, UserRoundSearch, Users, UsersRound, X } from 'lucide-react'
import { isManager, useAuth, roleLabels } from '@/features/auth/auth-context'
import { Button } from '@/components/ui/button'

export function DashboardLayout() {
  const { profile, session, signOut } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    if (!menuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('keydown', closeOnEscape)
    document.body.classList.add('mobile-menu-open')
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.body.classList.remove('mobile-menu-open')
    }
  }, [menuOpen])
  async function logout() {
    setBusy(true); setError('')
    try { await signOut() }
    catch { setError('로그아웃하지 못했습니다. 다시 시도해 주세요.') }
    finally { setBusy(false) }
  }
  return <div className="workspace">
    <aside className={`workspace-sidebar${menuOpen ? ' is-open' : ''}`} id="workspace-navigation">
      <div className="workspace-sidebar-header"><Link to="/dashboard" className="workspace-brand" onClick={() => setMenuOpen(false)}>INHA<span>AI DATA ANALYSIS LAB</span></Link>
        <button className="mobile-menu-close" type="button" aria-label="메뉴 닫기" onClick={() => setMenuOpen(false)}><X size={24} aria-hidden="true" /></button>
      </div>
      <p className="nav-caption">프로그램 운영</p>
      <nav aria-label="관리 메뉴" onClick={event=>{const link=(event.target as HTMLElement).closest('a');if(!link)return;setMenuOpen(false);if(link.getAttribute('aria-current')==='page'){event.preventDefault();window.location.reload()}}}>
        <NavLink to="/dashboard"><LayoutDashboard size={18} aria-hidden="true" /> 대시보드</NavLink>
        {(isManager(profile?.role) || profile?.role === 'student') && <NavLink to="/announcements"><Megaphone size={18} aria-hidden="true" /> 공지사항</NavLink>}
        {(isManager(profile?.role) || profile?.role === 'student') && <NavLink to="/schedules"><CalendarDays size={18} aria-hidden="true" /> 프로그램 일정</NavLink>}
        {isManager(profile?.role) && <NavLink to="/cohorts"><Layers3 size={18} aria-hidden="true" /> 프로그램 관리</NavLink>}
        {(isManager(profile?.role) || profile?.role === 'student') && <NavLink to="/teams"><UsersRound size={18} aria-hidden="true" /> {isManager(profile.role) ? '팀 관리' : '워크스페이스'}</NavLink>}
        {isManager(profile?.role) && <><NavLink to="/participants"><Users size={18} aria-hidden="true" /> 참가자 관리</NavLink><NavLink to="/deliverables"><FileStack size={18} aria-hidden="true" /> 산출물 현황</NavLink></>}
        {(isManager(profile?.role) || profile?.role === 'student') && <NavLink to="/gpu"><Cpu size={18} aria-hidden="true" /> GPU 서버 사용 신청</NavLink>}
        {profile?.role === 'professor' && <NavLink to="/admins"><ShieldCheck size={18} aria-hidden="true" /> 관리자 관리</NavLink>}
        {isManager(profile?.role) && <NavLink to="/login-activity"><UserRoundSearch size={18} aria-hidden="true" /> 로그인 활동</NavLink>}
        <NavLink to="/my-page"><CircleUserRound size={18} aria-hidden="true" /> 마이페이지</NavLink>
      </nav>
      <div className="sidebar-note">공공데이터에서 시작하는<br />새로운 가능성.</div>
    </aside>
    {menuOpen && <button className="workspace-menu-backdrop" type="button" aria-label="메뉴 닫기" onClick={() => setMenuOpen(false)} />}
    <div className="workspace-body">
      <header className="workspace-topbar"><button className="mobile-menu-toggle" type="button" aria-label="메뉴 열기" aria-controls="workspace-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu size={24} aria-hidden="true" /></button>
        <div className="workspace-account"><span className="badge">{profile && roleLabels[profile.role]}</span><Link className="account-name" to="/my-page">{profile?.display_name || session?.user.email}</Link></div>
        <Button className="button-secondary" onClick={() => void logout()} disabled={busy}><LogOut size={16} aria-hidden="true" /> 로그아웃</Button>
      </header>
      {profile?.must_change_password && <div className="password-setup-banner" role="alert"><span>임시 비밀번호를 사용 중입니다. 등록·수정 작업 전에 새 비밀번호로 변경해 주세요.</span><Link className="button" to="/change-password">비밀번호 변경</Link></div>}
      {error && <p className="notice" role="alert">{error}</p>}
      <main className="workspace-content"><Outlet /></main>
    </div>
  </div>
}
