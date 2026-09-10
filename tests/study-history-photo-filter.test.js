import test from 'node:test'
import assert from 'node:assert/strict'
import { matchesMissingPhotoHistory } from '../src/utils/studyHistoryPhotoFilter.js'
const item = { source: 'task', taskId: 'a', testId: 't', completedAt: '2026-09-10T12:00:00', occurredAt: '2026-09-09T12:00:00', wrong: 1, blank: 1 }
const filter = { completedOn: '2026-09-10', taskIds: ['a'] }
test('includes partially uploaded work by completion date and excludes fully uploaded work', () => {
  const photo = { taskId: 'a', testId: 't', questionNumber: 1, hasPhoto: true }
  assert.equal(matchesMissingPhotoHistory(item, filter, []), true)
  assert.equal(matchesMissingPhotoHistory(item, filter, [photo, photo]), true)
  assert.equal(matchesMissingPhotoHistory(item, filter, [photo, { ...photo, questionNumber: 2 }]), false)
  assert.equal(matchesMissingPhotoHistory({ ...item, completedAt: '2026-09-09T12:00:00' }, filter, []), false)
  assert.equal(matchesMissingPhotoHistory({ ...item, taskId: 'b' }, filter, []), false)
})
