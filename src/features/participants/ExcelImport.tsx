import { useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { saveParticipant } from './participant-api'
import { importHeaders, previewImport, type ImportRow } from './import-model'
import type { Participant } from './participant-model'

export function ExcelImport({ cohortId, cohortName, existing, onChanged, onBusy, locked }: { locked: boolean; cohortId: string; cohortName: string; existing: Participant[]; onChanged: () => void; onBusy: (busy: boolean) => void }) {
  const [rows, setRows] = useState<ImportRow[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
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
      guide.addRows([['참가자 시트의 2행부터 입력하세요.'], ['학번과 전화번호는 텍스트 형식을 유지하세요.'], ['희망직무: SW 엔지니어링 / SW 개발 / AI 개발'], ['선택한 기수에 등록됩니다. 기존 참가자는 자동 덮어쓰지 않습니다.'], ['최대 500행, 2MB, .xlsx 파일만 지원합니다.'], ['계정 생성은 등록 후 별도로 실행합니다.']])
      guide.getColumn(1).width = 90
      const buffer = await workbook.xlsx.writeBuffer()
      const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const link = document.createElement('a'); link.href = url; link.download = 'AD_참가자_등록양식.xlsx'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch { setError('양식을 만들지 못했습니다. 다시 시도해 주세요.') }
  }
  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    setRows([]); setError('')
    if (!file.name.toLowerCase().endsWith('.xlsx') || file.size > 2 * 1024 * 1024) { setError('2MB 이하의 .xlsx 파일을 선택해 주세요.'); return }
    setBusy(true); onBusy(true)
    try {
      const { Workbook } = await import('exceljs')
      const workbook = new Workbook()
      await workbook.xlsx.load(await file.arrayBuffer())
      const sheet = workbook.getWorksheet('참가자') ?? workbook.worksheets[0]
      if (!sheet || sheet.rowCount > 501 || sheet.columnCount > 8) throw new Error('최대 500행의 제공 양식을 사용해 주세요.')
      const grid: unknown[][] = []
      for (let number = 1; number <= sheet.rowCount; number++) grid.push(Array.from({ length: sheet.columnCount }, (_, index) => sheet.getRow(number).getCell(index + 1).value))
      setRows(previewImport(grid, existing, cohortName))
    } catch (cause) { setError(cause instanceof Error ? cause.message : '파일을 읽지 못했습니다.') }
    finally { setBusy(false); onBusy(false) }
  }
  async function save() {
    setBusy(true); onBusy(true); setError('')
    for (const row of rows.filter(item => item.status === 'ready' || item.status === 'failed')) {
      try {
        await saveParticipant(cohortId, row.input)
        setRows(current => current.map(item => item.rowNumber === row.rowNumber ? { ...item, status: 'saved', message: '등록 완료' } : item))
      } catch (cause) { setRows(current => current.map(item => item.rowNumber === row.rowNumber ? { ...item, status: 'failed', message: cause instanceof Error ? cause.message : '등록 실패' } : item)) }
    }
    setBusy(false); onBusy(false); onChanged()
  }
  const ready = rows.filter(row => row.status === 'ready' || row.status === 'failed').length
  return <section className="panel account-panel"><div className="section-heading"><h2>엑셀 일괄 등록</h2><Button className="button-secondary" onClick={() => void downloadTemplate()} disabled={busy || locked}>양식 다운로드</Button></div>
    <p className="field-help">.xlsx · 최대 500행 · 2MB. 미리보기 후 정상 행만 등록합니다. 기존 참가자 정보는 덮어쓰지 않습니다.</p>
    <label className="file-picker">파일 선택<input type="file" accept=".xlsx" onChange={event => void readFile(event)} disabled={busy || locked} /></label>
    {error && <p role="alert" className="form-error">{error}</p>}
    {rows.length > 0 && <><p role="status">전체 {rows.length}행 · 등록 완료 {rows.filter(row => row.status === 'saved').length}행 · 오류 {rows.filter(row => row.status === 'invalid' || row.status === 'failed').length}행 · 건너뜀 {rows.filter(row => row.status === 'skip').length}행</p>
      <div className="import-preview table-scroll"><table className="data-table"><thead><tr><th>행</th><th>이름</th><th>이메일</th><th>학번</th><th>검증 결과</th></tr></thead><tbody>{rows.map(row => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.input.full_name}</td><td>{row.input.email}</td><td>{row.input.student_number}</td><td className="result-message">{row.message}</td></tr>)}</tbody></table></div>
      <Button disabled={busy || locked || !ready} onClick={() => void save()}>{busy ? '처리 중…' : `등록 / 실패 재시도 (${ready}행)`}</Button>
    </>}
  </section>
}
