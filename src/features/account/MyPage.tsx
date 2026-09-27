import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { roleLabels, useAuth } from '@/features/auth/auth-context'
import { getMyAcademicProfile, updateMyProfile } from './account-api'
import { jobGroups } from '@/features/participants/participant-model'

export function MyPage() {
  const { profile, session, refreshProfile } = useAuth()
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [academic, setAcademic] = useState({ department: '', grade: '', job_group: 'sw_development' as keyof typeof jobGroups, job_group_other: '' })
  const [academicLoading, setAcademicLoading] = useState(profile?.role === 'student')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => { if (profile?.role === 'student') void getMyAcademicProfile().then(value => { if (value) setAcademic({ ...value, job_group_other: value.job_group_other ?? '' }) }).catch(() => setError('학적 정보를 불러오지 못했습니다.')).finally(() => setAcademicLoading(false)) }, [profile?.role])
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try { await updateMyProfile({ displayName, phone, ...(profile?.role === 'student' ? academic : {}) }); refreshProfile(); setNotice('개인정보를 저장했습니다.') }
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
        {profile?.role === 'student' && <><label htmlFor="my-department">학과 *</label><input id="my-department" value={academic.department} onChange={event => setAcademic(current => ({ ...current, department: event.target.value }))} maxLength={100} required />
          <label htmlFor="my-grade">학년 *</label><input id="my-grade" value={academic.grade} onChange={event => setAcademic(current => ({ ...current, grade: event.target.value }))} maxLength={30} required />
          <label htmlFor="my-job">희망 직무 *</label><select id="my-job" value={academic.job_group} onChange={event => setAcademic(current => ({ ...current, job_group: event.target.value as keyof typeof jobGroups }))}>{Object.entries(jobGroups).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          {academic.job_group === 'other' && <><label htmlFor="my-job-other">기타 희망 직무 *</label><input id="my-job-other" value={academic.job_group_other} onChange={event => setAcademic(current => ({ ...current, job_group_other: event.target.value }))} maxLength={80} required /></>}</>}
        {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="success-message" role="status">{notice}</p>}
        <div className="button-row"><Button type="submit" disabled={busy || academicLoading}>{busy ? '저장 중…' : academicLoading ? '정보 확인 중…' : '개인정보 저장'}</Button></div>
      </fieldset></form></section></>
}
