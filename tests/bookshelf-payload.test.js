import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { validateBookPayload } = require('../api/src/bookshelf.js')
const base = { name: 'Test kitabı', subjectId: 'math', grade: '8', contentMode: 'structured' }

test('structured books require a valid resource type', () => {
  for (const type of [undefined, '', 'invalid']) {
    assert.match(validateBookPayload({ ...base, type }).error, /Kaynak tipi/)
  }
})

test('answer key is derived from resource type, including when editing an old flag', () => {
  for (const [type, expected] of [['soru_bankasi', true], ['etkinlik', true], ['konu_anlatimi', false], ['okuma_kitabi', false]]) {
    for (const hasAnswerKey of [undefined, true, false]) {
      const result = validateBookPayload({ ...base, type, hasAnswerKey })
      assert.equal(result.error, undefined)
      assert.equal(result.value.hasAnswerKey, expected, `${type}, incoming flag: ${hasAnswerKey}`)
    }
  }
})

test('simple books keep manual results regardless of the submitted type or answer-key flag', () => {
  for (const type of [undefined, 'etkinlik', 'soru_bankasi']) {
    const result = validateBookPayload({ ...base, contentMode: 'simple', type, hasAnswerKey: true })
    assert.equal(result.value.type, 'soru_bankasi')
    assert.equal(result.value.hasAnswerKey, false)
  }
})
