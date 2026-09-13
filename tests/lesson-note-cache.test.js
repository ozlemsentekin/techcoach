import test from 'node:test'
import assert from 'node:assert/strict'
import { createLessonNoteCache } from '../src/utils/lessonNoteCache.js'

test('image cache reuses recent notes, expires and isolates viewer instances', () => {
  let clock = 0
  const cache = createLessonNoteCache({ ttlMs: 60, now: () => clock })
  const note = { images: ['image'] }
  cache.set('8:subject:note', note)
  assert.equal(cache.get('8:subject:note'), note)
  assert.equal(createLessonNoteCache().get('8:subject:note'), null)
  clock = 60
  assert.equal(cache.get('8:subject:note'), null)
})
test('image cache bounds memory, evicts least recently used notes and clears on edits', () => {
  const cache = createLessonNoteCache({ maxCharacters: 8 })
  cache.set('a', { images: ['1234'] }); cache.set('b', { images: ['5678'] })
  cache.get('a')
  cache.set('c', { images: ['abcd'] })
  assert.equal(cache.get('b'), null)
  assert.ok(cache.get('a'))
  cache.set('large', { images: ['123456789'] })
  assert.equal(cache.get('large'), null)
  cache.clear()
  assert.equal(cache.get('a'), null)
  assert.equal(cache.get('c'), null)
})
