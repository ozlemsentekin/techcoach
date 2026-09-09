import test from 'node:test'
import assert from 'node:assert/strict'
import { getTaskMistakeSummary } from '../src/utils/taskMistakeSummary.js'

test('counts wrong and blank once, matching uploaded photos to their task', () => {
  const tasks = [{ id: 'a', wrongCount: 2, blankCount: 1, testResults: { t: { wrong: 2, blank: 1 } } },
    { id: 'b', testResults: { t: { wrong: 1, blank: 1 } } }]
  const photo = { taskId: 'a', testId: 't', questionNumber: 1, hasPhoto: true }
  assert.deepEqual(getTaskMistakeSummary(tasks, [photo, photo,
    { taskId: 'other', testId: 't', questionNumber: 2, hasPhoto: true },
    { taskId: 'b', testId: 't', questionNumber: 1, hasPhoto: false },
  ]), { total: 5, missingPhotos: 4 })
})
test('does not present unavailable photo data as zero', () => {
  assert.deepEqual(getTaskMistakeSummary([{ wrongCount: 2 }], null), { total: 2, missingPhotos: null })
  assert.deepEqual(getTaskMistakeSummary([], []), { total: 0, missingPhotos: 0 })
})
