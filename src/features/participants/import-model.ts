import { genderLabels, jobGroups, normalizeParticipant, validateParticipant, type Gender, type Participant, type ParticipantInput } from './participant-model.ts'
export const importHeaders = ['순번', '이름', '이메일', '학과', '학번', '학년', '성별', '연락처', '희망직무'] as const
export interface ImportRow { rowNumber: number; input: ParticipantInput; status: 'ready' | 'invalid' | 'skip' | 'saved' | 'failed'; message: string }
export interface ImportedCellText { text: string; unsupported: boolean }
export function importedCellText(value: unknown): ImportedCellText {
  if (value === null || value === undefined) return { text: '', unsupported: false }
  if (typeof value === 'string' || typeof value === 'boolean') return { text: String(value).trim(), unsupported: false }
  if (typeof value === 'number') return Number.isSafeInteger(value)
    ? { text: String(value), unsupported: false }
    : { text: '', unsupported: true }
  if (value instanceof Date) return { text: '', unsupported: true }
  if (typeof value === 'object') {
    const cell = value as Record<string, unknown>
    if ('formula' in cell || 'sharedFormula' in cell || 'error' in cell) return { text: '', unsupported: true }
    if (typeof cell.text === 'string' && typeof cell.hyperlink === 'string') return { text: cell.text.trim(), unsupported: false }
    if (Array.isArray(cell.richText)) {
      const text = cell.richText.map(part => {
        if (!part || typeof part !== 'object') return ''
        const segment = (part as Record<string, unknown>).text
        return typeof segment === 'string' ? segment : ''
      }).join('').trim()
      return { text, unsupported: false }
    }
  }
  return { text: '', unsupported: true }
}
export function normalizeImportedGrade(value:string):string|null{
  const matched=value.trim().match(/^([1-9]\d*)\s*학년\s*([1-9]\d*)\s*학기$/)
  return matched?`${matched[1]}-${matched[2]}`:null
}
export function previewImport(grid: unknown[][], existing: Participant[], cohortName: string): ImportRow[] {
  if (!grid.length) throw new Error('빈 파일입니다.')
  const headerCells = grid[0].map(importedCellText)
  if (headerCells.some(cell => cell.unsupported)) throw new Error('머리글은 텍스트 값으로 입력해 주세요.')
  const headers = headerCells.map(cell => {
    const header = cell.text
    return header === '기수' ? '프로그램' : header
  })
  if (new Set(headers).size !== headers.length || importHeaders.some(header => !headers.includes(header))) throw new Error('필수 열이 없거나 중복되었습니다. 제공된 양식을 사용해 주세요.')
  if (headers.some(header => ![...importHeaders, '프로그램'].includes(header as typeof importHeaders[number]))) throw new Error('지원하지 않는 열이 있습니다. 팀 배정은 별도 기능으로 진행해 주세요.')
  if (grid.length > 501) throw new Error('한 번에 최대 500행까지 업로드할 수 있습니다.')
  const result: ImportRow[] = []
  for (let index = 1; index < grid.length; index++) {
    const row = grid[index]
    if (!row.some(value => value !== null && value !== undefined && value !== '')) continue
    const raw = (name: string) => row[headers.indexOf(name)]
    const parsed = new Map(headers.map((header, cellIndex) => [header, importedCellText(row[cellIndex])]))
    const value = (name: string) => {
      const text = parsed.get(name)?.text ?? ''
      return name === '연락처' && typeof raw(name) === 'number' && /^10\d{8}$/.test(text) ? `0${text}` : text
    }
    const job = value('희망직무') === '' ? 'unspecified' : Object.entries(jobGroups).find(([key, label]) => key === value('희망직무') || label === value('희망직무'))?.[0]
    const gender = Object.entries(genderLabels).find(([key,label]) => key === value('성별') || label === value('성별'))?.[0]
    const grade=normalizeImportedGrade(value('학년'))
    const input = normalizeParticipant({ full_name: value('이름'), email: value('이메일'), department: value('학과'), student_number: value('학번'), grade: grade??value('학년'), gender: gender as Gender, phone: value('연락처'), job_group: job as ParticipantInput['job_group'], status: 'active' })
    let error = [...parsed.values()].some(cell => cell.unsupported) ? '수식·날짜·오류 셀은 사용할 수 없습니다. 표시된 값을 복사해 값으로 붙여넣어 주세요.' : ''
    if(!error&&!value('순번'))error='순번을 입력해 주세요.'
    if(!error&&!grade)error='학년은 4학년 1학기와 같은 형식으로 입력해 주세요.'
    if (!error && headers.includes('프로그램') && value('프로그램') && value('프로그램') !== cohortName) error = '선택한 프로그램과 파일의 프로그램명이 다릅니다.'
    error ||= validateParticipant(input) ?? ''
    const matches = existing.filter(item => item.email === input.email || item.student_number === input.student_number)
    const identical = matches.length === 1 && Object.keys(input).every(key => input[key as keyof ParticipantInput] === matches[0][key as keyof ParticipantInput])
    if (!error && matches.length && !identical) error = '기존 이메일·학번과 충돌하거나 정보가 다릅니다. 수동으로 수정해 주세요.'
    result.push({ rowNumber: index + 1, input, status: error ? 'invalid' : identical ? 'skip' : 'ready', message: error || (identical ? '동일한 참가자 · 건너뜀' : '등록 가능') })
  }
  if (!result.length) throw new Error('등록할 참가자 행이 없습니다.')
  for (const row of result) {
    if (result.some(other => other !== row && (other.input.email === row.input.email || other.input.student_number === row.input.student_number))) {
      row.status = 'invalid'; row.message = '파일 안에 이메일 또는 학번이 중복됩니다.'
    }
  }
  return result
}
