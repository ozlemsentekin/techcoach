import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  validateMockExamPayload,
  GENEL_DENEME_TEMPLATE,
  computeNet,
  examVisibleToTeacher,
  normalizeExperiencePayload,
  pickEligiblePreviousExam,
} = require('../api/src/mockExams.js')

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

test('examVisibleToTeacher: Genel Deneme her zaman görünür', () => {
  const exam = { kind: 'genel', subjects: [{ subjectId: 'math-id', subjectName: 'Matematik' }] }
  assert.equal(examVisibleToTeacher(exam, { subjectId: 'other-id', subjectName: 'Türkçe' }), true)
  assert.equal(examVisibleToTeacher(exam, { subjectId: null, subjectName: null }), true)
})

test('examVisibleToTeacher: Branş/Etüt sadece öğretmenin dersiyle eşleşince görünür', () => {
  const matematikExam = { kind: 'brans', subjects: [{ subjectId: 'math-id', subjectName: 'Matematik' }] }
  const turkceExam = { kind: 'etut', subjects: [{ subjectId: 'tr-id', subjectName: 'Türkçe' }] }

  assert.equal(examVisibleToTeacher(matematikExam, { subjectId: 'math-id', subjectName: 'Matematik' }), true)
  assert.equal(examVisibleToTeacher(turkceExam, { subjectId: 'math-id', subjectName: 'Matematik' }), false)
  // İsimle eşleşme (subjectId eşleşmese/olmasa bile).
  assert.equal(examVisibleToTeacher(matematikExam, { subjectId: null, subjectName: 'Matematik' }), true)
})

test('examVisibleToTeacher: öğretmenin ders ataması yoksa (subject_id NULL) kısıtlama uygulanmaz', () => {
  const turkceExam = { kind: 'brans', subjects: [{ subjectId: 'tr-id', subjectName: 'Türkçe' }] }
  assert.equal(examVisibleToTeacher(turkceExam, { subjectId: null, subjectName: null }), true)
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

test('normalizeExperiencePayload: mood zorunlu', () => {
  assert.match(normalizeExperiencePayload({}).error || '', /Sınav duygusu/)
  assert.match(normalizeExperiencePayload({ mood: 'gecersiz' }).error || '', /Sınav duygusu/)
  const result = normalizeExperiencePayload({ mood: 'rahat' })
  assert.equal(result.error, undefined)
  assert.equal(result.value.mood, 'rahat')
  assert.deepEqual(result.value.tags, [])
  assert.equal(result.value.learningNote, null)
  assert.equal(result.value.nextAction, null)
  assert.equal(result.value.previousActionReview, null)
})

test('normalizeExperiencePayload: tags allow-list dışı reddedilir, dedupe edilir', () => {
  assert.match(
    normalizeExperiencePayload({ mood: 'iyi', tags: ['gecersiz_kod'] }).error || '',
    /Geçersiz deneyim etiketi/,
  )
  const result = normalizeExperiencePayload({
    mood: 'iyi',
    tags: ['sure_yetismedi', 'dikkat_dagildi', 'sure_yetismedi'],
  })
  assert.equal(result.error, undefined)
  assert.deepEqual(result.value.tags, ['sure_yetismedi', 'dikkat_dagildi'])
})

test('normalizeExperiencePayload: learningNote/nextAction karakter sınırına kesilir', () => {
  const result = normalizeExperiencePayload({
    mood: 'karisik',
    learningNote: 'a'.repeat(600),
    nextAction: 'b'.repeat(400),
  })
  assert.equal(result.error, undefined)
  assert.equal(result.value.learningNote.length, 500)
  assert.equal(result.value.nextAction.length, 300)
})

test('normalizeExperiencePayload: previousActionReview yalnızca evet/kismen/hayir kabul eder', () => {
  assert.match(
    normalizeExperiencePayload({ mood: 'iyi', previousActionReview: 'belki' }).error || '',
    /Geçersiz değerlendirme/,
  )
  const result = normalizeExperiencePayload({ mood: 'iyi', previousActionReview: 'kismen' })
  assert.equal(result.error, undefined)
  assert.equal(result.value.previousActionReview, 'kismen')
})

test('pickEligiblePreviousExam: kronolojik olarak önceki, nextAction dolu en yakın kaydı bulur', () => {
  const examList = [
    { id: 'e1', sortDate: '2026-09-01', createdAt: '2026-09-01T10:00:00.000Z', nextAction: 'İlk hedef' },
    { id: 'e2', sortDate: '2026-09-05', createdAt: '2026-09-05T10:00:00.000Z', nextAction: null },
    { id: 'e3', sortDate: '2026-09-10', createdAt: '2026-09-10T10:00:00.000Z', nextAction: 'İkinci hedef' },
  ]
  // e3'ten önceki en yakın nextAction'lı kayıt e2 değil (boş), e1'dir.
  const result = pickEligiblePreviousExam(examList, 'e3')
  assert.equal(result.id, 'e1')
})

test('pickEligiblePreviousExam: araya sonradan eklenen deneme doğru şekilde bulunur', () => {
  const examList = [
    { id: 'e1', sortDate: '2026-09-01', createdAt: '2026-09-01T10:00:00.000Z', nextAction: 'İlk hedef' },
    { id: 'e2', sortDate: '2026-09-10', createdAt: '2026-09-10T10:00:00.000Z', nextAction: 'İkinci hedef' },
  ]
  // e1-e2 arasına, e1'den sonra ama e2'den önce bir kayıt eklendi.
  const withInserted = [
    ...examList,
    { id: 'e1b', sortDate: '2026-09-05', createdAt: '2026-09-05T10:00:00.000Z', nextAction: 'Ara hedef' },
  ]
  assert.equal(pickEligiblePreviousExam(withInserted, 'e2').id, 'e1b')
})

test('pickEligiblePreviousExam: uygun kayıt yoksa veya mevcut denemeyse null döner', () => {
  const examList = [{ id: 'e1', sortDate: '2026-09-01', createdAt: '2026-09-01T10:00:00.000Z', nextAction: null }]
  assert.equal(pickEligiblePreviousExam(examList, 'e1'), null)
  assert.equal(pickEligiblePreviousExam(examList, 'not-in-list'), null)
})
