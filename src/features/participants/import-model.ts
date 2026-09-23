import { jobGroups, normalizeParticipant, validateParticipant, type Participant, type ParticipantInput } from './participant-model.ts'
export const importHeaders = ['이름', '이메일', '학과', '학번', '학년', '전화번호', '희망직무'] as const
export interface ImportRow { rowNumber: number; input: ParticipantInput; status: 'ready' | 'invalid' | 'skip' | 'saved' | 'failed'; message: string }
export function previewImport(grid: unknown[][], existing: Participant[], cohortName: string): ImportRow[] {
  if (!grid.length) throw new Error('빈 파일입니다.')
  const headers = grid[0].map(value => String(value ?? '').trim())
  if (new Set(headers).size !== headers.length || importHeaders.some(header => !headers.includes(header))) throw new Error('필수 열이 없거나 중복되었습니다. 제공된 양식을 사용해 주세요.')
  if (headers.some(header => ![...importHeaders, '기수'].includes(header as typeof importHeaders[number]))) throw new Error('지원하지 않는 열이 있습니다. 팀 배정은 별도 기능으로 진행해 주세요.')
  if (grid.length > 501) throw new Error('한 번에 최대 500행까지 업로드할 수 있습니다.')
  const result: ImportRow[] = []
  for (let index = 1; index < grid.length; index++) {
    const row = grid[index]
    if (!row.some(value => value !== null && value !== undefined && value !== '')) continue
    const raw = (name: string) => row[headers.indexOf(name)]
    const value = (name: string) => String(raw(name) ?? '').trim()
    const job = Object.entries(jobGroups).find(([key, label]) => key === value('희망직무') || label === value('희망직무'))?.[0]
    const input = normalizeParticipant({ full_name: value('이름'), email: value('이메일'), department: value('학과'), student_number: value('학번'), grade: value('학년'), phone: value('전화번호'), job_group: job as ParticipantInput['job_group'], status: 'active' })
    let error = row.some(cell => typeof cell === 'object' && cell !== null) ? '수식·날짜·링크 셀은 사용할 수 없습니다. 값만 입력해 주세요.' : ''
    if (!error && (typeof raw('학번') !== 'string' || typeof raw('전화번호') !== 'string')) error = '학번과 전화번호는 앞자리 0 보존을 위해 텍스트 형식으로 입력해 주세요.'
    if (!error && headers.includes('기수') && value('기수') && value('기수') !== cohortName) error = '선택한 기수와 파일의 기수명이 다릅니다.'
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
