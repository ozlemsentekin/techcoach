import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { validateMockExamPayload, GENEL_DENEME_TEMPLATE, computeNet } = require('../api/src/mockExams.js')

const PHOTO = `data:image/png;base64,${'A'.repeat(40)}`

test('Branş İzleme: 20 soru toplamı zorunlu, tarih zorunlu', () => {
  const ok = validateMockExamPayload({
    kind: 'brans',
    examDate: '2026-09-10',
    subjects: [{ subjectName: 'Matematik', correct: 15, wrong: 3, blank: 2 }],
  })
  assert.equal(ok.error, undefined)
  assert.equal(ok.value.subjects[0].totalQuestions, 20)

  assert.match(
    validateMockExamPayload({
      kind: 'brans',
      examDate: '2026-09-10',
      subjects: [{ subjectName: 'Matematik', correct: 15, wrong: 3, blank: 5 }],
    }).error || '',
    /20 olmalı/,
  )

  assert.match(
    validateMockExamPayload({
      kind: 'brans',
      subjects: [{ subjectName: 'Matematik', correct: 20, wrong: 0, blank: 0 }],
    }).error || '',
    /tarih/i,
  )
})

test('Branş İzleme: boş otomatik hesaplanır', () => {
  const result = validateMockExamPayload({
    kind: 'brans',
    examDate: '2026-09-10',
    subjects: [{ subjectName: 'Fen Bilimleri', correct: 12, wrong: 4 }],
  })
  assert.equal(result.error, undefined)
  assert.equal(result.value.subjects[0].blank, 4)
})

test('Genel Deneme: 6 ders şablonu, ders başına sabit soru sayısı', () => {
  const result = validateMockExamPayload({
    kind: 'genel',
    examDate: '2026-09-10',
    subjects: GENEL_DENEME_TEMPLATE.map((tpl) => ({
      subjectName: tpl.name,
      correct: tpl.total,
      wrong: 0,
      blank: 0,
    })),
  })
  assert.equal(result.error, undefined)
  assert.equal(result.value.subjects.length, 6)
  assert.deepEqual(
    result.value.subjects.map((s) => s.totalQuestions),
    [20, 20, 20, 10, 10, 10],
  )
})

test('Etüt: tarih opsiyonel; toplam = doğru + yanlış + boş, 20 sınırı yok', () => {
  const result = validateMockExamPayload({
    kind: 'etut',
    subjects: [{ subjectName: 'Türkçe', correct: 30, wrong: 10, blank: 5 }],
  })
  assert.equal(result.error, undefined)
  assert.equal(result.value.examDate, null)
  assert.equal(result.value.subjects[0].totalQuestions, 45)

  // Hiç cevap yoksa geçersiz.
  assert.match(
    validateMockExamPayload({
      kind: 'etut',
      subjects: [{ subjectName: 'Türkçe', correct: 0, wrong: 0, blank: 0 }],
    }).error || '',
    /1 ile 200/,
  )
})

test('Fotoğraf sayısı yanlış + boş sayısını aşamaz', () => {
  const result = validateMockExamPayload({
    kind: 'brans',
    examDate: '2026-09-10',
    subjects: [{ subjectName: 'Matematik', correct: 19, wrong: 1, blank: 0, photos: [PHOTO, PHOTO] }],
  })
  assert.match(result.error || '', /aşamaz/)
})

test('computeNet: LGS neti (3 yanlış = 1 doğru)', () => {
  assert.equal(computeNet(10, 0), 10)
  assert.equal(computeNet(10, 3), 9)
})
