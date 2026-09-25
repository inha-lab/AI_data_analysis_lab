import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, RefreshCw } from 'lucide-react'
import { useAuth } from '@/features/auth/auth-context'
import { useCohorts } from '@/features/cohorts/use-cohorts'
import type { Cohort } from '@/features/cohorts/cohort-model'
import { Button } from '@/components/ui/button'
import { listSchedules } from './schedule-api'
import type { Schedule } from './schedule-model'
import { ScheduleEditor } from './ScheduleEditor'
import { ScheduleList } from './ScheduleList'
import { ScheduleTimeline } from './ScheduleTimeline'

function ScheduleWorkspace({ cohort, manage, editing, setEditing }: { cohort: Cohort; manage: boolean; editing: Schedule | 'new' | null; setEditing: (value: Schedule | 'new' | null) => void }) {
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ revision: number; rows: Schedule[]; error: string } | null>(null)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let active = true
    void listSchedules(cohort.id).then(rows => { if (active) setResult({ revision, rows, error: '' }) }).catch(cause => {
      if (active) setResult({ revision, rows: [], error: cause instanceof Error ? cause.message : '일정을 불러오지 못했습니다.' })
    })
    return () => { active = false }
  }, [cohort.id, revision])
  const loading = result?.revision !== revision
  return <>
    <div className="participant-summary"><p><strong>{cohort.name}</strong> · 한국 시간(KST)</p><div className="button-row">
      <Button className="button-secondary" onClick={() => setRevision(value => value + 1)} disabled={loading || Boolean(editing)}><RefreshCw size={16} aria-hidden="true" /> 새로고침</Button>
      {manage && <Button disabled={Boolean(editing)} onClick={() => { setNotice(''); setEditing('new') }}><Plus size={16} aria-hidden="true" /> 새 일정</Button>}</div></div>
    {notice && <p className="success-message" role="status">{notice}</p>}
    {!loading && !result.error && <ScheduleTimeline items={result.rows.map(row => ({ ...row, program_name: cohort.name }))} />}
    <div className={editing ? 'cohort-workspace with-editor schedule-workspace' : 'cohort-workspace schedule-workspace'}><section className="panel" aria-label="프로그램 일정 목록">
      {loading ? <p className="empty-state" role="status">일정을 불러오고 있습니다.</p> : result.error ? <p className="form-error" role="alert">{result.error}</p>
        : <ScheduleList items={result.rows.map(row => ({ ...row, program_name: cohort.name }))} actions={manage ? id => {
          const row = result.rows.find(item => item.id === id)!
          return <div className="button-row"><span className="badge">{row.is_public ? '전체 공개' : '참여자 공개'}</span><Button className="button-secondary" disabled={Boolean(editing)} onClick={() => { setNotice(''); setEditing(row) }}>수정</Button></div>
        } : undefined} />}
    </section>
    {manage && editing && <ScheduleEditor key={editing === 'new' ? 'new' : editing.id} cohortId={cohort.id} schedule={editing === 'new' ? undefined : editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); setNotice('일정을 저장했습니다.'); setRevision(value => value + 1) }} />}
    </div>
  </>
}
export function SchedulesPage() {
  const { profile } = useAuth()
  const manage = profile?.role === 'professor'
  const { cohorts, loading, error, reload } = useCohorts()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<Schedule | 'new' | null>(null)
  const requested = params.get('cohort')
  const selected = requested ? cohorts.find(item => item.id === requested) : cohorts.find(item => item.status === 'active') ?? cohorts[0]
  return <>
    <div className="page-heading"><div><p className="eyebrow">PROGRAM SCHEDULE</p><h1>프로그램 일정</h1><p className="muted">{manage ? '단계별 운영 일정과 제출 마감일을 관리합니다.' : '참여 프로그램의 운영 일정과 제출 마감일을 확인하세요.'}</p></div></div>
    {loading ? <p role="status">프로그램을 불러오고 있습니다.</p> : error ? <div className="notice" role="alert"><p>{error}</p><Button onClick={reload}>다시 시도</Button></div>
      : !cohorts.length ? <section className="panel empty-state"><h2>{manage ? '먼저 프로그램을 등록해 주세요.' : '참여 중인 프로그램이 없습니다.'}</h2>{manage && <Link className="button" to="/cohorts?new=1">프로그램 등록</Link>}</section>
        : <><div className="cohort-selector"><label htmlFor="schedule-cohort">프로그램 선택</label><select id="schedule-cohort" value={selected?.id ?? ''} disabled={Boolean(editing)} onChange={e => setParams({ cohort: e.target.value })}><option value="" disabled>프로그램을 선택하세요</option>{cohorts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{editing && <span className="field-help">편집을 마치면 프로그램을 변경할 수 있습니다.</span>}</div>
          {selected ? <ScheduleWorkspace key={selected.id} cohort={selected} manage={manage} editing={editing} setEditing={setEditing} /> : <p role="alert">요청한 프로그램을 찾을 수 없습니다. 목록에서 다시 선택해 주세요.</p>}</>}
  </>
}
