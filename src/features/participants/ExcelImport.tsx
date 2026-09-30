import { useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { saveParticipant } from './participant-api'
import { importHeaders, previewImport, type ImportRow } from './import-model'
import { genderLabels, type Participant } from './participant-model'

export function ExcelImport({ cohortId, cohortName, existing, onChanged, onBusy, locked }: { locked: boolean; cohortId: string; cohortName: string; existing: Participant[]; onChanged: () => void; onBusy: (busy: boolean) => void }) {
  const [rows, setRows] = useState<ImportRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function downloadTemplate() {
    setError('')
    try {
      const { Workbook } = await import('exceljs')
      const workbook = new Workbook()
      const sheet = workbook.addWorksheet('참가자')
      sheet.addRow([...importHeaders])
      sheet.columns.forEach(column => { column.width = 24; column.numFmt = '@' })
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF102E4C' } }
      sheet.views = [{ state: 'frozen', ySplit: 1 }]
      const guide = workbook.addWorksheet('작성안내')
      guide.addRows([['참가자 시트의 2행부터 입력하세요.'], ['순번은 양식 확인용이며 시스템에 저장되지 않습니다.'], ['학년: 4학년 1학기 형식으로 입력하며 시스템에는 4-1로 저장됩니다.'], ['학번과 연락처는 앞자리 0 보존을 위해 텍스트 형식을 권장합니다. 숫자로 저장된 연락처의 010 앞자리도 자동 복원합니다.'], ['성별: 남 / 여 / 미입력'], ['희망직무: 공백(미입력) / SW 엔지니어링 / SW 개발 / AI 개발 / 기타'], ['이메일 자동 링크와 서식 있는 텍스트는 표시된 값으로 읽습니다. 수식·날짜·오류 셀은 사용할 수 없습니다.'], ['선택한 프로그램에 등록됩니다. 기존 참가자는 자동 덮어쓰지 않습니다.'], ['최대 500행, 2MB, .xlsx 파일만 지원합니다.'], ['계정 생성은 등록 후 별도로 실행합니다.']])
      guide.getColumn(1).width = 90
      const buffer = await workbook.xlsx.writeBuffer()
      const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const link = document.createElement('a'); link.href = url; link.download = 'AD_참가자_등록양식.xlsx'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setError('양식을 만들지 못했습니다. 다시 시도해 주세요.') }
  }
  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    setRows([]); setError(''); setNotice('')
    if (!file.name.toLowerCase().endsWith('.xlsx') || file.size > 2 * 1024 * 1024) { setError('2MB 이하의 .xlsx 파일을 선택해 주세요.'); return }
    setBusy(true); onBusy(true)
    try {
      const { Workbook } = await import('exceljs')
      const workbook = new Workbook()
      await workbook.xlsx.load(await file.arrayBuffer())
      const sheet = workbook.getWorksheet('참가자') ?? workbook.worksheets[0]
      if (!sheet || sheet.rowCount > 501 || sheet.columnCount > 10) throw new Error('최대 500행의 제공 양식을 사용해 주세요.')
      const grid: unknown[][] = []
      for (let number = 1; number <= sheet.rowCount; number++) grid.push(Array.from({ length: sheet.columnCount }, (_, index) => sheet.getRow(number).getCell(index + 1).value))
      setRows(previewImport(grid, existing, cohortName))
    } catch (cause) { setError(cause instanceof Error ? cause.message : '파일을 읽지 못했습니다.') }
    finally { setBusy(false); onBusy(false) }
  }
  async function save() {
    setBusy(true); onBusy(true); setError('')
    const targets = rows.filter(item => item.status === 'ready' || item.status === 'failed')
    let savedCount = 0
    let failedCount = 0
    for (const row of targets) {
      try {
        await saveParticipant(cohortId, row.input)
        savedCount += 1
        setRows(current => current.map(item => item.rowNumber === row.rowNumber ? { ...item, status: 'saved', message: '등록 완료' } : item))
      } catch (cause) { failedCount += 1; setRows(current => current.map(item => item.rowNumber === row.rowNumber ? { ...item, status: 'failed', message: cause instanceof Error ? cause.message : '등록 실패' } : item)) }
    }
    setNotice(failedCount ? `${savedCount}명 등록 완료 · ${failedCount}명 등록 실패` : `${savedCount}명의 참가자 등록을 완료했습니다.`)
    if (!failedCount) setRows([])
    setBusy(false); onBusy(false); onChanged()
    if (savedCount) window.setTimeout(() => document.querySelector('.participants-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }
  const ready = rows.filter(row => row.status === 'ready' || row.status === 'failed').length
  return <section className="panel account-panel"><div className="section-heading"><h2>엑셀 일괄 등록</h2><Button className="button-secondary" onClick={() => void downloadTemplate()} disabled={busy || locked}>양식 다운로드</Button></div>
    <p className="field-help">.xlsx · 최대 500행 · 2MB. 미리보기 후 정상 행만 등록합니다. 기존 참가자 정보는 덮어쓰지 않습니다.</p>
    <label className="file-picker">파일 선택<input type="file" accept=".xlsx" onChange={event => void readFile(event)} disabled={busy || locked} /></label>
    {error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status" className="success-message">{notice}</p>}
    {rows.length > 0 && <><div className="import-action-summary" role="status"><div><strong>파일 확인 완료 · 아직 참가자 목록에 등록되지 않았습니다.</strong><p className="field-help">전체 {rows.length}행 · 등록 예정 {ready}행 · 오류 {rows.filter(row => row.status === 'invalid' || row.status === 'failed').length}행 · 건너뜀 {rows.filter(row => row.status === 'skip').length}행</p></div><Button disabled={busy || locked || !ready} onClick={() => void save()}>{busy ? '등록 중…' : `참가자 등록 (${ready}명)`}</Button></div>
      <div className="import-preview table-scroll"><table className="data-table"><thead><tr><th>행</th><th>이름</th><th>이메일</th><th>학번</th><th>성별</th><th>검증 결과</th></tr></thead><tbody>{rows.map(row => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.input.full_name}</td><td>{row.input.email}</td><td>{row.input.student_number}</td><td>{genderLabels[row.input.gender]}</td><td className="result-message">{row.message}</td></tr>)}</tbody></table></div>
      {rows.some(row => row.status === 'failed') && <Button disabled={busy || locked || !ready} onClick={() => void save()}>{busy ? '재시도 중…' : `등록 실패 재시도 (${ready}명)`}</Button>}
    </>}
  </section>
}
