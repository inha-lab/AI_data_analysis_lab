import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/auth-context'

export function PublicLayout() {
  const { profile } = useAuth()
  return <div className="app-shell">
    <header className="site-header"><Link className="brand" to="/">INHA <span>AI DATA ANALYSIS LAB</span></Link><Link to={profile ? "/dashboard" : "/login"}>{profile ? "대시보드" : "로그인"}</Link></header>
    <main id="main-content"><Outlet /></main>
    <footer>인하대학교 · AI·공공데이터 기반 프로젝트</footer>
  </div>
}
