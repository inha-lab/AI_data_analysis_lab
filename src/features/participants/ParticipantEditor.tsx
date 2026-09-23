import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { saveParticipant } from './participant-api'
import { jobGroups, type Participant, type ParticipantInput } from './participant-model'

export function ParticipantEditor({ cohortId, participant, onSaved, onCancel }: {
  cohortId: string; participant?: Participant; onSaved: (value: Participant) => void; onCancel: () => void
}) {
  const [values, setValues] = useState<ParticipantInput>({
    full_name: participant?.full_name ?? '', email: participant?.email ?? '',
    department: participant?.department ?? '', student_number: participant?.student_number ?? '',
    grade: participant?.grade ?? '', phone: participant?.phone ?? '',
    job_group: participant?.job_group ?? 'sw_development', status: participant?.status ?? 'active',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  function change(field: keyof ParticipantInput, value: string) { setValues(current => ({ ...current, [field]: value })) }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    try { onSaved(await saveParticipant(cohortId, values, participant)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '저장하지 못했습니다.') }
    finally { setBusy(false) }
  }
  return <section className="panel editor-panel" aria-labelledby="participant-editor-title">
    <h2 id="participant-editor-title">{participant ? '참가자 정보 수정' : '참가자 등록'}</h2>
    <p className="muted">선택한 기수의 참가 정보를 입력해 주세요.</p>
    <form className="cohort-form" onSubmit={submit}><fieldset disabled={busy}>
      <label htmlFor="participant-name">이름 *</label><input id="participant-name" value={values.full_name} onChange={event => change('full_name', event.target.value)} maxLength={80} required autoFocus />
      <label htmlFor="participant-email">이메일 *</label><input id="participant-email" type="email" readOnly={Boolean(participant?.profile_id)} value={values.email} onChange={event => change('email', event.target.value)} maxLength={254} required />
      <div className="date-fields"><div><label htmlFor="participant-department">학과 *</label><input id="participant-department" value={values.department} onChange={event => change('department', event.target.value)} maxLength={100} required /></div>
        <div><label htmlFor="participant-grade">학년 *</label><input id="participant-grade" value={values.grade} onChange={event => change('grade', event.target.value)} maxLength={30} placeholder="예: 3학년" required /></div></div>
      <label htmlFor="participant-number">학번 *</label><input id="participant-number" type="text" value={values.student_number} onChange={event => change('student_number', event.target.value)} maxLength={40} required />
      <label htmlFor="participant-phone">전화번호 *</label><input id="participant-phone" type="tel" value={values.phone} onChange={event => change('phone', event.target.value)} maxLength={30} required />
      <label htmlFor="participant-job">희망 직무 *</label><select id="participant-job" value={values.job_group} onChange={event => change('job_group', event.target.value)}>{Object.entries(jobGroups).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <label htmlFor="participant-status">참여 상태</label><select id="participant-status" value={values.status} onChange={event => change('status', event.target.value)}><option value="active">참여 중</option><option value="inactive">비활성</option></select>
      <p className="field-help">비활성화는 이 기수의 참가 정보에만 적용됩니다. 기존 로그인 계정은 삭제하지 않습니다.</p>
      {!participant?.profile_id && <p className="field-help">참가 정보를 저장한 뒤 목록의 로그인 계정 연결에서 계정을 생성·연결하세요.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="button-row"><Button type="submit">{busy ? '저장 중…' : participant ? '변경 저장' : '참가자 등록'}</Button><Button className="button-secondary" onClick={onCancel}>취소</Button></div>
    </fieldset></form>
  </section>
}
