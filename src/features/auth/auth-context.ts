import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { UserRole } from '@/types/domain'

export interface Profile { id: string; display_name: string | null; role: UserRole; is_active: boolean; must_change_password: boolean }
export const roleLabels: Record<UserRole, string> = {
  professor: '교수 · 관리자', consultant: '컨설턴트', researcher: '연구원', student: '학생',
}
export interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  error: string
  refreshProfile: () => void
  signOut: () => Promise<void>
}
export const AuthContext = createContext<AuthState | null>(null)
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthProvider is required')
  return context
}
