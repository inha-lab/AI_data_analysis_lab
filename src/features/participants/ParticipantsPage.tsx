import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, RefreshCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCohorts } from '@/features/cohorts/use-cohorts'
import type { Cohort } from '@/features/cohorts/cohort-model'
import { useParticipants } from './use-participants'
import { bulkUpdateParticipantStatus } from './participant-api'
import { ExcelImport } from './ExcelImport'
import { AccountProvisioning } from './AccountProvisioning'
import { ParticipantEditor } from './ParticipantEditor'
import { genderLabels, jobGroupLabel, participantStatusLabels, type Participant, type ParticipantStatus } from './participant-model'

type SortKey = 'full_name' | 'student_number' | 'department' | 'email'
function ParticipantWorkspace({ cohort, onEditingChange }: { cohort: Cohort; onEditingChange: (editing: boolean) => void }) {
  const { participants, loading, error, reload } = useParticipants(cohort.id)
  const [editor, setEditor] = useState<Participant | 'new' | null>(null)
  function updateEditor(value: Participant | 'new' | null) { setEditor(value); onEditingChange(Boolean(value)) }
  const [operationBusy, setOperationBusy] = useState(false)
  function operation(value: boolean) { setOperationBusy(value); onEditingChange(value) }
  const [searchInput, setSearchInput] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [status, setStatus] = useState('active')
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'full_name', asc: true })
  const [notice, setNotice] = useState('')
  const [actionError,setActionError]=useState('')
  const [selectedIds,setSelectedIds]=useState<Set<string>>(()=>new Set())
  const [bulkStatus,setBulkStatus]=useState<ParticipantStatus>('active')
  const query = searchKeyword.toLowerCase()
  const visible = participants.filter(item => (status === 'all' || item.status === status) && [item.full_name, item.student_number, item.email, item.department].some(value => value.toLowerCase().includes(query)))
    .sort((left, right) => (sort.asc ? 1 : -1) * left[sort.key].localeCompare(right[sort.key], 'ko', { numeric: true }))
  function saved(value: Participant) { updateEditor(null); setNotice(`${value.full_name} 님의 참가 정보를 저장했습니다.`); reload() }
  function sortBy(key: SortKey) { setSort(current => ({ key, asc: current.key === key ? !current.asc : true })) }
  const selected=participants.filter(item=>selectedIds.has(item.id))
  const allVisibleSelected=visible.length>0&&visible.every(item=>selectedIds.has(item.id))
  function toggleVisible(){setSelectedIds(current=>{const next=new Set(current);if(allVisibleSelected)visible.forEach(item=>next.delete(item.id));else visible.forEach(item=>next.add(item.id));return next})}
  async function applyBulkStatus(){
    if(!selected.length||!window.confirm(`선택한 ${selected.length}명의 상태를 '${participantStatusLabels[bulkStatus]}'(으)로 변경할까요?`))return
    operation(true);setActionError('');setNotice('')
    try{const count=await bulkUpdateParticipantStatus(cohort.id,selected.map(item=>item.id),bulkStatus);setSelectedIds(new Set());setNotice(`${count}명의 참여 상태를 '${participantStatusLabels[bulkStatus]}'(으)로 변경했습니다.`);reload()}
    catch(cause){setActionError(cause instanceof Error?cause.message:'참여 상태를 일괄 변경하지 못했습니다.')}
    finally{operation(false)}
  }
  const statusCounts = Object.fromEntries(Object.keys(participantStatusLabels).map(status=>[status,participants.filter(item=>item.status===status).length])) as Record<ParticipantStatus,number>
  return <>
    <div className="participant-summary"><p><strong>{cohort.name}</strong><span className="muted">{loading || error ? ' · 현황 확인 중' : ` · 참여 중 ${statusCounts.active}명 · 수료 ${statusCounts.completed}명 · 중탈 ${statusCounts.dropout}명 · 비활성 ${statusCounts.inactive}명`}</span></p><Button disabled={Boolean(editor) || operationBusy} onClick={() => { updateEditor('new'); setNotice('') }}><Plus size={16} aria-hidden="true" /> 참가자 등록</Button></div>
    {notice && <p className="success-message" role="status">{notice}</p>}{actionError&&<p className="form-error" role="alert">{actionError}</p>}
    {editor && <ParticipantEditor key={editor === 'new' ? 'new' : editor.id} cohortId={cohort.id} participant={editor === 'new' ? undefined : editor} onSaved={saved} onCancel={() => updateEditor(null)} />}
    <AccountProvisioning participants={participants} onChanged={reload} onBusy={operation} locked={Boolean(editor) || operationBusy || loading || Boolean(error)} />
    <ExcelImport cohortId={cohort.id} cohortName={cohort.name} existing={participants} onChanged={reload} onBusy={operation} locked={Boolean(editor) || operationBusy || loading || Boolean(error)} />
    <section className="panel participants-panel" aria-label="참가자 목록"><div className="list-toolbar">
      <form className="participant-search-form" role="search" onSubmit={event=>{event.preventDefault();setSearchKeyword(searchInput.trim())}}><label className="sr-only" htmlFor="participant-search">참가자 검색</label><input id="participant-search" type="search" placeholder="이름 · 학번 · 이메일 · 학과 검색" value={searchInput} onChange={event => setSearchInput(event.target.value)} /><Button type="submit"><Search size={16} aria-hidden="true" /> 검색</Button></form>
      <label className="sr-only" htmlFor="participant-filter">참여 상태</label><select id="participant-filter" value={status} onChange={event => setStatus(event.target.value)}>{Object.entries(participantStatusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}<option value="all">전체 상태</option></select>
      <Button className="button-secondary" onClick={reload} disabled={loading || operationBusy} aria-label="참가자 목록 새로고침"><RefreshCw size={16} aria-hidden="true" /></Button></div>
      {!loading&&!error&&<p className="field-help" role="status">전체 {participants.length}명 · 표시 {visible.length}명{searchKeyword&&` · 검색어: ${searchKeyword}`}</p>}
      {selected.length>0&&<div className="participant-bulk-actions"><strong>{selected.length}명 선택</strong><label className="sr-only" htmlFor="participant-bulk-status">변경할 참여 상태</label><select id="participant-bulk-status" value={bulkStatus} onChange={event=>setBulkStatus(event.target.value as ParticipantStatus)}>{Object.entries(participantStatusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select><Button disabled={operationBusy||Boolean(editor)} onClick={()=>void applyBulkStatus()}>선택 상태 변경</Button><Button className="button-secondary" disabled={operationBusy} onClick={()=>setSelectedIds(new Set())}>선택 해제</Button></div>}
      {loading ? <p className="empty-state" role="status">참가자를 불러오고 있습니다.</p> : error ? <div className="empty-state" role="alert"><p>{error}</p><Button onClick={reload}>다시 시도</Button></div>
        : !visible.length ? <div className="empty-state"><h2>{participants.length ? '검색 결과가 없습니다.' : '등록된 참가자가 없습니다.'}</h2><p>{participants.length ? '검색어나 참여 상태를 변경해 보세요.' : '선발된 참가자의 정보를 등록해 주세요.'}</p></div>
        : <div className="table-scroll"><table className="data-table"><caption className="sr-only">{cohort.name} 참가자 {visible.length}명</caption><thead><tr><th scope="col"><input type="checkbox" aria-label="표시된 참가자 전체 선택" checked={allVisibleSelected} onChange={toggleVisible} disabled={operationBusy||Boolean(editor)}/></th><th scope="col">번호</th>
          {([['full_name', '이름'], ['student_number', '학번'], ['department', '학과'], ['grade', '학년'], ['gender', '성별'], ['email', '이메일'], ['phone', '전화번호']] as const).map(([key, label]) => key === 'grade' || key === 'gender' || key === 'phone'
            ? <th key={key} scope="col">{label}</th>
            : <th key={key} scope="col" aria-sort={sort.key === key ? sort.asc ? 'ascending' : 'descending' : 'none'}><button type="button" onClick={() => sortBy(key)}>{label} {sort.key === key ? sort.asc ? '↑' : '↓' : '↕'}</button></th>)}
          <th scope="col">희망 직무</th><th scope="col">참여 / 계정</th><th scope="col">관리</th></tr></thead>
          <tbody>{visible.map((item, index) => <tr key={item.id}><td><input type="checkbox" aria-label={`${item.full_name} 선택`} checked={selectedIds.has(item.id)} disabled={operationBusy||Boolean(editor)} onChange={()=>setSelectedIds(current=>{const next=new Set(current);if(next.has(item.id))next.delete(item.id);else next.add(item.id);return next})}/></td><td>{index + 1}</td><td className="name-cell">{item.full_name}</td><td>{item.student_number}</td><td>{item.department}</td><td>{item.grade}</td><td>{genderLabels[item.gender]}</td><td>{item.email}</td><td>{item.phone}</td><td>{jobGroupLabel(item)}</td><td><span className={`badge ${item.status === 'active' ? 'status-active' : 'status-completed'}`}>{participantStatusLabels[item.status]}</span><span className="account-status">{item.profile_id ? '계정 연결됨' : '계정 연결 대기'}</span></td><td><Button className="button-secondary" disabled={Boolean(editor) || operationBusy} onClick={() => { updateEditor(item); setNotice('') }} aria-label={`${item.full_name} 정보 수정`}>수정</Button></td></tr>)}</tbody></table></div>}
    </section>
  </>
}

export function ParticipantsPage() {
  const { cohorts, loading, error, reload } = useCohorts()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState(false)
  const requested = params.get('cohort')
  const selected = requested ? cohorts.find(item => item.id === requested) : cohorts.find(item => item.status === 'active') ?? cohorts[0]
  return <>
    <div className="page-heading"><div><p className="eyebrow">PARTICIPANT MANAGEMENT</p><h1>참가자 관리</h1><p className="muted">프로그램을 선택하고 선발된 참가자 정보를 관리합니다.</p></div></div>
    {loading ? <p className="empty-state" role="status">프로그램을 불러오고 있습니다.</p> : error ? <div className="notice" role="alert"><p>{error}</p><Button onClick={reload}>다시 시도</Button></div>
      : !cohorts.length ? <section className="panel empty-state"><h2>먼저 프로그램을 만들어 주세요.</h2><p>참가자는 프로그램별로 등록하고 관리합니다.</p><Link className="button" to="/cohorts?new=1">프로그램 만들기</Link></section>
        : <><div className="cohort-selector"><label htmlFor="participant-cohort">관리할 프로그램</label><select id="participant-cohort" value={selected?.id ?? ''} onChange={event => {
          if (editing && !window.confirm('작성 중인 내용을 저장하지 않고 프로그램을 변경할까요?')) return
          setEditing(false)
          setParams({ cohort: event.target.value })
        }}><option value="" disabled>프로그램을 선택하세요</option>{cohorts.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div>
          {selected ? <ParticipantWorkspace key={selected.id} cohort={selected} onEditingChange={setEditing} /> : <p className="notice" role="alert">요청한 프로그램을 찾을 수 없습니다. 위 목록에서 프로그램을 선택해 주세요.</p>}</>}
  </>
}
