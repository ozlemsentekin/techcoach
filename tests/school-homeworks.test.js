import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { getStudentNav, getParentNav, navToMobile } from '../src/panels/layout/navConfig.js'
const require = createRequire(import.meta.url)
const { sanitizeSchoolHomework } = require('../api/src/schoolHomeworks.js')

test('Okul Ödevleri menüsü yalnızca okul ödevi olan öğrenci/velide görünür', () => {
  for (const config of [flag => getStudentNav({ schoolHomeworksEnabled: flag }), flag => getParentNav({ schoolHomeworksEnabled: flag })]) {
    const has = nav => navToMobile(nav).more.some(i => i.label === 'Okul Ödevleri')
    assert.equal(has(config(false)), false)
    assert.equal(has(config(true)), true)
  }
  assert.equal(getParentNav({ hasStudents: false, schoolHomeworksEnabled: true }).some(i => i.label === 'Okul Ödevleri'), false)
})

test('okul ödevi satırı genel başlığı açıklamayla değiştirir ve veriliş tarihine düşer', () => {
  const base = { id: 'x', subject_name: 'Matematik', status: 'bekliyor', created_at: new Date('2026-10-01T09:00:00Z'), date: new Date('2026-10-03T00:00:00Z'), is_unscheduled: false }
  const generic = sanitizeSchoolHomework({ ...base, title: 'Matematik Ödevi', description: 'Sayfa 40-42', school_resource_name: 'Okul Kitabı', publisher_name: 'X' })
  assert.equal(generic.title, 'Sayfa 40-42')
  assert.equal(generic.description, '')
  assert.equal(generic.assignedDate, '2026-10-01')
  assert.equal(generic.resourceName, 'Okul Kitabı')
  assert.equal(generic.publisherName, null)
  const custom = sanitizeSchoolHomework({ ...base, title: 'Okul Ödevi', description: 'Not', assigned_date: new Date('2026-09-30T00:00:00Z'), subject_name: null })
  assert.equal(custom.title, 'Okul Ödevi')
  assert.equal(custom.description, 'Not')
  assert.equal(custom.subjectName, 'Diğer')
  assert.equal(custom.assignedDate, '2026-09-30')
})

test('görev ekleri: çoklu liste doğrulanır, eski tekil ek listeye çevrilir', () => {
  const { sanitizeTaskAttachments, applyTaskAttachmentsPayload } = require('../api/src/tasks.js')
  const png = { url: 'data:image/png;base64,aGVsbG8=', name: 'a.png' }
  const pdf = { url: 'data:application/pdf;base64,aGVsbG8=', name: 'b.pdf' }
  assert.deepEqual(sanitizeTaskAttachments([png, pdf]).attachments.map(a => a.name), ['a.png', 'b.pdf'])
  assert.ok(sanitizeTaskAttachments(Array(6).fill(png)).error)
  assert.ok(sanitizeTaskAttachments([{ url: 'data:image/svg+xml;base64,aGVsbG8=', name: 'x.svg' }]).error)
  const legacy = { attachmentUrl: png.url, attachmentName: 'a.png' }
  assert.equal(applyTaskAttachmentsPayload(legacy), null)
  assert.deepEqual(legacy.attachments, [png])
  assert.equal(legacy.attachmentUrl, null)
  const untouched = { title: 'x' }
  applyTaskAttachmentsPayload(untouched)
  assert.equal('attachments' in untouched, false)
})
