import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { formatScheduleTime, scheduleState, stageLabels, type ScheduleDisplay } from './schedule-model'

export function ScheduleList({ items, actions }: { items: ScheduleDisplay[]; actions?: (id: string) => ReactNode }) {
  const [stage, setStage] = useState('all')
  const [period, setPeriod] = useState('all')
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer) }, [])
  const visible = items.filter(item => (stage === 'all' || item.stage === stage) && (period === 'all' || (Date.parse(item.ends_at) >= now && !item.is_cancelled)))
  return <>
    <div className="list-toolbar schedule-toolbar"><select aria-label="단계 필터" value={stage} onChange={e => setStage(e.target.value)}><option value="all">모든 단계</option>{Object.entries(stageLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <select aria-label="기간 필터" value={period} onChange={e => setPeriod(e.target.value)}><option value="upcoming">진행 중·예정</option><option value="all">전체 (종료·취소 포함)</option></select></div>
    {!visible.length ? <div className="empty-state"><h3>표시할 일정이 없습니다.</h3><p>{items.length ? '단계 또는 기간 필터를 변경해 보세요.' : '일정이 등록되면 이곳에 표시됩니다.'}</p>{items.length > 0 && <Button className="button-secondary" onClick={() => { setStage('all'); setPeriod('all') }}>전체 일정 보기</Button>}</div>
      : <div className="schedule-list">{visible.map(item => <article className="schedule-card" key={item.id}>
        <div className="schedule-card-heading"><div><span className="badge">{stageLabels[item.stage]}</span> <span className={`badge ${scheduleState(item, now) === '진행 중' ? 'status-active' : 'status-draft'}`}>{scheduleState(item, now)}</span> {item.kind === 'deadline' && <span className="badge">제출 마감</span>}</div>{actions?.(item.id)}</div>
        <p className="field-help">{item.program_name}</p><h3>{item.title}</h3>
        <p className="schedule-time"><time dateTime={item.starts_at}>{formatScheduleTime(item.starts_at)}</time>{item.kind === 'event' && <> ~ <time dateTime={item.ends_at}>{formatScheduleTime(item.ends_at)}</time></>} (KST)</p>
        {item.description && <p className="cohort-description">{item.description}</p>}
      </article>)}</div>}
  </>
}
