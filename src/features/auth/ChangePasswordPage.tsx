import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { invokeFunction } from '@/lib/functions'
import { useAuth } from './auth-context'

export function ChangePasswordPage() {
  const { profile, refreshProfile, signOut } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  if (!profile?.must_change_password) return <Navigate to="/dashboard" replace />
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== confirm) { setMessage('비밀번호 확인이 일치하지 않습니다.'); return }
    setBusy(true); setMessage('')
    try {
      await invokeFunction('ad-change-password', { password })
      setPassword(''); setConfirm(''); refreshProfile()
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : '변경하지 못했습니다.') }
    finally { setBusy(false) }
  }
  return <section className="login-card"><p className="eyebrow">ACCOUNT SETUP</p><h1>비밀번호 변경</h1><p>프로그램을 시작하기 전에 임시 비밀번호를 본인만 아는 비밀번호로 바꿔 주세요.</p>
    <form className="login-form" onSubmit={submit}>
      <label htmlFor="new-password">새 비밀번호</label><input id="new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} required disabled={busy} />
      <p className="field-help">12자 이상, 영문 대·소문자, 숫자, 특수문자를 포함해 주세요. 동일 계정을 사용하는 다른 프로그램에서도 변경된 비밀번호를 사용합니다.</p>
      <label htmlFor="confirm-password">새 비밀번호 확인</label><input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} required disabled={busy} />
      <Button type="submit" disabled={busy}>{busy ? '변경 중…' : '비밀번호 변경하고 시작'}</Button>
    </form>{message && <p className="notice" role="alert">{message}</p>}
    <p><Button className="button-secondary" disabled={busy} onClick={() => { void signOut().catch(() => setMessage('로그아웃하지 못했습니다.')) }}>로그아웃</Button></p>
  </section>
}
