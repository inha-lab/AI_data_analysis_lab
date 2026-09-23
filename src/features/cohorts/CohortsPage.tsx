import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCohorts } from './use-cohorts'
import { CohortEditor } from './CohortEditor'
import { cohortPeriod, cohortStatusLabels, type Cohort } from './cohort-model'

export function CohortsPage() {
  const { cohorts, loading, error, reload } = useCohorts()
  const [params] = useSearchParams()
  const [editor, setEditor] = useState<Cohort | 'new' | null>(params.get('new') === '1' ? 'new' : null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [notice, setNotice] = useState('')
  const visible = cohorts.filter(cohort => cohort.name.toLowerCase().includes(search.toLowerCase().trim()) && (status === 'all' || cohort.status === status))
  function saved(cohort: Cohort) { setEditor(null); setNotice(`${cohort.name} 정보를 저장했습니다.`); reload() }
  return <>
    <div className="page-heading"><div><p className="eyebrow">PROGRAM MANAGEMENT</p><h1>프로그램 관리</h1><p className="muted">프로그램의 시작과 마무리를 프로그램별로 관리합니다.</p></div>
      <Button onClick={() => { setEditor('new'); setNotice('') }} disabled={Boolean(editor)}><Plus size={18} aria-hidden="true" /> 새 프로그램</Button></div>
    {notice && <p className="success-message" role="status">{notice}</p>}
    <div className={editor ? 'cohort-workspace with-editor' : 'cohort-workspace'}><section className="panel" aria-label="프로그램 목록">
      <div className="list-toolbar"><div><label className="sr-only" htmlFor="cohort-search">프로그램명 검색</label><input id="cohort-search" type="search" placeholder="프로그램명 검색" value={search} onChange={event => setSearch(event.target.value)} /></div>
        <label className="sr-only" htmlFor="status-filter">상태 필터</label><select id="status-filter" value={status} onChange={event => setStatus(event.target.value)}><option value="all">전체 상태</option>{Object.entries(cohortStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
        <Button className="button-secondary" onClick={reload} disabled={loading} aria-label="목록 새로고침"><RefreshCw size={16} aria-hidden="true" /></Button></div>
      {loading ? <p className="empty-state" role="status">프로그램 목록을 불러오고 있습니다.</p> : error ? <div className="empty-state" role="alert"><p>{error}</p><Button onClick={reload}>다시 시도</Button></div>
        : !visible.length ? <div className="empty-state"><h2>{cohorts.length ? '검색 결과가 없습니다.' : '첫 번째 프로그램을 만들어 주세요.'}</h2><p>{cohorts.length ? '검색어나 상태 필터를 바꿔 보세요.' : '프로그램명과 운영 기간을 등록하면 프로그램 관리를 시작할 수 있습니다.'}</p></div>
        : <div className="cohort-list">{visible.map(cohort => <article className="cohort-row" key={cohort.id}>
          <div><span className={`badge status-${cohort.status}`}>{cohortStatusLabels[cohort.status]}</span><h2>{cohort.name}</h2><p className="muted">{cohortPeriod(cohort)}</p>{cohort.description && <p className="cohort-description">{cohort.description}</p>}</div>
          <Button className="button-secondary" disabled={Boolean(editor)} onClick={() => { setEditor(cohort); setNotice('') }} aria-label={`${cohort.name} 수정`}>수정</Button>
        </article>)}</div>}
    </section>{editor && <CohortEditor key={editor === 'new' ? 'new' : editor.id} cohort={editor === 'new' ? undefined : editor} onSaved={saved} onCancel={() => setEditor(null)} />}</div>
  </>
}
