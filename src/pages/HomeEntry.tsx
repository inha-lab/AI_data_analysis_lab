import { Navigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/auth-context'
import { HomePage } from './HomePage'

export function HomeEntry() {
  const { profile, loading } = useAuth()
  if (loading) return <p className="route-loading" role="status">로그인 상태를 확인하고 있습니다.</p>
  return profile ? <Navigate to="/dashboard" replace /> : <HomePage />
}
