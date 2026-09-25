import { formatScheduleTime, scheduleState, stageLabels, type ScheduleDisplay } from './schedule-model'

export function ScheduleTimeline({ items }: { items: ScheduleDisplay[] }) {
  const ordered = [...items].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at) || a.id.localeCompare(b.id))
  return <section className="panel schedule-timeline-panel" aria-label="전체 일정 타임라인">
    <div className="section-heading"><h2>전체 일정 타임라인</h2><span className="field-help">총 {items.length}건 · 한국 시간(KST)</span></div>
    {!ordered.length ? <p className="field-help">등록된 일정이 없습니다.</p> : <ol className="schedule-timeline" tabIndex={0} aria-label="시작 시각 순으로 정렬한 전체 일정, 가로로 스크롤하여 확인">{ordered.map(item => <li key={item.id} className={item.is_cancelled ? 'schedule-timeline-item is-cancelled' : 'schedule-timeline-item'}>
      <span className="schedule-timeline-dot" aria-hidden="true" />
      <div className="schedule-timeline-body"><time dateTime={item.starts_at}>{formatScheduleTime(item.starts_at)}</time><strong>{item.title}</strong><span>{stageLabels[item.stage]} · {item.kind === 'deadline' ? '제출 마감' : scheduleState(item)}</span></div>
    </li>)}</ol>}
  </section>
}
