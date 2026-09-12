import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { getStudentNav, getParentNav, getTeacherNav, navToMobile } from '../src/panels/layout/navConfig.js'
const require = createRequire(import.meta.url)
const { validateNote } = require('../api/src/lessonNotes.js')
const valid = { grade: '8', subjectId: '12345678-1234-1234-1234-123456789abc', title: 'Sözcükte Anlam', weekStart: '2026-09-07', weekEnd: '2026-09-11', topics: ['Gerçek, Yan, Mecaz, Terim Anlam'], images: ['data:image/png;base64,aGVsbG8='] }
test('weekly note validates dates, two-level topics and image limits', () => {
  assert.equal(validateNote(valid), null)
  for (const change of [{ grade: '13' }, { subjectId: 'bad' }, { title: ' ' }, { weekEnd: '2026-09-06' }, { weekStart: '2026-02-30' }, { topics: [] }, { topics: [['nested']] }, { images: ['https://example.com/image.png'] }, { images: ['data:image/svg+xml;base64,abcd'] }, { images: Array(21).fill(valid.images[0]) }]) assert.ok(validateNote({ ...valid, ...change }))
})
test('workspace is opt-in for all roles and included in mobile navigation', () => {
  const configs = [flag => getStudentNav({ lessonNotesEnabled: flag }), flag => getParentNav({ lessonNotesEnabled: flag }), flag => getTeacherNav(false, flag)]
  for (const config of configs) {
    assert.equal(config(false).some(i => i.key === 'calisma-alani'), false)
    assert.equal(config(true).some(i => i.key === 'calisma-alani'), true)
    assert.ok(navToMobile(config(true)).more.some(i => i.label === 'Ders Notları'))
  }
})

test('API denies other grades/branches and requires admin for writes', async () => {
  const paths = ['db', 'security', 'studentScope', 'teacherScope', 'admin', 'lessonNotes'].map(name => require.resolve(`../api/src/${name}.js`))
  const originals = paths.map(path => require.cache[path])
  let contexts = [{ grade: '8', subjectId: valid.subjectId }]
  let role = 'ogretmen'
  let noteReads = 0
  const inject = (index, exports) => { require.cache[paths[index]] = { id: paths[index], filename: paths[index], loaded: true, exports } }
  inject(0, { sql: { UniqueIdentifier: 'id', NVarChar: () => 'text' }, withRequest: async () => ({ query: async query => {
    if (query.includes('FROM dbo.LessonNotes')) { noteReads++; return { recordset: [] } }
    if (query.includes('FROM dbo.Subjects')) return { recordset: [{ id: valid.subjectId, name: 'Türkçe', grades_json: '[7,8]' }, { id: 'other', name: 'Matematik', grades_json: '[8]' }] }
    return { recordset: contexts }
  } }) })
  inject(1, { readSessionToken: () => 'token', verifySessionToken: () => ({ role, sub: 'user' }), isSessionError: () => false })
  inject(2, { requireStudentContext: async () => ({ studentId: 'child' }) })
  inject(3, { requireTeacherSession: async () => ({ teacherUserId: 'teacher' }) })
  inject(4, { requireAdmin: async () => ({ error: { status: 403 } }) })
  delete require.cache[paths[5]]
  try {
    const api = require(paths[5])
    const request = query => ({ query: new URLSearchParams(query), params: {} })
    assert.equal((await api.panelLessonNotes(request(`grade=7&subjectId=${valid.subjectId}`))).status, 403)
    assert.equal((await api.panelLessonNotes(request('grade=8&subjectId=other'))).status, 403)
    assert.equal(noteReads, 0)
    assert.equal((await api.panelLessonNotes(request(`grade=8&subjectId=${valid.subjectId}`))).status, 200)
    assert.equal(noteReads, 1)
    contexts = []; role = 'ogrenci'
    assert.equal((await api.panelLessonNotes(request(`grade=8&subjectId=${valid.subjectId}`))).status, 403)
    assert.equal(noteReads, 1)
    assert.equal((await api.saveLessonNote(request(''))).status, 403)
    assert.equal((await api.deleteLessonNote(request(''))).status, 403)
  } finally {
    paths.forEach((path, i) => { if (originals[i]) require.cache[path] = originals[i]; else delete require.cache[path] })
  }
})
