import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import type { UserRole } from '@/types/domain'

type Profile = { id: string; display_name: string | null; role: UserRole; is_active: boolean }
const roles: Record<UserRole, string> = {
  professor: '교수 · 관리자', consultant: '컨설턴트', researcher: '연구원', student: '학생',
}

export function LoginPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [profileResult, setProfileResult] = useState<{ userId: string; profile: Profile | null; error: string } | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const userId = session?.user.id
  const profile = profileResult?.userId === userId ? profileResult?.profile : null
  const profileLoading = Boolean(userId && profileResult?.userId !== userId)
  const profileError = profileResult?.userId === userId ? profileResult?.error : ''

  useEffect(() => {
    if (!supabase) return
    let active = true
    let eventReceived = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      eventReceived = true
      if (active) { setSession(next); setInitializing(false) }
    })
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active || eventReceived) return
      setSession(data.session)
      setInitializing(false)
      if (error) setMessage('로그인 상태를 확인하지 못했습니다. 다시 시도해 주세요.')
    }).catch(() => {
      if (active && !eventReceived) { setInitializing(false); setMessage('인증 서버에 연결하지 못했습니다.') }
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!userId || !supabase) return
    let active = true
    void Promise.resolve(supabase.from('AD_profiles').select('id, display_name, role, is_active')
      .eq('id', userId).maybeSingle()).then(({ data, error }) => {
        if (!active) return
        let errorMessage = ''
        if (error) {
          errorMessage = error.code === 'PGRST205'
            ? '앱 전용 데이터베이스 초기 설정이 필요합니다. 관리자에게 문의해 주세요.'
            : '앱 권한 정보를 조회하지 못했습니다. 다시 로그인해 주세요.'
        } else if (!data || !data.is_active || !Object.hasOwn(roles, data.role)) {
          errorMessage = '이 프로그램에 등록된 활성 계정이 아닙니다. 관리자에게 문의해 주세요.'
        }
        setProfileResult({ userId, profile: errorMessage ? null : data as Profile, error: errorMessage })
      }).catch(() => {
        if (active) setProfileResult({ userId, profile: null, error: '데이터베이스에 연결하지 못했습니다.' })
      })
    return () => { active = false }
  }, [userId])

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMessage('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      setPassword('')
      if (error) setMessage('로그인하지 못했습니다. 이메일과 비밀번호, 계정 상태를 확인해 주세요.')
    } catch { setMessage('로그인 서버에 연결하지 못했습니다.') }
    finally { setBusy(false) }
  }

  async function logout() {
    if (!supabase) return
    setBusy(true)
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) setMessage('로그아웃하지 못했습니다. 다시 시도해 주세요.')
      else { setProfileResult(null); setSession(null); setMessage('') }
    } catch { setMessage('로그아웃 처리 중 오류가 발생했습니다.') }
    finally { setBusy(false) }
  }

  return <section className="login-card">
    <p className="eyebrow">MEMBER ACCESS</p><h1>프로그램 로그인</h1>
    {!supabase ? <div className="notice">Supabase 연결 설정이 필요합니다.</div>
      : initializing ? <p role="status">로그인 상태를 확인하고 있습니다.</p>
      : session ? <>
        <p>{session.user.email}</p>
        {profileLoading && <p role="status">프로그램 참여 권한을 확인하고 있습니다.</p>}
        {profile && profile.id === userId && <div className="notice"><h2>{roles[profile.role]}</h2>
          <p>{profile.display_name || session.user.email} 님, 로그인되었습니다.</p>
          <p>프로그램 계정 연결이 완료되었습니다. 업무 화면은 준비 중입니다.</p></div>}
        <Button onClick={() => void logout()} disabled={busy}>로그아웃</Button>
      </> : <form className="login-form" onSubmit={login}>
        <p>등록된 계정의 이메일과 비밀번호를 입력해 주세요.</p>
        <label htmlFor="email">이메일</label>
        <input id="email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required disabled={busy} />
        <label htmlFor="password">비밀번호</label>
        <input id="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required disabled={busy} />
        <Button type="submit" disabled={busy}>{busy ? '로그인 중…' : '로그인'}</Button>
      </form>}
    {(message || profileError) && <p className="notice" role="alert">{message || profileError}</p>}
    <p><Link to="/">← 프로그램 소개로 돌아가기</Link></p>
  </section>
}
