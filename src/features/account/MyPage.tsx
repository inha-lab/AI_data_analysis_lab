import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { roleLabels, useAuth } from '@/features/auth/auth-context'
import { changeMyPassword, getMyAcademicProfile, updateMyProfile } from './account-api'
import { jobGroups } from '@/features/participants/participant-model'

export function MyPage() {
  const { profile, session, refreshProfile } = useAuth()
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [academic, setAcademic] = useState({ department: '', grade: '', job_group: 'unspecified' as keyof typeof jobGroups, job_group_other: '' })
  const [academicLoading, setAcademicLoading] = useState(profile?.role === 'student')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  useEffect(() => { if (profile?.role === 'student') void getMyAcademicProfile().then(value => { if (value) setAcademic({ ...value, job_group_other: value.job_group_other ?? '' }) }).catch(() => setError('학적 정보를 불러오지 못했습니다.')).finally(() => setAcademicLoading(false)) }, [profile?.role])
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try { await updateMyProfile({ displayName, phone, ...(profile?.role === 'student' ? academic : {}) }); refreshProfile(); setNotice('개인정보를 저장했습니다.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : '저장하지 못했습니다.') }
    finally { setBusy(false) }
  }
  async function submitPassword(event: FormEvent) {
    event.preventDefault(); setPasswordMessage('')
    if (newPassword.length < 8 || newPassword.length > 128) { setPasswordMessage('비밀번호는 8~128자로 입력해 주세요.'); return }
    if (newPassword !== passwordConfirm) { setPasswordMessage('비밀번호 확인이 일치하지 않습니다.'); return }
    setPasswordBusy(true)
    try { await changeMyPassword(newPassword); setNewPassword(''); setPasswordConfirm(''); setPasswordMessage('비밀번호를 변경했습니다.') }
    catch (cause) { setPasswordMessage(cause instanceof Error ? cause.message : '비밀번호를 변경하지 못했습니다.') }
    finally { setPasswordBusy(false) }
  }
  return <><div className="page-heading"><div><p className="eyebrow">MY PAGE</p><h1>마이페이지</h1><p className="muted">내 계정 정보와 연락처를 확인하고 수정합니다.</p></div></div>
    <section className="panel account-settings"><div className="account-summary"><div><span className="badge">{profile && roleLabels[profile.role]}</span><h2>{profile?.display_name || '사용자'}</h2><p>{session?.user.email}</p></div></div>
      <form className="cohort-form" onSubmit={submit}><fieldset disabled={busy}>
        <label htmlFor="my-email">이메일</label><input id="my-email" type="email" value={session?.user.email ?? ''} readOnly aria-describedby="email-help" /><p id="email-help" className="field-help">로그인 이메일은 변경할 수 없습니다.</p>
        <label htmlFor="my-role">역할</label><input id="my-role" value={profile ? roleLabels[profile.role] : ''} readOnly />
        <label htmlFor="my-name">이름 *</label><input id="my-name" value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={80} required />
        <label htmlFor="my-phone">연락처 *</label><input id="my-phone" type="tel" value={phone} onChange={event => setPhone(event.target.value)} maxLength={30} required />
        {profile?.role === 'student' && <><label htmlFor="my-department">학과 *</label><input id="my-department" value={academic.department} onChange={event => setAcademic(current => ({ ...current, department: event.target.value }))} maxLength={100} required />
          <label htmlFor="my-grade">학년 *</label><input id="my-grade" value={academic.grade} onChange={event => setAcademic(current => ({ ...current, grade: event.target.value }))} maxLength={30} required />
          <label htmlFor="my-job">희망 직무</label><select id="my-job" value={academic.job_group} onChange={event => setAcademic(current => ({ ...current, job_group: event.target.value as keyof typeof jobGroups }))}>{Object.entries(jobGroups).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          {academic.job_group === 'other' && <><label htmlFor="my-job-other">기타 희망 직무</label><input id="my-job-other" value={academic.job_group_other} onChange={event => setAcademic(current => ({ ...current, job_group_other: event.target.value }))} maxLength={80} required /></>}</>}
        {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="success-message" role="status">{notice}</p>}
        <div className="button-row"><Button type="submit" disabled={busy || academicLoading}>{busy ? '저장 중…' : academicLoading ? '정보 확인 중…' : '개인정보 저장'}</Button></div>
      </fieldset></form></section>
    {profile?.role === 'student' && <section className="panel account-settings"><h2>비밀번호 변경</h2><p className="muted">현재 로그인 계정의 비밀번호를 변경합니다.</p><form className="cohort-form" onSubmit={submitPassword}><fieldset disabled={passwordBusy}>
      <label htmlFor="my-new-password">새 비밀번호</label><input id="my-new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={newPassword} onChange={event=>setNewPassword(event.target.value)} required />
      <p className="field-help">8자 이상 입력해 주세요. 대문자와 특수문자는 필수가 아닙니다.</p>
      <label htmlFor="my-password-confirm">새 비밀번호 확인</label><input id="my-password-confirm" type="password" autoComplete="new-password" minLength={8} maxLength={128} value={passwordConfirm} onChange={event=>setPasswordConfirm(event.target.value)} required />
      {passwordMessage && <p className={passwordMessage.includes('변경했습니다')?'success-message':'form-error'} role="status">{passwordMessage}</p>}
      <div className="button-row"><Button type="submit" disabled={passwordBusy}>{passwordBusy?'변경 중…':'비밀번호 변경'}</Button></div>
    </fieldset></form></section>}</>
}
