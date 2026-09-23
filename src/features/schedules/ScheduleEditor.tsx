import { useEffect, useState, type FormEvent } from 'react'
import { useBlocker } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { saveSchedule } from './schedule-api'
import { fromKstInput, toKstInput, stageLabels, type Schedule, type Stage } from './schedule-model'

export function ScheduleEditor({ cohortId, schedule, onSaved, onCancel }: { cohortId: string; schedule?: Schedule; onSaved: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState(schedule?.title ?? '')
  const [description, setDescription] = useState(schedule?.description ?? '')
  const [stage, setStage] = useState<Stage>(schedule?.stage ?? 'planning')
  const [kind, setKind] = useState<'event' | 'deadline'>(schedule?.kind ?? 'event')
  const [start, setStart] = useState(schedule ? toKstInput(schedule.starts_at) : '')
  const [end, setEnd] = useState(schedule ? toKstInput(schedule.ends_at) : '')
  const [isPublic, setPublic] = useState(schedule?.is_public ?? false)
  const [cancelled, setCancelled] = useState(schedule?.is_cancelled ?? false)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const blocker = useBlocker(dirty || busy)
  useEffect(() => {
    if (!dirty && !busy) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty, busy])
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      await saveSchedule(cohortId, { title, description, stage, kind, starts_at: fromKstInput(start), ends_at: fromKstInput(kind === 'deadline' ? start : end), is_public: isPublic, is_cancelled: cancelled }, schedule)
      onSaved()
    } catch (cause) { setError(cause instanceof Error ? cause.message : '저장하지 못했습니다.') }
    finally { setBusy(false) }
  }
  return <section className="panel editor-panel"><h2>{schedule ? '일정 수정' : '새 일정 등록'}</h2><p className="muted">모든 일시는 한국 시간(KST) 기준입니다.</p>
    <form className="cohort-form" onSubmit={submit} onChange={() => setDirty(true)}><fieldset disabled={busy}>
      <label htmlFor="schedule-title">제목</label><input id="schedule-title" required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      <label htmlFor="schedule-stage">프로젝트 단계</label><select id="schedule-stage" value={stage} onChange={e => setStage(e.target.value as Stage)}>{Object.entries(stageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <label htmlFor="schedule-kind">일정 종류</label><select id="schedule-kind" value={kind} onChange={e => setKind(e.target.value as 'event' | 'deadline')}><option value="event">진행 일정</option><option value="deadline">제출 마감</option></select>
      <label htmlFor="schedule-start">{kind === 'deadline' ? '마감 일시' : '시작 일시'}</label><input id="schedule-start" type="datetime-local" required value={start} onChange={e => setStart(e.target.value)} />
      {kind === 'event' && <><label htmlFor="schedule-end">종료 일시</label><input id="schedule-end" type="datetime-local" required min={start || undefined} value={end} onChange={e => setEnd(e.target.value)} /></>}
      <label htmlFor="schedule-description">설명</label><textarea id="schedule-description" rows={4} maxLength={4000} value={description} onChange={e => setDescription(e.target.value)} />
      <label htmlFor="schedule-public">공개 범위</label><select id="schedule-public" value={String(isPublic)} onChange={e => setPublic(e.target.value === 'true')}><option value="false">참여 학생과 교수</option><option value="true">전체 공개 (로그인 전 홈 포함)</option></select>
      <p className="field-help">전체 공개 시 프로그램명, 일정 제목·설명·일시가 누구에게나 표시됩니다.</p>
      {schedule && <><label htmlFor="schedule-cancelled">운영 여부</label><select id="schedule-cancelled" value={String(cancelled)} onChange={e => setCancelled(e.target.value === 'true')}><option value="false">정상 진행</option><option value="true">취소</option></select></>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="button-row"><Button type="submit">{busy ? '저장 중…' : '일정 저장'}</Button><Button className="button-secondary" onClick={() => { if (!dirty || window.confirm('작성 중인 내용을 저장하지 않고 닫을까요?')) onCancel() }}>닫기</Button></div>
    </fieldset></form>
    {blocker.state === 'blocked' && <div className="notice" role="alert"><p>{busy ? '저장이 끝난 후 이동해 주세요.' : '작성 중인 내용을 저장하지 않고 이동할까요?'}</p><div className="button-row"><Button disabled={busy} onClick={() => blocker.proceed()}>이동</Button><Button className="button-secondary" onClick={() => blocker.reset()}>계속 작성</Button></div></div>}
  </section>
}
