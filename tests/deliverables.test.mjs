import test from 'node:test'
import assert from 'node:assert/strict'
import { deliverableValues,validateDeliverable } from '../src/features/deliverables/deliverable-model.ts'

const valid={category:'analysis',title:'분석 결과',description:'EDA와 모델 결과',url:'https://example.org/report'}
test('deliverable links require a supported type, title and safe URL',()=>{
  assert.equal(validateDeliverable(valid),null)
  for(const url of ['', 'javascript:alert(1)', 'https://user:pass@example.org/a', 'https://example.org/a b'])assert.ok(validateDeliverable({...valid,url}))
  assert.ok(validateDeliverable({...valid,category:'unknown'}))
  assert.ok(validateDeliverable({...valid,title:' '}))
  assert.ok(validateDeliverable({...valid,description:'a'.repeat(4001)}))
})
test('deliverable values trim title and normalize URLs',()=>{
  assert.deepEqual(deliverableValues({...valid,title:' 분석 결과 ',url:' https://example.org/report '}),valid)
})
