import test from 'node:test'
import assert from 'node:assert/strict'
import { gpuIds,reservationTimes,validateReservation } from '../src/features/gpu/gpu-model.ts'

const input={teamId:'team',day:'2026-09-25',start:'23:00',end:'01:00',choice:'both',purpose:'Model training'}
test('GPU reservation crosses midnight in KST and equal times mean 24 hours',()=>{
  assert.equal(reservationTimes(input).start.toISOString(),'2026-09-25T14:00:00.000Z')
  assert.equal(reservationTimes(input).end.toISOString(),'2026-09-25T16:00:00.000Z')
  assert.equal(reservationTimes({...input,start:'09:00',end:'09:00'}).end-reservationTimes({...input,start:'09:00',end:'09:00'}).start,86400000)
  assert.deepEqual(gpuIds('both'),[0,1])
})
test('GPU reservation rejects impossible dates, time and missing purpose',()=>{
  for(const patch of [{day:'2026-02-29'},{day:'2026-04-31'},{start:'24:00'},{end:'10:60'},{purpose:' '},{purpose:'x'.repeat(501)},{teamId:''}])assert.ok(validateReservation({...input,...patch}))
  assert.equal(validateReservation(input),'')
})
