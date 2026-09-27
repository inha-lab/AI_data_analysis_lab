import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { roleLabels, useAuth } from '@/features/auth/auth-context'
import { updateMyProfile } from './account-api'

export function MyPage() {
  const { profile, session, refreshProfile } = useAuth()
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try { await updateMyProfile({ displayName, phone }); refreshProfile(); setNotice('개인정보를 저장했습니다.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : '저장하지 못했습니다.') }
    finally { setBusy(false) }
  }
  return <><div className="page-heading"><div><p className="eyebrow">MY PAGE</p><h1>마이페이지</h1><p className="muted">내 계정 정보와 연락처를 확인하고 수정합니다.</p></div></div>
    <section className="panel account-settings"><div className="account-summary"><div><span className="badge">{profile && roleLabels[profile.role]}</span><h2>{profile?.display_name || '사용자'}</h2><p>{session?.user.email}</p></div></div>
      <form className="cohort-form" onSubmit={submit}><fieldset disabled={busy}>
        <label htmlFor="my-email">이메일</label><input id="my-email" type="email" value={session?.user.email ?? ''} readOnly aria-describedby="email-help" /><p id="email-help" className="field-help">로그인 이메일은 변경할 수 없습니다.</p>
        <label htmlFor="my-role">역할</label><input id="my-role" value={profile ? roleLabels[profile.role] : ''} readOnly />
        <label htmlFor="my-name">이름 *</label><input id="my-name" value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={80} required />
        <label htmlFor="my-phone">전화번호 *</label><input id="my-phone" type="tel" value={phone} onChange={event => setPhone(event.target.value)} maxLength={30} required />
        {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="success-message" role="status">{notice}</p>}
        <div className="button-row"><Button type="submit" disabled={busy}>{busy ? '저장 중…' : '개인정보 저장'}</Button></div>
      </fieldset></form></section></>
}
