import test from 'node:test'
import assert from 'node:assert/strict'
import { validateAnnouncement,validateAnnouncementFile } from '../src/features/announcements/announcement-model.ts'

test('announcement title and body bounds are validated',()=>{
  assert.equal(validateAnnouncement({title:'공지',body:'내용',is_pinned:false}),'')
  assert.ok(validateAnnouncement({title:' ',body:'내용',is_pinned:false}))
  assert.ok(validateAnnouncement({title:'공지',body:'x'.repeat(10001),is_pinned:false}))
})

test('announcement attachments enforce extension and 20MB size',()=>{
  assert.equal(validateAnnouncementFile({name:'안내.PDF',size:1024}),'')
  assert.equal(validateAnnouncementFile({name:'자료.hwpx',size:20*1024*1024}),'')
  assert.ok(validateAnnouncementFile({name:'실행.exe',size:1024}))
  assert.ok(validateAnnouncementFile({name:`${'가'.repeat(256)}.pdf`,size:1024}))
  assert.ok(validateAnnouncementFile({name:'빈파일.zip',size:0}))
  assert.ok(validateAnnouncementFile({name:'대용량.zip',size:20*1024*1024+1}))
})
