import test from 'node:test'
import assert from 'node:assert/strict'
import { remainingStudyTime } from '../src/utils/remainingStudyTime.js'

test('school and non-school windows before their start', () => {
  assert.equal(remainingStudyTime({ nowMinutes: 600, schoolDay: true, lessons: [] }).minutes, 300)
  assert.equal(remainingStudyTime({ nowMinutes: 600, schoolDay: false, lessons: [] }).minutes, 600)
})
test('clips lessons to remaining window and merges overlaps and duplicates', () => {
  const result = remainingStudyTime({ nowMinutes: 18 * 60, schoolDay: true, lessons: [
    { startTime: '17:00', endTime: '18:30' },
    { startTime: '18:00', endTime: '19:00' },
    { startTime: '18:00', endTime: '19:00' },
    { startTime: '21:30', endTime: '23:00' },
    { startTime: '19:00', endTime: '20:00', status: 'iptal-edildi' },
  ] })
  assert.deepEqual(result, { minutes: 150, privateMinutes: 90, start: 1020 })
})
test('after 22:00 remaining time is zero; duration supports missing end time', () => {
  assert.equal(remainingStudyTime({ nowMinutes: 1400, schoolDay: false, lessons: [] }).minutes, 0)
  assert.equal(remainingStudyTime({ nowMinutes: 720, schoolDay: false, lessons: [{ startTime: '13:00', durationMinutes: 90 }] }).minutes, 510)
})

test('early school finish starts at 14:00; full day starts at 17:00', () => {
  const early = remainingStudyTime({ nowMinutes: 720, schoolDay: true, schoolEndTime: '11:40', lessons: [{ startTime: '18:00', endTime: '19:30' }] })
  assert.equal(early.start, 840)
  assert.equal(early.minutes, 390)
  const full = remainingStudyTime({ nowMinutes: 720, schoolDay: true, schoolEndTime: '16:30', lessons: [] })
  assert.equal(full.start, 1020)
  assert.equal(full.minutes, 300)
  assert.equal(remainingStudyTime({ nowMinutes: 900, schoolDay: true, schoolEndTime: '11:40', lessons: [] }).minutes, 420)
})

test('second precision counts down study time and pauses during private lessons', () => {
  const calculate = (nowMinutes) => Math.round(remainingStudyTime({ nowMinutes, schoolDay: true, lessons: [{ startTime: '18:00', endTime: '19:00' }] }).minutes * 60)
  assert.equal(calculate(17 * 60 + 1 / 60), 4 * 3600 - 1)
  assert.equal(calculate(18 * 60 + 30 / 60), 3 * 3600)
  assert.equal(calculate(22 * 60), 0)
})
