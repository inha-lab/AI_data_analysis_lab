import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { saveCohort } from './cohort-api'
import { cohortStatusLabels, type Cohort, type CohortStatus } from './cohort-model'

export function CohortEditor({ cohort, onSaved, onCancel }: { cohort?: Cohort; onSaved: (value: Cohort) => void; onCancel: () => void }) {
  const [name, setName] = useState(cohort?.name ?? '')
  const [description, setDescription] = useState(cohort?.description ?? '')
  const [startsOn, setStartsOn] = useState(cohort?.starts_on ?? '')
  const [endsOn, setEndsOn] = useState(cohort?.ends_on ?? '')
  const [status, setStatus] = useState<CohortStatus>(cohort?.status ?? 'draft')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const saved = await saveCohort({ name, description, starts_on: startsOn || null, ends_on: endsOn || null, status }, cohort)
      onSaved(saved)
    } catch (cause) { setError(cause instanceof Error ? cause.message : '저장하지 못했습니다.') }
    finally { setBusy(false) }
  }
  return <section className="panel editor-panel" aria-labelledby="editor-title">
    <h2 id="editor-title">{cohort ? '프로그램 정보 수정' : '새 프로그램 만들기'}</h2>
    <p className="muted">프로그램별 운영 기간과 상태를 설정해 주세요.</p>
    <form onSubmit={submit} className="cohort-form"><fieldset disabled={busy}>
      <label htmlFor="cohort-name">프로그램명 <span aria-hidden="true">*</span></label>
      <input id="cohort-name" value={name} onChange={event => setName(event.target.value)} maxLength={80} placeholder="예: AI_DATA_LAB_1기" required autoFocus />
      <div className="date-fields"><div><label htmlFor="starts-on">시작일</label><input id="starts-on" type="date" value={startsOn} onChange={event => setStartsOn(event.target.value)} required={Boolean(endsOn)} /></div>
        <div><label htmlFor="ends-on">종료일</label><input id="ends-on" type="date" value={endsOn} onChange={event => setEndsOn(event.target.value)} min={startsOn || undefined} required={Boolean(startsOn)} /></div></div>
      <p className="field-help">일정이 미정이면 두 날짜를 모두 비워 두세요.</p>
      <label htmlFor="cohort-status">운영 상태</label><select id="cohort-status" value={status} onChange={event => setStatus(event.target.value as CohortStatus)}>
        {Object.entries(cohortStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <label htmlFor="cohort-description">프로그램 소개</label><textarea id="cohort-description" rows={4} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} placeholder="운영 목적이나 안내사항을 입력하세요." />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="button-row"><Button type="submit">{busy ? '저장 중…' : cohort ? '변경 저장' : '프로그램 생성'}</Button><Button className="button-secondary" onClick={onCancel}>취소</Button></div>
    </fieldset></form>
  </section>
}
