import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './auth-context'
import type { UserRole } from '@/types/domain'

export function RequireAuth({ roles }: { roles?: UserRole[] }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="route-loading" role="status">프로그램 접근 권한을 확인하고 있습니다.</div>
  if (!session || !profile) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (roles && !roles.includes(profile.role)) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
