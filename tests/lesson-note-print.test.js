import test from 'node:test'
import assert from 'node:assert/strict'
import { printLessonNote } from '../src/utils/printLessonNote.js'

test('printing waits for all images and preserves their page order', async () => {
  const original = globalThis.window
  const images = []
  let printed = 0
  const createElement = tag => {
    const element = { tag, children: [], append(...children) { this.children.push(...children) } }
    if (tag === 'img') images.push(element)
    return element
  }
  const doc = { documentElement: {}, head: createElement('head'), body: createElement('body'), createElement }
  globalThis.window = { open: () => ({ document: doc, focus() {}, print() { printed++ } }) }
  try {
    const pending = printLessonNote({ title: '<b>Türkçe</b>', images: ['first', 'second'] })
    assert.deepEqual(images.map(i => i.src), ['first', 'second'])
    images[1].onload()
    await Promise.resolve()
    assert.equal(printed, 0)
    images[0].onload()
    await pending
    assert.equal(printed, 1)
    assert.equal(doc.title, '<b>Türkçe</b>')
  } finally { globalThis.window = original }
})

test('a blocked print window gives an actionable error', async () => {
  const original = globalThis.window
  globalThis.window = { open: () => null }
  try { await assert.rejects(printLessonNote({ title: 'Türkçe', images: [] }), /açılır pencere izni/) }
  finally { globalThis.window = original }
})
