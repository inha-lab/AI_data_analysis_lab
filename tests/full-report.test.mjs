import test from 'node:test'
import assert from 'node:assert/strict'
import { buildFullReportHtml,fullReportFilename,fullReportTitle } from '../src/features/full-report/full-report-model.ts'

const sample={program_name:'AI 프로그램',team:{id:'1',cohort_id:'2',name:'데이터 팀',topic:'<script>alert(1)</script>',stage:'planning',notion_url:'https://example.com/?x=1&y=2',github_url:'javascript:alert(1)',demo_url:''},members:[{full_name:'홍길동',department:'컴퓨터공학과',job_group:'ai_development',is_leader:true,is_active:true}],proposal:null,reports:[],deliverables:[{id:'3',team_id:'1',category:'analysis',title:'결과 <img src=x>',description:'설명',url:'https://example.org/result',submitted_by:'4',submitted_name:'홍길동',submitted_at:'2026-09-25T00:00:00Z',updated_at:'2026-09-25T00:00:00Z'}]}
test('downloaded full report escapes team content and excludes unsafe links',()=>{
  const html=buildFullReportHtml(sample,'2026-09-25T00:00:00Z')
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'))
  assert.ok(!html.includes('<script>'))
  assert.ok(html.includes('https://example.com/?x=1&amp;y=2'))
  assert.ok(!html.includes('javascript:alert(1)'))
  assert.ok(html.includes('홍길동 (팀장)'))
  assert.ok(html.includes('결과 &lt;img src=x&gt;'))
  assert.ok(html.includes('2026'))
})
test('full report title and downloaded filename use program and team names',()=>{
  assert.equal(fullReportTitle(sample),'INHA AI Data Analysis LAB — AI 프로그램 — 데이터 팀')
  assert.match(fullReportFilename(sample),/^INHA_AI_Data_Analysis_LAB_AI_프로그램_데이터_팀\.html$/)
})
