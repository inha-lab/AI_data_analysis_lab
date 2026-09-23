import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AuthContext, roleLabels, type Profile } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(Boolean(supabase))
  const [authError, setAuthError] = useState('')
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ userId: string; revision: number; profile: Profile | null; error: string } | null>(null)
  const userId = session?.user.id
  const currentResult = result?.userId === userId && result?.revision === revision ? result : null

  useEffect(() => {
    if (!supabase) return
    let active = true
    let eventReceived = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      eventReceived = true
      if (!active) return
      setSession(next)
      setInitializing(false)
      setAuthError('')
      if (!next) setResult(null)
    })
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || eventReceived) return
      setSession(data.session)
      setInitializing(false)
      if (error) setAuthError('로그인 상태를 확인하지 못했습니다. 다시 로그인해 주세요.')
    }).catch(() => {
      if (active && !eventReceived) { setInitializing(false); setAuthError('인증 서버에 연결하지 못했습니다.') }
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!userId || !supabase) return
    let active = true
    void Promise.resolve(supabase.from('AD_profiles').select('id, display_name, role, is_active, must_change_password')
      .eq('id', userId).maybeSingle()).then(({ data, error }) => {
        if (!active) return
        const message = error ? '프로그램 권한을 확인하지 못했습니다. 다시 시도해 주세요.'
          : !data || !data.is_active || !Object.hasOwn(roleLabels, data.role)
            ? '이 프로그램에 등록된 활성 계정이 아닙니다. 관리자에게 문의해 주세요.' : ''
        setResult({ userId, revision, profile: message ? null : data as Profile, error: message })
      }).catch(() => {
        if (active) setResult({ userId, revision, profile: null, error: '데이터베이스에 연결하지 못했습니다.' })
      })
    return () => { active = false }
  }, [userId, revision])

  async function signOut() {
    if (!supabase) return
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) throw error
    setSession(null)
    setResult(null)
  }

  return <AuthContext.Provider value={{ session, profile: currentResult?.profile ?? null,
    loading: initializing || Boolean(userId && !currentResult),
    error: authError || currentResult?.error || '',
    refreshProfile: () => setRevision(value => value + 1), signOut,
  }}>{children}</AuthContext.Provider>
}
