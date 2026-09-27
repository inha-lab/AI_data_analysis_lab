import test from 'node:test'
import assert from 'node:assert/strict'
import { deliverableFileContentType,deliverableFileExtension,deliverableValues,formatFileSize,validateDeliverable,validateDeliverableFile } from '../src/features/deliverables/deliverable-model.ts'

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
test('deliverables accept a file instead of a URL',()=>{
  assert.equal(validateDeliverable({...valid,url:''},true),null)
  assert.ok(validateDeliverable({...valid,url:''},false))
})
test('deliverable files enforce extension, MIME type and 20MB size',()=>{
  assert.equal(validateDeliverableFile({name:'발표자료.PPTX',size:1024,type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}),null)
  assert.equal(deliverableFileExtension('발표자료.PPTX'),'pptx')
  assert.equal(deliverableFileContentType('자료.zip'),'application/zip')
  assert.equal(formatFileSize(1024*1024),'1.0MB')
  assert.ok(validateDeliverableFile({name:'자료.exe',size:10,type:'application/octet-stream'}))
  assert.ok(validateDeliverableFile({name:'자료.pdf',size:20*1024*1024+1,type:'application/pdf'}))
  assert.ok(validateDeliverableFile({name:'자료.pdf',size:10,type:'text/plain'}))
})
