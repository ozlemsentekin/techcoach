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

test('Soru bazlı giriş: durumlardan doğru/yanlış/boş türetilir', () => {
  const result = validateMockExamPayload({
    kind: 'brans',
    examDate: '2026-09-10',
    subjects: [
      {
        subjectName: 'Matematik',
        questions: Array.from({ length: 20 }, (_, i) => ({
          orderNo: i + 1,
          status: i < 15 ? 'dogru' : i < 18 ? 'yanlis' : 'bos',
          topicName: i < 15 ? 'Çarpanlar' : undefined,
        })),
      },
    ],
  })
  assert.equal(result.error, undefined)
  const subject = result.value.subjects[0]
  assert.equal(subject.correct, 15)
  assert.equal(subject.wrong, 3)
  assert.equal(subject.blank, 2)
  assert.equal(subject.questions.length, 20)
  assert.equal(subject.questions[0].topicName, 'Çarpanlar')
  assert.equal(subject.questions[19].topicName, null)
})

test('Soru bazlı giriş: satır sayısı toplamdan farklıysa reddedilir', () => {
  const result = validateMockExamPayload({
    kind: 'brans',
    examDate: '2026-09-10',
    subjects: [
      {
        subjectName: 'Matematik',
        questions: Array.from({ length: 19 }, (_, i) => ({ orderNo: i + 1, status: 'dogru' })),
      },
    ],
  })
  assert.match(result.error || '', /20 olmalı/)
})

test('Soru bazlı giriş: geçersiz durum reddedilir', () => {
  const result = validateMockExamPayload({
    kind: 'brans',
    examDate: '2026-09-10',
    subjects: [
      {
        subjectName: 'Matematik',
        questions: Array.from({ length: 20 }, (_, i) => ({ orderNo: i + 1, status: i === 0 ? 'yanlis-mi' : 'dogru' })),
      },
    ],
  })
  assert.match(result.error || '', /durum geçersiz/)
})

test('Soru bazlı giriş: tekrar eden soru numarası reddedilir', () => {
  const result = validateMockExamPayload({
    kind: 'brans',
    examDate: '2026-09-10',
    subjects: [
      {
        subjectName: 'Matematik',
        questions: Array.from({ length: 20 }, (_, i) => ({ orderNo: i === 1 ? 1 : i + 1, status: 'dogru' })),
      },
    ],
  })
  assert.match(result.error || '', /tekrar edemez/)
})

test('Soru bazlı giriş: Genel Deneme her ders için ayrı ayrı çalışır', () => {
  const result = validateMockExamPayload({
    kind: 'genel',
    examDate: '2026-09-10',
    subjects: GENEL_DENEME_TEMPLATE.map((tpl) => ({
      subjectName: tpl.name,
      questions: Array.from({ length: tpl.total }, (_, i) => ({ orderNo: i + 1, status: 'dogru' })),
    })),
  })
  assert.equal(result.error, undefined)
  result.value.subjects.forEach((s, idx) => {
    assert.equal(s.correct, GENEL_DENEME_TEMPLATE[idx].total)
    assert.equal(s.questions.length, GENEL_DENEME_TEMPLATE[idx].total)
  })
})

test('Soru bazlı giriş: Etüt soru sayısını kendi belirler', () => {
  const result = validateMockExamPayload({
    kind: 'etut',
    subjects: [
      {
        subjectName: 'Türkçe',
        questions: Array.from({ length: 7 }, (_, i) => ({ orderNo: i + 1, status: i < 5 ? 'dogru' : 'yanlis' })),
      },
    ],
  })
  assert.equal(result.error, undefined)
  assert.equal(result.value.subjects[0].totalQuestions, 7)
  assert.equal(result.value.subjects[0].correct, 5)
  assert.equal(result.value.subjects[0].wrong, 2)
})
