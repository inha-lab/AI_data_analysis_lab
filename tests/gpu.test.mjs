import test from 'node:test'
import assert from 'node:assert/strict'
import { gpuIds,overlapsKstHour,reservationTimes,validateReservation } from '../src/features/gpu/gpu-model.ts'

const input={teamId:'team',day:'2026-09-25',start:'23:00',end:'01:00',choice:'both',purpose:'Model training'}
test('GPU reservation crosses midnight in KST and equal times mean 24 hours',()=>{
  assert.equal(reservationTimes(input).start.toISOString(),'2026-09-25T14:00:00.000Z')
  assert.equal(reservationTimes(input).end.toISOString(),'2026-09-25T16:00:00.000Z')
  assert.equal(reservationTimes({...input,start:'09:00',end:'09:00'}).end-reservationTimes({...input,start:'09:00',end:'09:00'}).start,86400000)
  assert.deepEqual(gpuIds('both'),[0,1])
})
test('GPU reservation rejects impossible dates, time and missing purpose',()=>{
  for(const patch of [{day:'2026-02-29'},{day:'2026-04-31'},{start:'24:00'},{end:'10:60'},{start:'09:30'},{purpose:' '},{purpose:'x'.repeat(501)},{teamId:''}])assert.ok(validateReservation({...input,...patch}))
  assert.equal(validateReservation(input),'')
})
test('hourly GPU grid uses KST and includes overnight reservations',()=>{
  const row={starts_at:'2026-09-25T14:00:00Z',ends_at:'2026-09-25T16:00:00Z'}
  assert.equal(overlapsKstHour(row,'2026-09-25',22),false)
  assert.equal(overlapsKstHour(row,'2026-09-25',23),true)
  assert.equal(overlapsKstHour(row,'2026-09-26',0),true)
  assert.equal(overlapsKstHour(row,'2026-09-26',1),false)
})
