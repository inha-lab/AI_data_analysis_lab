import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { invokeFunction } from '@/lib/functions'
import { saveParticipant } from './participant-api'
import { genderLabels, jobGroups, participantStatusLabels, type Participant, type ParticipantInput } from './participant-model'

export function ParticipantEditor({ cohortId, participant, onSaved, onCancel }: {
  cohortId: string; participant?: Participant; onSaved: (value: Participant) => void; onCancel: () => void
}) {
  const [values, setValues] = useState<ParticipantInput>({
    full_name: participant?.full_name ?? '', email: participant?.email ?? '',
    department: participant?.department ?? '', student_number: participant?.student_number ?? '',
    grade: participant?.grade ?? '', gender: participant?.gender ?? 'unspecified', phone: participant?.phone ?? '',
    job_group: participant?.job_group ?? 'unspecified', job_group_other: participant?.job_group_other ?? '', status: participant?.status ?? 'active',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [credential, setCredential] = useState('')
  function change(field: keyof ParticipantInput, value: string) { setValues(current => ({ ...current, [field]: value })) }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    try { onSaved(await saveParticipant(cohortId, values, participant)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '저장하지 못했습니다.') }
    finally { setBusy(false) }
  }
  async function registerTemporaryPassword() {
    if (!participant?.profile_id || participant.status !== 'active') return
    if (values.phone !== participant.phone) { setError('변경한 연락처를 먼저 저장한 뒤 비밀번호를 등록해 주세요.'); return }
    if (!window.confirm(`${participant.full_name} 참가자의 비밀번호를 연락처 뒤 8자리로 등록할까요? 다음 로그인에서 비밀번호를 변경해야 합니다.`)) return
    setBusy(true); setError(''); setCredential('')
    try {
      const result = await invokeFunction<{ temporaryPassword: string }>('ad-provision-account', { participantId: participant.id, action: 'reset_temporary' })
      setCredential(result.temporaryPassword)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '임시 비밀번호를 등록하지 못했습니다.') }
    finally { setBusy(false) }
  }
  return <section className="panel editor-panel" aria-labelledby="participant-editor-title">
    <h2 id="participant-editor-title">{participant ? '참가자 정보 수정' : '참가자 등록'}</h2>
    <p className="muted">선택한 프로그램의 참가 정보를 입력해 주세요.</p>
    <form className="cohort-form" onSubmit={submit}><fieldset disabled={busy}>
      <label htmlFor="participant-name">이름 *</label><input id="participant-name" value={values.full_name} onChange={event => change('full_name', event.target.value)} maxLength={80} required autoFocus />
      <label htmlFor="participant-email">이메일 *</label><input id="participant-email" type="email" readOnly={Boolean(participant?.profile_id)} value={values.email} onChange={event => change('email', event.target.value)} maxLength={254} required />
      <div className="date-fields"><div><label htmlFor="participant-department">학과 *</label><input id="participant-department" value={values.department} onChange={event => change('department', event.target.value)} maxLength={100} required /></div>
        <div><label htmlFor="participant-grade">학년 *</label><input id="participant-grade" value={values.grade} onChange={event => change('grade', event.target.value)} maxLength={30} placeholder="예: 3학년" required /></div></div>
      <label htmlFor="participant-gender">성별</label><select id="participant-gender" value={values.gender} onChange={event => change('gender', event.target.value)}>{Object.entries(genderLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
      <label htmlFor="participant-number">학번 *</label><input id="participant-number" type="text" value={values.student_number} onChange={event => change('student_number', event.target.value)} maxLength={40} required />
      <label htmlFor="participant-phone">연락처 *</label><input id="participant-phone" type="tel" value={values.phone} onChange={event => change('phone', event.target.value)} maxLength={30} required />
      <label htmlFor="participant-job">희망 직무</label><select id="participant-job" value={values.job_group} onChange={event => change('job_group', event.target.value)}>{Object.entries(jobGroups).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      {values.job_group === 'other' && <><label htmlFor="participant-job-other">기타 희망 직무</label><input id="participant-job-other" value={values.job_group_other ?? ''} onChange={event => change('job_group_other', event.target.value)} maxLength={80} required /></>}
      <label htmlFor="participant-status">참여 상태</label><select id="participant-status" value={values.status} onChange={event => change('status', event.target.value)}>{Object.entries(participantStatusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
      <p className="field-help">수료·중탈·비활성은 이 프로그램의 참가 상태만 변경합니다. 기존 로그인 계정은 삭제하지 않으며 해당 프로그램의 팀·일정 접근은 중단됩니다.</p>
      {!participant?.profile_id && <p className="field-help">참가 정보를 저장한 뒤 목록의 로그인 계정 연결에서 계정을 생성·연결하세요.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="button-row"><Button type="submit">{busy ? '저장 중…' : participant ? '변경 저장' : '참가자 등록'}</Button><Button className="button-secondary" onClick={onCancel}>취소</Button></div>
    </fieldset></form>
    {participant?.profile_id && <div className="participant-password-action"><div><strong>로그인 비밀번호</strong><p className="field-help">저장된 연락처에서 010을 제외한 8자리로 비밀번호를 초기화하고 다음 로그인에서 변경을 요구합니다.</p></div><Button className="button-secondary" disabled={busy || participant.status !== 'active'} onClick={() => void registerTemporaryPassword()}>비밀번호 초기화</Button></div>}
    {credential && <p className="success-message" role="status">비밀번호 초기화 완료: <code>{credential}</code></p>}
  </section>
}
