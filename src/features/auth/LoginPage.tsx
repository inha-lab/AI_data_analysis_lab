import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { useAuth } from './auth-context'

export function LoginPage() {
  const { session, profile, loading, error, refreshProfile, signOut } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  if (!loading && profile) {
    const requested = (location.state as { from?: string } | null)?.from
    const target = profile.role === 'professor' && requested === '/cohorts' ? requested : '/dashboard'
    return <Navigate to={target} replace />
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true); setMessage('')
    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      setPassword('')
      if (loginError) setMessage('로그인하지 못했습니다. 이메일과 비밀번호, 계정 상태를 확인해 주세요.')
    } catch { setMessage('로그인 서버에 연결하지 못했습니다.') }
    finally { setBusy(false) }
  }

  async function logout() {
    setBusy(true); setMessage('')
    try { await signOut() }
    catch { setMessage('로그아웃하지 못했습니다. 다시 시도해 주세요.') }
    finally { setBusy(false) }
  }

  return <section className="login-card"><p className="eyebrow">MEMBER ACCESS</p><h1>프로그램 로그인</h1>
    {!supabase ? <div className="notice">Supabase 연결 설정이 필요합니다.</div>
      : loading ? <p role="status">로그인 및 프로그램 권한을 확인하고 있습니다.</p>
      : session ? <><p>{session.user.email}</p><div className="button-row">
        <Button onClick={refreshProfile} disabled={busy}>권한 다시 확인</Button>
        <Button className="button-secondary" onClick={() => void logout()} disabled={busy}>로그아웃</Button>
      </div></> : <form className="login-form" onSubmit={login}>
        <p>등록된 계정의 이메일과 비밀번호를 입력해 주세요.</p>
        <label htmlFor="email">이메일</label><input id="email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required disabled={busy} />
        <label htmlFor="password">비밀번호</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required disabled={busy} />
        <Button type="submit" disabled={busy}>{busy ? '로그인 중…' : '로그인'}</Button>
      </form>}
    {(message || error) && <p className="notice" role="alert">{message || error}</p>}
    <p><Link to="/">← 프로그램 소개로 돌아가기</Link></p>
  </section>
}
