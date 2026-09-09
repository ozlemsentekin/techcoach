import test from 'node:test'
import assert from 'node:assert/strict'
import { getDailyTaskSummary } from '../src/utils/dailyTaskSummary.js'

const today = '2026-09-09'
const done = (date, completedAt) => ({ date, status: 'tamamlandi', completedAt })

test('counts completion date rather than planned date and includes pending backlog in total', () => {
  const tasks = [
    done(today, '2026-09-09T12:00:00'),
    done('2026-09-07', '2026-09-09T13:00:00'),
    done(today, '2026-09-08T12:00:00'),
    { date: today, status: 'bekliyor' },
    { date: '2026-09-08', status: 'devam-ediyor' },
    { date: today, status: 'yeniden-planlandi' },
    { date: today, status: 'bekliyor', isTeacherLessonSlot: true },
  ]
  const result = getDailyTaskSummary(tasks, today)
  assert.equal(result.completed, 2)
  assert.equal(result.total, 4)
  assert.equal(result.progress, 50)
  assert.deepEqual(result.completedTasks, tasks.slice(0, 2))
  assert.deepEqual(result.pendingTasks, tasks.slice(3, 5))
  assert.equal(result.pendingTasks.length, result.total - result.completed)
})

test('invalid timestamps and undo do not count as completed today', () => {
  const result = getDailyTaskSummary([
    done(today, null),
    done(today, 'invalid'),
    { status: 'bekliyor', completedAt: '2026-09-09T12:00:00' },
  ], today)
  assert.equal(result.completed, 0)
  assert.equal(result.total, 1)
  assert.equal(result.progress, 0)
  assert.equal(getDailyTaskSummary([], today).progress, 0)
})

test('uses the local calendar day at midnight boundaries', () => {
  const time = new Date(2026, 8, 9, 0, 15).toISOString()
  assert.equal(getDailyTaskSummary([done('2026-09-08', time)], today).completed, 1)
})
