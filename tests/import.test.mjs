import test from 'node:test'
import assert from 'node:assert/strict'
import { importHeaders, normalizeImportedGrade, previewImport } from '../src/features/participants/import-model.ts'
const row = [1, 'Test Student', 'STUDENT@example.test', 'Data Science', '00123456', '4학년 1학기', '남', '010-0000-0000', 'AI 개발']
test('import preserves identifiers and maps Korean job labels', () => {
  const [result] = previewImport([[...importHeaders], row], [], '기수1')
  assert.equal(result.status, 'ready')
  assert.equal(result.input.student_number, '00123456')
  assert.equal(result.input.email, 'student@example.test')
  assert.equal(result.input.job_group, 'ai_development')
  assert.equal(result.input.gender, 'male')
  assert.equal(result.input.grade, '4-1')
  assert.equal('serial_number' in result.input, false)
})
test('grade input uses the Korean year and semester format',()=>{
  assert.equal(normalizeImportedGrade('4학년 1학기'),'4-1')
  assert.equal(normalizeImportedGrade('4-1'),null)
})
test('blank desired job imports as unspecified',()=>{
  const blankJob=[...row];blankJob[8]=''
  assert.equal(previewImport([[...importHeaders],blankJob],[],'기수1')[0].input.job_group,'unspecified')
})
test('numeric identifiers, formulas and cohort mismatches cannot be imported', () => {
  assert.equal(previewImport([[...importHeaders], row.map((value, index) => index === 4 ? 123456 : value)], [], '기수1')[0].status, 'invalid')
  assert.equal(previewImport([[...importHeaders], row.map((value, index) => index === 1 ? { formula: '1+1' } : value)], [], '기수1')[0].status, 'invalid')
  assert.equal(previewImport([[...importHeaders, '기수'], [...row, '다른 기수']], [], '기수1')[0].status, 'invalid')
})
test('program headers support legacy files and reject mismatched or ambiguous destinations', () => {
  for (const header of ['프로그램', '기수']) {
    assert.equal(previewImport([[...importHeaders, header], [...row, '프로그램1']], [], '프로그램1')[0].status, 'ready')
    assert.equal(previewImport([[...importHeaders, header], [...row, '다른 프로그램']], [], '프로그램1')[0].status, 'invalid')
  }
  assert.throws(() => previewImport([[...importHeaders, '프로그램', '기수'], [...row, '프로그램1', '프로그램1']], [], '프로그램1'), /중복/)
})
test('all duplicate file rows are rejected and existing rows are not overwritten', () => {
  assert.ok(previewImport([[...importHeaders], row, row], [], '기수1').every(item => item.status === 'invalid'))
  const original = previewImport([[...importHeaders], row], [], '기수1')[0].input
  const existing = [{ ...original, id: 'existing', cohort_id: 'cohort', profile_id: null, created_at: '', updated_at: '' }]
  assert.equal(previewImport([[...importHeaders], row], existing, '기수1')[0].status, 'skip')
  assert.equal(previewImport([[...importHeaders], [row[0], 'Changed Name', ...row.slice(2)]], existing, '기수1')[0].status, 'invalid')
})
test('incorrect headers, empty lists and oversized lists are rejected', () => {
  assert.throws(() => previewImport([['이름'], ['Name']], [], '기수1'))
  assert.throws(() => previewImport([[...importHeaders]], [], '기수1'))
  assert.throws(() => previewImport([[...importHeaders], ...Array(501).fill(row)], [], '기수1'))
})
test('ExcelJS roundtrip retains text values required by the import contract', async () => {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('참가자')
  sheet.addRow([...importHeaders]); sheet.addRow(row)
  const restored = new ExcelJS.Workbook()
  await restored.xlsx.load(await workbook.xlsx.writeBuffer())
  const data = [1, 2].map(number => Array.from({ length: 9 }, (_, index) => restored.worksheets[0].getRow(number).getCell(index + 1).value))
  assert.equal(previewImport(data, [], '기수1')[0].input.student_number, '00123456')
})
