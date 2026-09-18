const { sql, withRequest, withTransaction } = require('./db')
const { isConfigError } = require('./config')
const { json } = require('./http')
const { isSessionError } = require('./security')
const { requireStudentContext, requireStudentWriteContext } = require('./studentScope')
const { requireTeacherSession, requireTeacherStudentContext } = require('./teacherScope')
const { sanitizeMistakePhoto } = require('./mistakePhoto')

const MOCK_EXAM_KINDS = ['brans', 'genel', 'etut']
const BRANS_QUESTION_COUNT = 20
const MAX_ETUT_QUESTIONS = 200
const MOCK_EXAM_WRONG_BOOK_NAME = 'Deneme Sınavları'
const MOCK_EXAM_ERROR_TYPE = 'deneme'
const QUESTION_STATUSES = ['dogru', 'yanlis', 'bos']

// Genel Deneme (LGS) sabit ders şablonu — sıralama ve soru sayıları sunucu tarafında
// zorunludur; istemcinin gönderdiği total değerlerine güvenilmez. subject_id, panel
// ders listesinden (dbo.Subjects) isimle eşleştirilir; eşleşmezse isimle saklanır.
const GENEL_DENEME_TEMPLATE = [
  { name: 'Türkçe', total: 20 },
  { name: 'Matematik', total: 20 },
  { name: 'Fen Bilimleri', total: 20 },
  { name: 'T.C. İnkılap Tarihi ve Atatürkçülük', total: 10 },
  { name: 'Din Kültürü ve Ahlak Bilgisi', total: 10 },
  { name: 'İngilizce', total: 10 },
]

// Sınav Deneyimi Analizi — öğrencinin denemeden sonraki duygu durumu, deneyim etiketleri,
// öğrenme notu ve bir sonraki hedefi. Kodlar (değer stringleri) DB'de CHECK constraint'siz
// tutulur; yeni bir seçenek eklemek sadece bu listeye ekleme (+ mockExamConfig.js'teki
// istemci kopyası) demektir, migration gerekmez.
const EXPERIENCE_MOODS = ['rahat', 'iyi', 'karisik', 'zorlandim', 'stresli']
const EXPERIENCE_TAG_CODES = [
  'sure_iyi_yonettim',
  'sure_yetismedi',
  'fazla_zaman_harcadim',
  'dikkat_dagildi',
  'acele_ettim',
  'yanlis_okudum',
  'optik_kaydirdim',
  'optige_aktarirken_zorlandim',
  'son_kontrol_yapabildim',
  'son_kontrol_yapamadim',
  'bir_derste_zorlandim',
  'odagimi_koruyabildim',
]
const EXPERIENCE_REVIEW_ANSWERS = ['evet', 'kismen', 'hayir']
const GROWTH_SUMMARY_WINDOW = 5
const GROWTH_SUMMARY_MIN_EXAMS = 3

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isGuid(value) {
  return typeof value === 'string' && GUID_PATTERN.test(value.trim())
}

// Ders adı eşleştirmesi için: küçük harf + fazla boşlukları sadeleştir.
function normalizeSubjectName(value) {
  return String(value || '')
    .toLocaleLowerCase('tr')
    .replace(/\s+/g, ' ')
    .trim()
}

// Branş İzleme / Etüt: öğretmenin belirli bir derse atanmış olması durumunda (subjectId/subjectName
// dolu) yalnızca kendi dersine ait sonucu görür. Ders ataması olmayan (tüm dersleri takip eden)
// öğretmen için kısıtlama uygulanmaz. Genel Deneme her zaman görünür.
function examVisibleToTeacher(exam, { subjectId, subjectName }) {
  if (exam.kind === 'genel') return true
  const normalizedRestrictName = subjectName ? normalizeSubjectName(subjectName) : null
  const restricted = Boolean(subjectId || normalizedRestrictName)
  if (!restricted) return true
  const subject = exam.subjects[0]
  if (!subject) return false
  if (subjectId && subject.subjectId && String(subject.subjectId).toLowerCase() === String(subjectId).toLowerCase()) {
    return true
  }
  return normalizedRestrictName ? normalizeSubjectName(subject.subjectName) === normalizedRestrictName : false
}

function toISODate(value) {
  if (!value) return null
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
}

// LGS neti: 4 yanlış 1 doğruyu götürür.
function computeNet(correct, wrong) {
  return Math.round((correct - wrong / 3) * 100) / 100
}

function nonNegInt(value) {
  const n = Number(value)
  return Number.isInteger(n) && n >= 0 ? n : null
}

// Karşılaştırma alanları (puan, sıra, ortalamalar) hepsi isteğe bağlıdır — boş/undefined
// bırakılırsa satır eski basit moddaki gibi kalır, yalnızca dolu değerler doğrulanır.
function optionalDecimal(value) {
  if (value === undefined || value === null || value === '') return { value: null }
  const n = Number(value)
  if (!Number.isFinite(n)) return { error: true }
  return { value: Math.round(n * 100) / 100 }
}

function optionalPositiveInt(value) {
  if (value === undefined || value === null || value === '') return { value: null }
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) return { error: true }
  return { value: n }
}

// Sınav kurumu raporlarındaki (PDF/portal) ders bazlı puan + şube/okul/genel sıra + sınıf/okul/
// Türkiye ortalaması — "Detay" bölümünden isteğe bağlı girilir.
function normalizeComparisonStats(row) {
  const score = optionalDecimal(row?.score)
  if (score.error) return { error: 'Puan geçersiz.' }
  const branchRank = optionalPositiveInt(row?.branchRank)
  if (branchRank.error) return { error: 'Şube sırası geçersiz.' }
  const schoolRank = optionalPositiveInt(row?.schoolRank)
  if (schoolRank.error) return { error: 'Okul sırası geçersiz.' }
  const overallRank = optionalPositiveInt(row?.overallRank)
  if (overallRank.error) return { error: 'Genel sıra geçersiz.' }
  const classAvgScore = optionalDecimal(row?.classAvgScore)
  if (classAvgScore.error) return { error: 'Sınıf ortalaması geçersiz.' }
  const schoolAvgScore = optionalDecimal(row?.schoolAvgScore)
  if (schoolAvgScore.error) return { error: 'Okul ortalaması geçersiz.' }
  const turkeyAvgScore = optionalDecimal(row?.turkeyAvgScore)
  if (turkeyAvgScore.error) return { error: 'Türkiye ortalaması geçersiz.' }
  return {
    value: {
      score: score.value,
      branchRank: branchRank.value,
      schoolRank: schoolRank.value,
      overallRank: overallRank.value,
      classAvgScore: classAvgScore.value,
      schoolAvgScore: schoolAvgScore.value,
      turkeyAvgScore: turkeyAvgScore.value,
    },
  }
}

// Konu grubu bazında karşılaştırma: [{ topicName, score?, classAvgScore?, schoolAvgScore?,
// turkeyAvgScore? }] — sınav kurumu raporundaki konu grubu (ör. "Sözcük Grubunda Anlam")
// dağılımı, tamamen isteğe bağlı. Dizi boş/yoksa null döner (satır hiç girilmemiş demektir).
function normalizeTopicComparisons(rawRows) {
  if (!Array.isArray(rawRows) || rawRows.length === 0) return { value: null }
  const rows = []
  for (let i = 0; i < rawRows.length; i += 1) {
    const raw = rawRows[i] || {}
    const topicName = typeof raw.topicName === 'string' ? raw.topicName.trim().slice(0, 200) : ''
    if (!topicName) return { error: `${i + 1}. konu grubu için ad zorunludur.` }
    const score = optionalDecimal(raw.score)
    if (score.error) return { error: `${topicName}: puan geçersiz.` }
    const classAvgScore = optionalDecimal(raw.classAvgScore)
    if (classAvgScore.error) return { error: `${topicName}: sınıf ortalaması geçersiz.` }
    const schoolAvgScore = optionalDecimal(raw.schoolAvgScore)
    if (schoolAvgScore.error) return { error: `${topicName}: okul ortalaması geçersiz.` }
    const turkeyAvgScore = optionalDecimal(raw.turkeyAvgScore)
    if (turkeyAvgScore.error) return { error: `${topicName}: Türkiye ortalaması geçersiz.` }
    rows.push({
      orderNo: i + 1,
      topicName,
      score: score.value,
      classAvgScore: classAvgScore.value,
      schoolAvgScore: schoolAvgScore.value,
      turkeyAvgScore: turkeyAvgScore.value,
    })
  }
  return { value: rows }
}

// Soru bazlı giriş: [{ orderNo?, status, topicName? }] × total. Dizi boş/yoksa null döner
// (o subject eski basit modda kalır). Dolu ama uzunluk/durum hatalıysa error döner.
function normalizeQuestions(rawQuestions, total) {
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) return { value: null }
  if (rawQuestions.length !== total) {
    return { error: `Soru bazlı girişte satır sayısı ${total} olmalı.` }
  }
  const seenOrder = new Set()
  const questions = []
  for (let i = 0; i < rawQuestions.length; i += 1) {
    const raw = rawQuestions[i] || {}
    const status = typeof raw.status === 'string' ? raw.status.trim() : ''
    if (!QUESTION_STATUSES.includes(status)) {
      return { error: `${i + 1}. soru için durum geçersiz.` }
    }
    let orderNo = nonNegInt(raw.orderNo)
    if (orderNo === null || orderNo < 1 || orderNo > total) orderNo = i + 1
    if (seenOrder.has(orderNo)) {
      return { error: 'Soru numaraları tekrar edemez.' }
    }
    seenOrder.add(orderNo)
    const topicName = typeof raw.topicName === 'string' ? raw.topicName.trim().slice(0, 200) : ''
    questions.push({ orderNo, status, topicName: topicName || null })
  }
  questions.sort((a, b) => a.orderNo - b.orderNo)
  const counts = { correct: 0, wrong: 0, blank: 0 }
  for (const q of questions) {
    if (q.status === 'dogru') counts.correct += 1
    else if (q.status === 'yanlis') counts.wrong += 1
    else counts.blank += 1
  }
  return { value: { questions, counts } }
}

// { mood, tags?: string[], learningNote?, nextAction?, previousActionReview? }
// mood zorunlu (deneyim kaydı en az duygu seçilerek "tamamlanmış" sayılır); diğer alanlar
// opsiyonel. tags allow-list dışı bir kod içeremez, dedupe edilir.
function normalizeExperiencePayload(payload) {
  const mood = typeof payload?.mood === 'string' ? payload.mood.trim() : ''
  if (!EXPERIENCE_MOODS.includes(mood)) {
    return { error: 'Sınav duygusu seçilmelidir.' }
  }

  const rawTags = Array.isArray(payload?.tags) ? payload.tags : []
  const seenTags = new Set()
  const tags = []
  for (const raw of rawTags) {
    const tag = typeof raw === 'string' ? raw.trim() : ''
    if (!tag) continue
    if (!EXPERIENCE_TAG_CODES.includes(tag)) {
      return { error: 'Geçersiz deneyim etiketi.' }
    }
    if (seenTags.has(tag)) continue
    seenTags.add(tag)
    tags.push(tag)
  }

  const learningNote =
    typeof payload?.learningNote === 'string' ? payload.learningNote.trim().slice(0, 500) || null : null
  const nextAction = typeof payload?.nextAction === 'string' ? payload.nextAction.trim().slice(0, 300) || null : null

  let previousActionReview = null
  if (payload?.previousActionReview != null) {
    const review = typeof payload.previousActionReview === 'string' ? payload.previousActionReview.trim() : ''
    if (!EXPERIENCE_REVIEW_ANSWERS.includes(review)) {
      return { error: 'Geçersiz değerlendirme.' }
    }
    previousActionReview = review
  }

  return { value: { mood, tags, learningNote, nextAction, previousActionReview } }
}

// Kronolojik sıralama anahtarı: sınav tarihi (yoksa oluşturulma tarihi) + oluşturulma zamanı +
// id — string karşılaştırmasıyla listMockExamsForStudent'taki DESC sıralamayla birebir aynı
// sırayı üretir (bkz. o sorgudaki ORDER BY).
function examSortKey(exam) {
  return `${exam.sortDate}T${exam.createdAt}#${exam.id}`
}

// Saf, DB'siz yardımcı: examList (herhangi bir sırada, her biri { id, sortDate, createdAt,
// nextAction }) içinde currentExamId'den kronolojik olarak ÖNCE gelen, experience_next_action
// dolu olan EN YAKIN kaydı bulur — "bir önceki denemede yazdığın hedef" eşleştirmesi budur.
// Test edilebilir olması için SQL'in dışında tutulur (bkz. findPendingPreviousGoal).
function pickEligiblePreviousExam(examList, currentExamId) {
  const sorted = [...examList].sort((a, b) => {
    const ak = examSortKey(a)
    const bk = examSortKey(b)
    if (ak === bk) return 0
    return ak > bk ? -1 : 1 // DESC: en yeni önce
  })
  const currentIndex = sorted.findIndex((exam) => exam.id === currentExamId)
  if (currentIndex === -1) return null
  for (let i = currentIndex + 1; i < sorted.length; i += 1) {
    if (sorted[i].nextAction) return sorted[i]
  }
  return null
}

// currentExamId'nin öğrencinin tüm deneme geçmişindeki yerini bulup, ondan önceki (kronolojik
// olarak daha eski), henüz cevaplanmamış bir "sonraki deneme hedefi" olup olmadığını döner.
// Yalnızca experience_previous_action_review henüz NULL olan denemeler için çağrılmalı —
// zaten cevaplanmış bir denemenin eşleşmesi dondurulur (bkz. mockExams.js modül yorumu / plan).
async function findPendingPreviousGoal(studentId, currentExamId) {
  const db = await withRequest({ studentId: { type: sql.UniqueIdentifier, value: studentId } })
  const result = await db.query(`
    SELECT id, COALESCE(exam_date, CAST(created_at AS date)) AS sort_date, created_at, experience_next_action
    FROM dbo.MockExams
    WHERE student_id = @studentId;
  `)
  const examList = result.recordset.map((row) => ({
    id: row.id,
    sortDate: toISODate(row.sort_date),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    nextAction: row.experience_next_action || null,
  }))
  return pickEligiblePreviousExam(examList, currentExamId)
}

// Bir denemenin "önceki hedef" bölümünde ne gösterileceğini çözer:
// - Zaten cevaplanmışsa (experience_previous_action_review dolu) hangi denemeye karşılık
//   verildiği DONDURULMUŞTUR (experience_previous_mock_exam_id) — yeniden hesaplanmaz, o
//   denemenin nextAction'ı salt-okuma gösterim için join'lenir (silinmişse null döner, cevap
//   yine de gösterilir).
// - Henüz cevaplanmamışsa her çağrıda taze hesaplanır (araya sonradan eklenen bir deneme varsa
//   onu bulur).
async function resolvePreviousGoalReview(studentId, examRecord) {
  if (examRecord.experience_previous_action_review) {
    let previousNextAction = null
    if (examRecord.experience_previous_mock_exam_id) {
      const db = await withRequest({
        id: { type: sql.UniqueIdentifier, value: examRecord.experience_previous_mock_exam_id },
        studentId: { type: sql.UniqueIdentifier, value: studentId },
      })
      const result = await db.query(`
        SELECT experience_next_action FROM dbo.MockExams WHERE id = @id AND student_id = @studentId;
      `)
      previousNextAction = result.recordset[0]?.experience_next_action || null
    }
    return {
      status: 'answered',
      review: examRecord.experience_previous_action_review,
      previousMockExamId: examRecord.experience_previous_mock_exam_id || null,
      previousNextAction,
    }
  }

  const pending = await findPendingPreviousGoal(studentId, examRecord.id)
  if (!pending) return null
  return {
    status: 'pending',
    previousMockExamId: pending.id,
    previousNextAction: pending.nextAction,
  }
}

function handleError(error, label, fallback) {
  if (isConfigError(error)) {
    return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
  }
  if (isSessionError(error)) {
    return json(401, { error: 'Oturum geçersiz.' })
  }
  console.error(`${label} failed`, error)
  return json(500, { error: fallback })
}

// { kind, examDate?, title?, subjects: [{ subjectId?, subjectName, totalQuestions, correct, wrong, blank, photos? }] }
// Genel Deneme'de subjects yok sayılır; şablon + istemciden gelen (isimle eşleşen) D/Y/B kullanılır.
function validateMockExamPayload(payload) {
  const kind = typeof payload?.kind === 'string' ? payload.kind.trim() : ''
  if (!MOCK_EXAM_KINDS.includes(kind)) {
    return { error: 'Geçersiz deneme türü.' }
  }

  const examDate = toISODate(payload?.examDate)
  if (kind !== 'etut' && !examDate) {
    return { error: 'Sınav tarihi zorunludur.' }
  }
  if (examDate && !/^\d{4}-\d{2}-\d{2}$/.test(examDate)) {
    return { error: 'Sınav tarihi geçersiz.' }
  }

  const title = typeof payload?.title === 'string' ? payload.title.trim().slice(0, 200) : null
  const classLabel = typeof payload?.classLabel === 'string' ? payload.classLabel.trim().slice(0, 50) || null : null
  const schoolLabel = typeof payload?.schoolLabel === 'string' ? payload.schoolLabel.trim().slice(0, 200) || null : null
  const rawSubjects = Array.isArray(payload?.subjects) ? payload.subjects : []

  const normalizeCounts = (row, total) => {
    const correct = nonNegInt(row?.correct)
    const wrong = nonNegInt(row?.wrong)
    let blank = nonNegInt(row?.blank)
    if (correct === null || wrong === null) return { error: 'Doğru/yanlış sayıları geçersiz.' }
    if (blank === null) blank = Math.max(0, total - correct - wrong)
    if (correct + wrong + blank !== total) {
      return { error: `Doğru + yanlış + boş toplamı ${total} olmalı.` }
    }
    return { value: { correct, wrong, blank } }
  }

  const normalizePhotos = (row) => {
    const photos = Array.isArray(row?.photos) ? row.photos : []
    const cleaned = []
    for (const raw of photos) {
      const check = sanitizeMistakePhoto(raw)
      if (check.error) return { error: check.error }
      cleaned.push(check.value)
    }
    return { value: cleaned }
  }

  let subjects
  if (kind === 'genel') {
    const byName = new Map()
    rawSubjects.forEach((row) => {
      if (row && typeof row.subjectName === 'string') byName.set(row.subjectName.trim(), row)
    })
    subjects = []
    for (const tpl of GENEL_DENEME_TEMPLATE) {
      const row = byName.get(tpl.name) || {}
      const qCheck = normalizeQuestions(row.questions, tpl.total)
      if (qCheck.error) return { error: `${tpl.name}: ${qCheck.error}` }

      let counts
      let questions = null
      let photos = { value: [] }
      if (qCheck.value) {
        questions = qCheck.value.questions
        counts = { value: qCheck.value.counts }
      } else {
        counts = normalizeCounts(row, tpl.total)
        if (counts.error) return { error: `${tpl.name}: ${counts.error}` }
        photos = normalizePhotos(row)
        if (photos.error) return { error: `${tpl.name}: ${photos.error}` }
        if (photos.value.length > counts.value.wrong + counts.value.blank) {
          return { error: `${tpl.name}: fotoğraf sayısı yanlış + boş sayısını aşamaz.` }
        }
      }
      const comparisonStats = normalizeComparisonStats(row)
      if (comparisonStats.error) return { error: `${tpl.name}: ${comparisonStats.error}` }
      const topicComparisons = normalizeTopicComparisons(row.topicComparisons)
      if (topicComparisons.error) return { error: `${tpl.name}: ${topicComparisons.error}` }
      subjects.push({
        subjectId: isGuid(row.subjectId) ? row.subjectId.trim().toLowerCase() : null,
        subjectName: tpl.name,
        totalQuestions: tpl.total,
        ...counts.value,
        photos: photos.value,
        questions,
        topicComparisons: topicComparisons.value,
        ...comparisonStats.value,
      })
    }
  } else {
    if (rawSubjects.length !== 1) {
      return { error: 'Bir ders seçilmelidir.' }
    }
    const row = rawSubjects[0]
    const subjectName = typeof row?.subjectName === 'string' ? row.subjectName.trim().slice(0, 100) : ''
    if (!subjectName) return { error: 'Ders seçilmelidir.' }

    // Etüt'te ayrı "toplam soru" alanı yok — toplam, doğru + yanlış + boş sayısıdır (ya da
    // soru bazlı modda girilen soru sayısıdır).
    let total
    let counts
    let questions = null
    if (kind === 'brans') {
      total = BRANS_QUESTION_COUNT
      const qCheck = normalizeQuestions(row?.questions, total)
      if (qCheck.error) return { error: qCheck.error }
      if (qCheck.value) {
        questions = qCheck.value.questions
        counts = { value: qCheck.value.counts }
      } else {
        counts = normalizeCounts(row, total)
      }
    } else if (Array.isArray(row?.questions) && row.questions.length > 0) {
      total = row.questions.length
      if (total < 1 || total > MAX_ETUT_QUESTIONS) {
        return { error: `Toplam soru sayısı 1 ile ${MAX_ETUT_QUESTIONS} arasında olmalı.` }
      }
      const qCheck = normalizeQuestions(row.questions, total)
      if (qCheck.error) return { error: qCheck.error }
      questions = qCheck.value.questions
      counts = { value: qCheck.value.counts }
    } else {
      const correct = nonNegInt(row?.correct)
      const wrong = nonNegInt(row?.wrong)
      const blank = nonNegInt(row?.blank) ?? 0
      if (correct === null || wrong === null) {
        counts = { error: 'Doğru/yanlış sayıları geçersiz.' }
      } else {
        total = correct + wrong + blank
        if (total < 1 || total > MAX_ETUT_QUESTIONS) {
          return { error: `Toplam soru sayısı 1 ile ${MAX_ETUT_QUESTIONS} arasında olmalı.` }
        }
        counts = { value: { correct, wrong, blank } }
      }
    }
    if (counts.error) return { error: counts.error }

    let photos = { value: [] }
    if (!questions) {
      photos = normalizePhotos(row)
      if (photos.error) return { error: photos.error }
      if (photos.value.length > counts.value.wrong + counts.value.blank) {
        return { error: 'Fotoğraf sayısı yanlış + boş sayısını aşamaz.' }
      }
    }

    const comparisonStats = normalizeComparisonStats(row)
    if (comparisonStats.error) return { error: comparisonStats.error }
    const topicComparisons = normalizeTopicComparisons(row?.topicComparisons)
    if (topicComparisons.error) return { error: topicComparisons.error }

    subjects = [
      {
        subjectId: isGuid(row.subjectId) ? row.subjectId.trim().toLowerCase() : null,
        subjectName,
        totalQuestions: total,
        ...counts.value,
        photos: photos.value,
        questions,
        topicComparisons: topicComparisons.value,
        ...comparisonStats.value,
      },
    ]
  }

  return { value: { kind, examDate, title, classLabel, schoolLabel, subjects } }
}

function sanitizeSubjectRow(record) {
  const correct = record.correct_count
  const wrong = record.wrong_count
  const blank = record.blank_count
  const total = record.total_questions
  return {
    id: record.id,
    subjectId: record.subject_id || undefined,
    subjectName: record.subject_name,
    totalQuestions: total,
    correct,
    wrong,
    blank,
    net: computeNet(correct, wrong),
    successRate: total > 0 ? Math.round((correct / total) * 1000) / 10 : 0,
    photoCount: record.photo_count ?? 0,
    hasTopicBreakdown: (record.question_row_count ?? 0) > 0,
    score: record.score == null ? undefined : Number(record.score),
    branchRank: record.branch_rank ?? undefined,
    schoolRank: record.school_rank ?? undefined,
    overallRank: record.overall_rank ?? undefined,
    classAvgScore: record.class_avg_score == null ? undefined : Number(record.class_avg_score),
    schoolAvgScore: record.school_avg_score == null ? undefined : Number(record.school_avg_score),
    turkeyAvgScore: record.turkey_avg_score == null ? undefined : Number(record.turkey_avg_score),
  }
}

function buildExam(examRecord, subjectRows) {
  const subjects = subjectRows.map(sanitizeSubjectRow)
  const totalQuestions = subjects.reduce((sum, s) => sum + s.totalQuestions, 0)
  const totalCorrect = subjects.reduce((sum, s) => sum + s.correct, 0)
  const totalWrong = subjects.reduce((sum, s) => sum + s.wrong, 0)
  const totalBlank = subjects.reduce((sum, s) => sum + s.blank, 0)
  return {
    id: examRecord.id,
    kind: examRecord.kind,
    examDate: toISODate(examRecord.exam_date),
    title: examRecord.title || undefined,
    classLabel: examRecord.class_label || undefined,
    schoolLabel: examRecord.school_label || undefined,
    createdByName: examRecord.created_by_name || undefined,
    createdAt: examRecord.created_at,
    experienceMood: examRecord.experience_mood || undefined,
    subjects,
    totalQuestions,
    totalCorrect,
    totalWrong,
    totalBlank,
    net: computeNet(totalCorrect, totalWrong),
    successRate: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 1000) / 10 : 0,
  }
}

// Öğrenci/veli listesi + öğretmen salt-okuma ucu ortak: bir öğrencinin tüm denemeleri.
async function listMockExamsForStudent(studentId) {
  const [examsDb, subjectsDb] = await Promise.all([
    withRequest({ studentId: { type: sql.UniqueIdentifier, value: studentId } }),
    withRequest({ studentId: { type: sql.UniqueIdentifier, value: studentId } }),
  ])
  const [examsResult, subjectsResult] = await Promise.all([
    examsDb.query(`
      SELECT e.id, e.kind, e.exam_date, e.title, e.class_label, e.school_label, e.created_at,
             e.experience_mood,
             u.full_name AS created_by_name
      FROM dbo.MockExams e
      LEFT JOIN dbo.Users u ON u.id = e.created_by_user_id
      WHERE e.student_id = @studentId
      ORDER BY COALESCE(e.exam_date, CAST(e.created_at AS date)) DESC, e.created_at DESC;
    `),
    subjectsDb.query(`
      SELECT s.id, s.mock_exam_id, s.subject_id, s.subject_name, s.total_questions,
             s.correct_count, s.wrong_count, s.blank_count,
             s.score, s.branch_rank, s.school_rank, s.overall_rank,
             s.class_avg_score, s.school_avg_score, s.turkey_avg_score,
             (SELECT COUNT(*) FROM dbo.WrongQuestions wq
              WHERE wq.mock_exam_subject_id = s.id AND wq.photo_url IS NOT NULL) AS photo_count,
             (SELECT COUNT(*) FROM dbo.MockExamQuestions mq
              WHERE mq.mock_exam_subject_id = s.id) AS question_row_count
      FROM dbo.MockExamSubjects s
      INNER JOIN dbo.MockExams e ON e.id = s.mock_exam_id
      WHERE e.student_id = @studentId;
    `),
  ])

  const subjectsByExam = new Map()
  subjectsResult.recordset.forEach((row) => {
    const list = subjectsByExam.get(row.mock_exam_id) || []
    list.push(row)
    subjectsByExam.set(row.mock_exam_id, list)
  })

  return examsResult.recordset.map((exam) => buildExam(exam, subjectsByExam.get(exam.id) || []))
}

async function getMockExamDetailForStudent(studentId, mockExamId) {
  const requestDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    mockExamId: { type: sql.UniqueIdentifier, value: mockExamId },
  })
  const examResult = await requestDb.query(`
    SELECT e.id, e.kind, e.exam_date, e.title, e.class_label, e.school_label, e.created_at,
           e.experience_mood, e.experience_learning_note, e.experience_next_action,
           e.experience_previous_action_review, e.experience_previous_mock_exam_id, e.experience_updated_at,
           u.full_name AS created_by_name
    FROM dbo.MockExams e
    LEFT JOIN dbo.Users u ON u.id = e.created_by_user_id
    WHERE e.id = @mockExamId AND e.student_id = @studentId;
  `)
  const examRecord = examResult.recordset[0]
  if (!examRecord) return null

  const [subjectsDb, mockQuestionsDb, legacyQuestionsDb, topicComparisonsDb, experienceTagsDb] = await Promise.all([
    withRequest({ mockExamId: { type: sql.UniqueIdentifier, value: mockExamId } }),
    withRequest({ mockExamId: { type: sql.UniqueIdentifier, value: mockExamId } }),
    withRequest({ mockExamId: { type: sql.UniqueIdentifier, value: mockExamId } }),
    withRequest({ mockExamId: { type: sql.UniqueIdentifier, value: mockExamId } }),
    withRequest({ mockExamId: { type: sql.UniqueIdentifier, value: mockExamId } }),
  ])
  const [
    subjectsResult,
    mockQuestionsResult,
    legacyQuestionsResult,
    topicComparisonsResult,
    experienceTagsResult,
  ] = await Promise.all([
    subjectsDb.query(`
      SELECT s.id, s.mock_exam_id, s.subject_id, s.subject_name, s.total_questions,
             s.correct_count, s.wrong_count, s.blank_count,
             s.score, s.branch_rank, s.school_rank, s.overall_rank,
             s.class_avg_score, s.school_avg_score, s.turkey_avg_score,
             (SELECT COUNT(*) FROM dbo.WrongQuestions wq
              WHERE wq.mock_exam_subject_id = s.id AND wq.photo_url IS NOT NULL) AS photo_count,
             (SELECT COUNT(*) FROM dbo.MockExamQuestions mq
              WHERE mq.mock_exam_subject_id = s.id) AS question_row_count
      FROM dbo.MockExamSubjects s
      WHERE s.mock_exam_id = @mockExamId;
    `),
    // Soru bazlı girilen subject'ler: gerçek soru listesi (durum + konu) burada.
    mockQuestionsDb.query(`
      SELECT mq.id, mq.mock_exam_subject_id, mq.order_no, mq.status, mq.topic_name, mq.wrong_question_id,
             CASE WHEN wq.photo_url IS NOT NULL THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS has_photo
      FROM dbo.MockExamQuestions mq
      INNER JOIN dbo.MockExamSubjects s ON s.id = mq.mock_exam_subject_id
      LEFT JOIN dbo.WrongQuestions wq ON wq.id = mq.wrong_question_id
      WHERE s.mock_exam_id = @mockExamId
      ORDER BY mq.mock_exam_subject_id, mq.order_no ASC;
    `),
    // Eski basit mod: soru listesi yalnızca sırayla eklenen hata görsellerinden türer.
    legacyQuestionsDb.query(`
      SELECT wq.id, wq.mock_exam_subject_id, wq.question_number,
             CASE WHEN wq.photo_url IS NOT NULL THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS has_photo,
             wq.created_at
      FROM dbo.WrongQuestions wq
      INNER JOIN dbo.MockExamSubjects s ON s.id = wq.mock_exam_subject_id
      WHERE s.mock_exam_id = @mockExamId AND wq.mock_exam_subject_id NOT IN (
        SELECT DISTINCT mq2.mock_exam_subject_id FROM dbo.MockExamQuestions mq2
        INNER JOIN dbo.MockExamSubjects s2 ON s2.id = mq2.mock_exam_subject_id
        WHERE s2.mock_exam_id = @mockExamId
      )
      ORDER BY wq.created_at ASC;
    `),
    // Konu grubu bazında karşılaştırma (ör. "Sözcük Grubunda Anlam") — isteğe bağlı.
    topicComparisonsDb.query(`
      SELECT tc.id, tc.mock_exam_subject_id, tc.order_no, tc.topic_name,
             tc.score, tc.class_avg_score, tc.school_avg_score, tc.turkey_avg_score
      FROM dbo.MockExamTopicComparisons tc
      INNER JOIN dbo.MockExamSubjects s ON s.id = tc.mock_exam_subject_id
      WHERE s.mock_exam_id = @mockExamId
      ORDER BY tc.mock_exam_subject_id, tc.order_no ASC;
    `),
    // Deneyim etiketleri (çoklu seçim) — bkz. EXPERIENCE_TAG_CODES.
    experienceTagsDb.query(`
      SELECT tag_code FROM dbo.MockExamExperienceTags WHERE mock_exam_id = @mockExamId ORDER BY tag_code ASC;
    `),
  ])

  const questionsBySubject = new Map()
  mockQuestionsResult.recordset.forEach((row) => {
    const list = questionsBySubject.get(row.mock_exam_subject_id) || []
    list.push({
      id: row.wrong_question_id || undefined,
      questionRowId: row.id,
      orderNo: row.order_no,
      status: row.status,
      topicName: row.topic_name || undefined,
      hasPhoto: Boolean(row.has_photo),
    })
    questionsBySubject.set(row.mock_exam_subject_id, list)
  })
  legacyQuestionsResult.recordset.forEach((row) => {
    const list = questionsBySubject.get(row.mock_exam_subject_id) || []
    list.push({
      id: row.id,
      questionNumber: row.question_number || undefined,
      hasPhoto: Boolean(row.has_photo),
      createdAt: row.created_at,
    })
    questionsBySubject.set(row.mock_exam_subject_id, list)
  })

  const topicComparisonsBySubject = new Map()
  topicComparisonsResult.recordset.forEach((row) => {
    const list = topicComparisonsBySubject.get(row.mock_exam_subject_id) || []
    list.push({
      id: row.id,
      topicName: row.topic_name,
      score: row.score == null ? undefined : Number(row.score),
      classAvgScore: row.class_avg_score == null ? undefined : Number(row.class_avg_score),
      schoolAvgScore: row.school_avg_score == null ? undefined : Number(row.school_avg_score),
      turkeyAvgScore: row.turkey_avg_score == null ? undefined : Number(row.turkey_avg_score),
    })
    topicComparisonsBySubject.set(row.mock_exam_subject_id, list)
  })

  const exam = buildExam(examRecord, subjectsResult.recordset)
  exam.subjects = exam.subjects.map((subject) => ({
    ...subject,
    questions: questionsBySubject.get(subject.id) || [],
    topicComparisons: topicComparisonsBySubject.get(subject.id) || [],
  }))
  exam.experienceTags = experienceTagsResult.recordset.map((row) => row.tag_code)
  exam.experienceLearningNote = examRecord.experience_learning_note || undefined
  exam.experienceNextAction = examRecord.experience_next_action || undefined
  exam.experiencePreviousActionReview = examRecord.experience_previous_action_review || undefined
  exam.experienceUpdatedAt = examRecord.experience_updated_at || undefined
  exam.previousGoalReview = await resolvePreviousGoalReview(studentId, examRecord)
  return exam
}

const MOCK_EXAM_WQ_INSERT_SQL = `
  INSERT INTO dbo.WrongQuestions
    (student_id, mock_exam_subject_id, subject, topic, book_name, question_number, error_type, photo_url)
  VALUES
    (@studentId, @subjectRowId, @subject, @topic, @bookName, @questionNumber, @errorType, @photoUrl);
`

const MOCK_EXAM_WQ_INSERT_RETURNING_ID_SQL = `
  INSERT INTO dbo.WrongQuestions
    (student_id, mock_exam_subject_id, subject, topic, book_name, question_number, error_type, photo_url)
  OUTPUT inserted.id
  VALUES
    (@studentId, @subjectRowId, @subject, @topic, @bookName, @questionNumber, @errorType, @photoUrl);
`

function mockExamWqBindings({ studentId, subjectRowId, subjectName, topic, questionNumber, photoUrl }) {
  return {
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    subjectRowId: { type: sql.UniqueIdentifier, value: subjectRowId },
    subject: { type: sql.NVarChar(100), value: subjectName },
    topic: { type: sql.NVarChar(200), value: topic },
    bookName: { type: sql.NVarChar(200), value: MOCK_EXAM_WRONG_BOOK_NAME },
    questionNumber: { type: sql.NVarChar(20), value: questionNumber == null ? null : String(questionNumber) },
    errorType: { type: sql.NVarChar(50), value: MOCK_EXAM_ERROR_TYPE },
    photoUrl: { type: sql.NVarChar(sql.MAX), value: photoUrl },
  }
}

function subjectTopicLabel(subjectName, examDate) {
  return `${subjectName} · ${examDate || 'Etüt'}`
}

/* ------------------------------------------------------------------ öğrenci / veli uçları */

async function listMockExamsHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) return error
    return json(200, { mockExams: await listMockExamsForStudent(studentId) })
  } catch (error) {
    return handleError(error, 'listMockExamsHandler', 'Deneme sınavları yüklenemedi.')
  }
}

async function getMockExamHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) return error
    const exam = await getMockExamDetailForStudent(studentId, request.params.mockExamId)
    if (!exam) return json(404, { error: 'Deneme bulunamadı.' })
    return json(200, { mockExam: exam })
  } catch (error) {
    return handleError(error, 'getMockExamHandler', 'Deneme yüklenemedi.')
  }
}

async function createMockExamHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const { error, studentId, actorId } = await requireStudentWriteContext(request, { studentId: payload?.studentId })
    if (error) return error

    const check = validateMockExamPayload(payload)
    if (check.error) return json(400, { error: check.error })
    const { kind, examDate, title, classLabel, schoolLabel, subjects } = check.value

    const mockExamId = await withTransaction(async (makeRequest) => {
      const examResult = await makeRequest({
        studentId: { type: sql.UniqueIdentifier, value: studentId },
        kind: { type: sql.NVarChar(20), value: kind },
        examDate: { type: sql.Date, value: examDate },
        title: { type: sql.NVarChar(200), value: title },
        classLabel: { type: sql.NVarChar(50), value: classLabel },
        schoolLabel: { type: sql.NVarChar(200), value: schoolLabel },
        createdBy: { type: sql.UniqueIdentifier, value: actorId || null },
      }).query(`
        INSERT INTO dbo.MockExams (student_id, kind, exam_date, title, class_label, school_label, created_by_user_id)
        OUTPUT inserted.id
        VALUES (@studentId, @kind, @examDate, @title, @classLabel, @schoolLabel, @createdBy);
      `)
      const newExamId = examResult.recordset[0].id

      for (const subject of subjects) {
        const subjectResult = await makeRequest({
          mockExamId: { type: sql.UniqueIdentifier, value: newExamId },
          subjectId: { type: sql.UniqueIdentifier, value: subject.subjectId },
          subjectName: { type: sql.NVarChar(100), value: subject.subjectName },
          total: { type: sql.Int, value: subject.totalQuestions },
          correct: { type: sql.Int, value: subject.correct },
          wrong: { type: sql.Int, value: subject.wrong },
          blank: { type: sql.Int, value: subject.blank },
          score: { type: sql.Decimal(6, 2), value: subject.score },
          branchRank: { type: sql.Int, value: subject.branchRank },
          schoolRank: { type: sql.Int, value: subject.schoolRank },
          overallRank: { type: sql.Int, value: subject.overallRank },
          classAvgScore: { type: sql.Decimal(6, 2), value: subject.classAvgScore },
          schoolAvgScore: { type: sql.Decimal(6, 2), value: subject.schoolAvgScore },
          turkeyAvgScore: { type: sql.Decimal(6, 2), value: subject.turkeyAvgScore },
        }).query(`
          INSERT INTO dbo.MockExamSubjects
            (mock_exam_id, subject_id, subject_name, total_questions, correct_count, wrong_count, blank_count,
             score, branch_rank, school_rank, overall_rank, class_avg_score, school_avg_score, turkey_avg_score)
          OUTPUT inserted.id
          VALUES (@mockExamId, @subjectId, @subjectName, @total, @correct, @wrong, @blank,
                  @score, @branchRank, @schoolRank, @overallRank, @classAvgScore, @schoolAvgScore, @turkeyAvgScore);
        `)
        const subjectRowId = subjectResult.recordset[0].id
        if (subject.questions) {
          for (const q of subject.questions) {
            await makeRequest({
              subjectRowId: { type: sql.UniqueIdentifier, value: subjectRowId },
              orderNo: { type: sql.Int, value: q.orderNo },
              status: { type: sql.NVarChar(10), value: q.status },
              topicName: { type: sql.NVarChar(200), value: q.topicName },
            }).query(`
              INSERT INTO dbo.MockExamQuestions (mock_exam_subject_id, order_no, status, topic_name)
              VALUES (@subjectRowId, @orderNo, @status, @topicName);
            `)
          }
        } else {
          const topic = subjectTopicLabel(subject.subjectName, examDate)
          for (let i = 0; i < subject.photos.length; i += 1) {
            await makeRequest(
              mockExamWqBindings({
                studentId,
                subjectRowId,
                subjectName: subject.subjectName,
                topic,
                questionNumber: i + 1,
                photoUrl: subject.photos[i],
              }),
            ).query(MOCK_EXAM_WQ_INSERT_SQL)
          }
        }

        if (subject.topicComparisons) {
          for (const tc of subject.topicComparisons) {
            await makeRequest({
              subjectRowId: { type: sql.UniqueIdentifier, value: subjectRowId },
              orderNo: { type: sql.Int, value: tc.orderNo },
              topicName: { type: sql.NVarChar(200), value: tc.topicName },
              score: { type: sql.Decimal(6, 2), value: tc.score },
              classAvgScore: { type: sql.Decimal(6, 2), value: tc.classAvgScore },
              schoolAvgScore: { type: sql.Decimal(6, 2), value: tc.schoolAvgScore },
              turkeyAvgScore: { type: sql.Decimal(6, 2), value: tc.turkeyAvgScore },
            }).query(`
              INSERT INTO dbo.MockExamTopicComparisons
                (mock_exam_subject_id, order_no, topic_name, score, class_avg_score, school_avg_score, turkey_avg_score)
              VALUES (@subjectRowId, @orderNo, @topicName, @score, @classAvgScore, @schoolAvgScore, @turkeyAvgScore);
            `)
          }
        }
      }

      return newExamId
    })

    const exam = await getMockExamDetailForStudent(studentId, mockExamId)
    return json(201, { mockExam: exam })
  } catch (error) {
    return handleError(error, 'createMockExamHandler', 'Deneme kaydedilemedi.')
  }
}

async function updateMockExamHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentWriteContext(request, { studentId: payload?.studentId })
    if (error) return error

    const mockExamId = request.params.mockExamId
    const ownerDb = await withRequest({
      mockExamId: { type: sql.UniqueIdentifier, value: mockExamId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const ownerResult = await ownerDb.query(`
      SELECT id, kind, exam_date FROM dbo.MockExams WHERE id = @mockExamId AND student_id = @studentId;
    `)
    const existing = ownerResult.recordset[0]
    if (!existing) return json(404, { error: 'Deneme bulunamadı.' })

    // Aynı doğrulama kurallarıyla yeniden kontrol: türü değiştiremez, sadece tarih/başlık ve
    // ders sayıları güncellenir.
    const rebuilt = validateMockExamPayload({ ...payload, kind: existing.kind })
    if (rebuilt.error) return json(400, { error: rebuilt.error })
    const { examDate, title, classLabel, schoolLabel, subjects } = rebuilt.value

    await withTransaction(async (makeRequest) => {
      await makeRequest({
        mockExamId: { type: sql.UniqueIdentifier, value: mockExamId },
        examDate: { type: sql.Date, value: examDate },
        title: { type: sql.NVarChar(200), value: title },
        classLabel: { type: sql.NVarChar(50), value: classLabel },
        schoolLabel: { type: sql.NVarChar(200), value: schoolLabel },
      }).query(`
        UPDATE dbo.MockExams
        SET exam_date = @examDate, title = @title, class_label = @classLabel, school_label = @schoolLabel,
            updated_at = SYSUTCDATETIME()
        WHERE id = @mockExamId;
      `)

      for (const subject of subjects) {
        const updateResult = await makeRequest({
          mockExamId: { type: sql.UniqueIdentifier, value: mockExamId },
          subjectName: { type: sql.NVarChar(100), value: subject.subjectName },
          total: { type: sql.Int, value: subject.totalQuestions },
          correct: { type: sql.Int, value: subject.correct },
          wrong: { type: sql.Int, value: subject.wrong },
          blank: { type: sql.Int, value: subject.blank },
          score: { type: sql.Decimal(6, 2), value: subject.score },
          branchRank: { type: sql.Int, value: subject.branchRank },
          schoolRank: { type: sql.Int, value: subject.schoolRank },
          overallRank: { type: sql.Int, value: subject.overallRank },
          classAvgScore: { type: sql.Decimal(6, 2), value: subject.classAvgScore },
          schoolAvgScore: { type: sql.Decimal(6, 2), value: subject.schoolAvgScore },
          turkeyAvgScore: { type: sql.Decimal(6, 2), value: subject.turkeyAvgScore },
        }).query(`
          UPDATE dbo.MockExamSubjects
          SET total_questions = @total, correct_count = @correct, wrong_count = @wrong, blank_count = @blank,
              score = @score, branch_rank = @branchRank, school_rank = @schoolRank, overall_rank = @overallRank,
              class_avg_score = @classAvgScore, school_avg_score = @schoolAvgScore, turkey_avg_score = @turkeyAvgScore
          OUTPUT inserted.id
          WHERE mock_exam_id = @mockExamId AND subject_name = @subjectName;
        `)
        const subjectRowId = updateResult.recordset[0]?.id
        if (!subjectRowId) continue

        // Var olan soru satırlarını (varsa) sırayla eşleştirip fotoğraf bağlantısını koru,
        // sonra hepsini silip yeni seti (varsa) yeniden ekle. Soru bazlı moddan basit moda
        // geçilirse (subject.questions boş) satırlar silinir; ilişkili WrongQuestions/fotoğraf
        // kayıtları mock_exam_subject_id üzerinden Hata Defteri'nde görünmeye devam eder.
        const prevDb = await makeRequest({ subjectRowId: { type: sql.UniqueIdentifier, value: subjectRowId } }).query(`
          SELECT order_no, status, wrong_question_id FROM dbo.MockExamQuestions WHERE mock_exam_subject_id = @subjectRowId;
        `)
        const prevByOrder = new Map(prevDb.recordset.map((row) => [row.order_no, row]))

        await makeRequest({ subjectRowId: { type: sql.UniqueIdentifier, value: subjectRowId } }).query(`
          DELETE FROM dbo.MockExamQuestions WHERE mock_exam_subject_id = @subjectRowId;
        `)

        if (subject.questions) {
          for (const q of subject.questions) {
            const prev = prevByOrder.get(q.orderNo)
            const carryWrongId =
              prev && prev.status === q.status && q.status !== 'dogru' ? prev.wrong_question_id : null
            await makeRequest({
              subjectRowId: { type: sql.UniqueIdentifier, value: subjectRowId },
              orderNo: { type: sql.Int, value: q.orderNo },
              status: { type: sql.NVarChar(10), value: q.status },
              topicName: { type: sql.NVarChar(200), value: q.topicName },
              wrongQuestionId: { type: sql.UniqueIdentifier, value: carryWrongId || null },
            }).query(`
              INSERT INTO dbo.MockExamQuestions (mock_exam_subject_id, order_no, status, topic_name, wrong_question_id)
              VALUES (@subjectRowId, @orderNo, @status, @topicName, @wrongQuestionId);
            `)
          }
        }

        // Konu grubu karşılaştırması: fotoğraf/referans gibi korunacak yan veri yok —
        // basitçe sil + (varsa) yeniden ekle.
        await makeRequest({ subjectRowId: { type: sql.UniqueIdentifier, value: subjectRowId } }).query(`
          DELETE FROM dbo.MockExamTopicComparisons WHERE mock_exam_subject_id = @subjectRowId;
        `)
        if (subject.topicComparisons) {
          for (const tc of subject.topicComparisons) {
            await makeRequest({
              subjectRowId: { type: sql.UniqueIdentifier, value: subjectRowId },
              orderNo: { type: sql.Int, value: tc.orderNo },
              topicName: { type: sql.NVarChar(200), value: tc.topicName },
              score: { type: sql.Decimal(6, 2), value: tc.score },
              classAvgScore: { type: sql.Decimal(6, 2), value: tc.classAvgScore },
              schoolAvgScore: { type: sql.Decimal(6, 2), value: tc.schoolAvgScore },
              turkeyAvgScore: { type: sql.Decimal(6, 2), value: tc.turkeyAvgScore },
            }).query(`
              INSERT INTO dbo.MockExamTopicComparisons
                (mock_exam_subject_id, order_no, topic_name, score, class_avg_score, school_avg_score, turkey_avg_score)
              VALUES (@subjectRowId, @orderNo, @topicName, @score, @classAvgScore, @schoolAvgScore, @turkeyAvgScore);
            `)
          }
        }
      }
    })

    const exam = await getMockExamDetailForStudent(studentId, mockExamId)
    return json(200, { mockExam: exam })
  } catch (error) {
    return handleError(error, 'updateMockExamHandler', 'Deneme güncellenemedi.')
  }
}

// Sınav Deneyimi Analizi: mevcut sonuç güncelleme akışından (updateMockExamHandler) tamamen
// ayrı bir uç — sonuç formuna hiç dokunmadan sadece deneyim alanlarını yazar. Bilinçli olarak
// daha kısıtlı bir yetki modeli uygular: requireStudentContext hem öğrenci hem veliye izin
// verse de, burada yalnızca öğrenci (actorRole === 'ogrenci') yazabilir — veli/öğretmen
// salt-okuma.
async function updateMockExamExperienceHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const { error, studentId, actorRole } = await requireStudentContext(request, { studentId: payload?.studentId })
    if (error) return error
    if (actorRole !== 'ogrenci') {
      return json(403, { error: 'Bu alanı yalnızca öğrenci düzenleyebilir.' })
    }

    const mockExamId = request.params.mockExamId
    const ownerDb = await withRequest({
      mockExamId: { type: sql.UniqueIdentifier, value: mockExamId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const ownerResult = await ownerDb.query(`
      SELECT id, experience_previous_action_review, experience_previous_mock_exam_id
      FROM dbo.MockExams WHERE id = @mockExamId AND student_id = @studentId;
    `)
    const existing = ownerResult.recordset[0]
    if (!existing) return json(404, { error: 'Deneme bulunamadı.' })

    const check = normalizeExperiencePayload(payload)
    if (check.error) return json(400, { error: check.error })
    const { mood, tags, learningNote, nextAction, previousActionReview } = check.value

    // "Önceki hedef" eşleştirmesi ilk kez cevaplanıyorsa taze hesaplanıp dondurulur; zaten
    // cevaplanmışsa (existing.experience_previous_action_review dolu) hangi denemeye karşılık
    // geldiği değişmez, sadece review string'i güncellenebilir.
    let previousMockExamId = existing.experience_previous_mock_exam_id || null
    if (previousActionReview && !existing.experience_previous_action_review) {
      const pending = await findPendingPreviousGoal(studentId, mockExamId)
      if (!pending) {
        return json(400, { error: 'Değerlendirilecek bir önceki hedef bulunamadı.' })
      }
      previousMockExamId = pending.id
    }

    await withTransaction(async (makeRequest) => {
      await makeRequest({
        mockExamId: { type: sql.UniqueIdentifier, value: mockExamId },
        mood: { type: sql.NVarChar(30), value: mood },
        learningNote: { type: sql.NVarChar(500), value: learningNote },
        nextAction: { type: sql.NVarChar(300), value: nextAction },
        previousActionReview: { type: sql.NVarChar(20), value: previousActionReview },
        previousMockExamId: { type: sql.UniqueIdentifier, value: previousMockExamId },
      }).query(`
        UPDATE dbo.MockExams
        SET experience_mood = @mood,
            experience_learning_note = @learningNote,
            experience_next_action = @nextAction,
            experience_previous_action_review = @previousActionReview,
            experience_previous_mock_exam_id = @previousMockExamId,
            experience_updated_at = SYSUTCDATETIME()
        WHERE id = @mockExamId;
      `)

      await makeRequest({ mockExamId: { type: sql.UniqueIdentifier, value: mockExamId } }).query(`
        DELETE FROM dbo.MockExamExperienceTags WHERE mock_exam_id = @mockExamId;
      `)
      for (const tag of tags) {
        await makeRequest({
          mockExamId: { type: sql.UniqueIdentifier, value: mockExamId },
          tagCode: { type: sql.NVarChar(50), value: tag },
        }).query(`
          INSERT INTO dbo.MockExamExperienceTags (mock_exam_id, tag_code) VALUES (@mockExamId, @tagCode);
        `)
      }
    })

    const exam = await getMockExamDetailForStudent(studentId, mockExamId)
    return json(200, { mockExam: exam })
  } catch (error) {
    return handleError(error, 'updateMockExamExperienceHandler', 'Deneyim kaydedilemedi.')
  }
}

async function deleteMockExamHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentWriteContext(request, { studentId: payload?.studentId })
    if (error) return error

    const mockExamId = request.params.mockExamId
    await withTransaction(async (makeRequest) => {
      const ownerResult = await makeRequest({
        mockExamId: { type: sql.UniqueIdentifier, value: mockExamId },
        studentId: { type: sql.UniqueIdentifier, value: studentId },
      }).query(`SELECT id FROM dbo.MockExams WHERE id = @mockExamId AND student_id = @studentId;`)
      if (!ownerResult.recordset[0]) return

      // WrongQuestions -> MockExamSubjects FK'sinde cascade yok; önce elle sil.
      await makeRequest({ mockExamId: { type: sql.UniqueIdentifier, value: mockExamId } }).query(`
        DELETE FROM dbo.WrongQuestions
        WHERE mock_exam_subject_id IN (SELECT id FROM dbo.MockExamSubjects WHERE mock_exam_id = @mockExamId);
      `)
      // experience_previous_mock_exam_id kendine referans FK'si NO ACTION (SQL Server kendine
      // referansta SET NULL'a izin vermiyor) — bu denemeye referans veren satırları elle NULL'la.
      await makeRequest({ mockExamId: { type: sql.UniqueIdentifier, value: mockExamId } }).query(`
        UPDATE dbo.MockExams SET experience_previous_mock_exam_id = NULL
        WHERE experience_previous_mock_exam_id = @mockExamId;
      `)
      await makeRequest({ mockExamId: { type: sql.UniqueIdentifier, value: mockExamId } }).query(`
        DELETE FROM dbo.MockExams WHERE id = @mockExamId;
      `)
    })

    return json(200, { ok: true })
  } catch (error) {
    return handleError(error, 'deleteMockExamHandler', 'Deneme silinemedi.')
  }
}

async function addMockExamPhotoHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentWriteContext(request, { studentId: payload?.studentId })
    if (error) return error

    const photoCheck = sanitizeMistakePhoto(payload?.photo)
    if (photoCheck.error) return json(400, { error: photoCheck.error })

    const { mockExamId, subjectRowId } = request.params
    const scopeDb = await withRequest({
      subjectRowId: { type: sql.UniqueIdentifier, value: subjectRowId },
      mockExamId: { type: sql.UniqueIdentifier, value: mockExamId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const scopeResult = await scopeDb.query(`
      SELECT s.id, s.subject_name, s.wrong_count, s.blank_count, e.exam_date,
             (SELECT COUNT(*) FROM dbo.WrongQuestions wq WHERE wq.mock_exam_subject_id = s.id) AS photo_count
      FROM dbo.MockExamSubjects s
      INNER JOIN dbo.MockExams e ON e.id = s.mock_exam_id
      WHERE s.id = @subjectRowId AND s.mock_exam_id = @mockExamId AND e.student_id = @studentId;
    `)
    const scope = scopeResult.recordset[0]
    if (!scope) return json(404, { error: 'Ders bulunamadı.' })
    if (scope.photo_count >= scope.wrong_count + scope.blank_count) {
      return json(400, { error: 'Bu ders için yanlış + boş sayısı kadar fotoğraf zaten eklenmiş.' })
    }

    const insertDb = await withRequest(
      mockExamWqBindings({
        studentId,
        subjectRowId: scope.id,
        subjectName: scope.subject_name,
        topic: subjectTopicLabel(scope.subject_name, toISODate(scope.exam_date)),
        questionNumber: scope.photo_count + 1,
        photoUrl: photoCheck.value,
      }),
    )
    await insertDb.query(MOCK_EXAM_WQ_INSERT_SQL)

    const exam = await getMockExamDetailForStudent(studentId, mockExamId)
    return json(201, { mockExam: exam })
  } catch (error) {
    return handleError(error, 'addMockExamPhotoHandler', 'Fotoğraf eklenemedi.')
  }
}

// Soru bazlı modda fotoğraf, belirli bir soru satırına (MockExamQuestions) bağlanır —
// eski moddaki gibi sıradaki bir sonraki foto değil, o sorunun kendi görseli.
async function addMockExamQuestionPhotoHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentWriteContext(request, { studentId: payload?.studentId })
    if (error) return error

    const photoCheck = sanitizeMistakePhoto(payload?.photo)
    if (photoCheck.error) return json(400, { error: photoCheck.error })

    const { mockExamId, subjectRowId, questionRowId } = request.params
    const scopeDb = await withRequest({
      questionRowId: { type: sql.UniqueIdentifier, value: questionRowId },
      subjectRowId: { type: sql.UniqueIdentifier, value: subjectRowId },
      mockExamId: { type: sql.UniqueIdentifier, value: mockExamId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const scopeResult = await scopeDb.query(`
      SELECT mq.id, mq.order_no, mq.status, mq.topic_name, mq.wrong_question_id,
             s.id AS subject_row_id, s.subject_name
      FROM dbo.MockExamQuestions mq
      INNER JOIN dbo.MockExamSubjects s ON s.id = mq.mock_exam_subject_id
      INNER JOIN dbo.MockExams e ON e.id = s.mock_exam_id
      WHERE mq.id = @questionRowId AND s.id = @subjectRowId AND s.mock_exam_id = @mockExamId
        AND e.student_id = @studentId;
    `)
    const scope = scopeResult.recordset[0]
    if (!scope) return json(404, { error: 'Soru bulunamadı.' })
    if (scope.status === 'dogru') return json(400, { error: 'Sadece yanlış/boş sorulara fotoğraf eklenebilir.' })
    if (scope.wrong_question_id) return json(400, { error: 'Bu soru için zaten fotoğraf var, önce kaldırın.' })

    const wrongQuestionId = await withTransaction(async (makeRequest) => {
      const insertResult = await makeRequest(
        mockExamWqBindings({
          studentId,
          subjectRowId: scope.subject_row_id,
          subjectName: scope.subject_name,
          topic: scope.topic_name || subjectTopicLabel(scope.subject_name, null),
          questionNumber: scope.order_no,
          photoUrl: photoCheck.value,
        }),
      ).query(MOCK_EXAM_WQ_INSERT_RETURNING_ID_SQL)
      const newWrongQuestionId = insertResult.recordset[0]?.id
      await makeRequest({
        questionRowId: { type: sql.UniqueIdentifier, value: scope.id },
        wrongQuestionId: { type: sql.UniqueIdentifier, value: newWrongQuestionId },
      }).query(`
        UPDATE dbo.MockExamQuestions SET wrong_question_id = @wrongQuestionId WHERE id = @questionRowId;
      `)
      return newWrongQuestionId
    })
    if (!wrongQuestionId) throw new Error('Fotoğraf kaydı oluşturulamadı.')

    const exam = await getMockExamDetailForStudent(studentId, mockExamId)
    return json(201, { mockExam: exam })
  } catch (error) {
    return handleError(error, 'addMockExamQuestionPhotoHandler', 'Fotoğraf eklenemedi.')
  }
}

async function deleteMockExamPhotoHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentWriteContext(request, { studentId: payload?.studentId })
    if (error) return error

    const wrongQuestionId = request.params.wrongQuestionId
    const db = await withRequest({
      id: { type: sql.UniqueIdentifier, value: wrongQuestionId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const result = await db.query(`
      DELETE FROM dbo.WrongQuestions
      OUTPUT deleted.id
      WHERE id = @id AND student_id = @studentId AND mock_exam_subject_id IS NOT NULL;
    `)
    if (!result.recordset[0]) return json(404, { error: 'Fotoğraf bulunamadı.' })
    return json(200, { ok: true })
  } catch (error) {
    return handleError(error, 'deleteMockExamPhotoHandler', 'Fotoğraf silinemedi.')
  }
}

// Soru bazlı giriş formunda konu alanı için autocomplete önerisi: bu öğrencinin o ders için
// daha önce yazdığı konu adları, en sık kullanılan önce.
async function getMockExamTopicSuggestionsHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) return error

    const subjectName = (request.query.get('subjectName') || '').trim().slice(0, 100)
    if (!subjectName) return json(200, { topics: [] })

    const db = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      subjectName: { type: sql.NVarChar(100), value: subjectName },
    })
    const result = await db.query(`
      SELECT mq.topic_name, COUNT(*) AS usage_count
      FROM dbo.MockExamQuestions mq
      INNER JOIN dbo.MockExamSubjects s ON s.id = mq.mock_exam_subject_id
      INNER JOIN dbo.MockExams e ON e.id = s.mock_exam_id
      WHERE e.student_id = @studentId AND s.subject_name = @subjectName AND mq.topic_name IS NOT NULL
      GROUP BY mq.topic_name
      ORDER BY usage_count DESC, mq.topic_name ASC;
    `)
    return json(200, { topics: result.recordset.map((row) => row.topic_name) })
  } catch (error) {
    return handleError(error, 'getMockExamTopicSuggestionsHandler', 'Konu önerileri yüklenemedi.')
  }
}

// Öğrencinin tüm denemelerindeki soru bazlı girişleri (subject_name, topic_name) bazında
// toplar. restrictSubjectId/restrictSubjectName verilirse, 'genel' dışındaki (branş/etüt)
// denemeler yalnızca eşleşen derste sayılır — öğretmen yalnızca takip ettiği dersi görsün diye.
async function computeMockExamTopicStats(studentId, { restrictSubjectId, restrictSubjectName } = {}) {
  const db = await withRequest({ studentId: { type: sql.UniqueIdentifier, value: studentId } })
  const result = await db.query(`
    SELECT s.subject_name, s.subject_id, mq.topic_name, mq.status, e.kind
    FROM dbo.MockExamQuestions mq
    INNER JOIN dbo.MockExamSubjects s ON s.id = mq.mock_exam_subject_id
    INNER JOIN dbo.MockExams e ON e.id = s.mock_exam_id
    WHERE e.student_id = @studentId;
  `)

  const normalizedRestrictName = restrictSubjectName ? normalizeSubjectName(restrictSubjectName) : null
  const restricted = Boolean(restrictSubjectId || normalizedRestrictName)
  const rows = result.recordset.filter((row) => {
    if (row.kind === 'genel' || !restricted) return true
    if (restrictSubjectId && row.subject_id && String(row.subject_id).toLowerCase() === String(restrictSubjectId).toLowerCase()) {
      return true
    }
    return normalizedRestrictName ? normalizeSubjectName(row.subject_name) === normalizedRestrictName : false
  })

  const bySubject = new Map()
  for (const row of rows) {
    const topicKey = row.topic_name || 'Konu belirtilmedi'
    let topicsMap = bySubject.get(row.subject_name)
    if (!topicsMap) {
      topicsMap = new Map()
      bySubject.set(row.subject_name, topicsMap)
    }
    const entry = topicsMap.get(topicKey) || { total: 0, correct: 0, wrong: 0, blank: 0 }
    entry.total += 1
    if (row.status === 'dogru') entry.correct += 1
    else if (row.status === 'yanlis') entry.wrong += 1
    else entry.blank += 1
    topicsMap.set(topicKey, entry)
  }

  const subjects = [...bySubject.entries()].map(([subjectName, topicsMap]) => ({
    subjectName,
    topics: [...topicsMap.entries()]
      .map(([topic, stats]) => ({
        topic,
        ...stats,
        successRate: stats.total > 0 ? Math.round((stats.correct / stats.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => a.successRate - b.successRate),
  }))

  return { subjects }
}

async function getMockExamTopicStatsHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) return error
    return json(200, await computeMockExamTopicStats(studentId))
  } catch (error) {
    return handleError(error, 'getMockExamTopicStatsHandler', 'Konu analizi yüklenemedi.')
  }
}

// "Deneme Gelişimi" — son GROWTH_SUMMARY_WINDOW denemedeki (kind bağımsız, kronolojik) deneyim
// verisinin ham sayımı: duygu dağılımı, etiket sıklığı, "önceki hedefi uyguladın mı" cevap
// dağılımı. Yalnızca sayı döner — cümle/yorum üretmez (bkz. frontend mockExamGrowthText.js);
// bu ayrım "AI yorumu yok, sadece deterministik sayım" ürün kısıtını korur.
// restrictSubjectId/restrictSubjectName, computeMockExamTopicStats ile aynı öğretmen filtresini
// uygular: öğretmen kendi takip ettiği ders dışındaki deneyim verisini görmemeli.
async function computeMockExamGrowthSummary(studentId, { restrictSubjectId, restrictSubjectName } = {}) {
  const db = await withRequest({ studentId: { type: sql.UniqueIdentifier, value: studentId } })
  const result = await db.query(`
    SELECT e.id, e.kind, e.experience_mood, e.experience_previous_action_review,
           COALESCE(e.exam_date, CAST(e.created_at AS date)) AS sort_date, e.created_at,
           firstSubject.subject_id, firstSubject.subject_name
    FROM dbo.MockExams e
    OUTER APPLY (
      SELECT TOP 1 s.subject_id, s.subject_name
      FROM dbo.MockExamSubjects s
      WHERE s.mock_exam_id = e.id
      ORDER BY s.id
    ) firstSubject
    WHERE e.student_id = @studentId AND e.experience_mood IS NOT NULL
    ORDER BY sort_date DESC, e.created_at DESC;
  `)

  const normalizedRestrictName = restrictSubjectName ? normalizeSubjectName(restrictSubjectName) : null
  const restricted = Boolean(restrictSubjectId || normalizedRestrictName)
  const rows = result.recordset.filter((row) => {
    if (row.kind === 'genel' || !restricted) return true
    if (
      restrictSubjectId &&
      row.subject_id &&
      String(row.subject_id).toLowerCase() === String(restrictSubjectId).toLowerCase()
    ) {
      return true
    }
    return normalizedRestrictName ? normalizeSubjectName(row.subject_name) === normalizedRestrictName : false
  })

  const windowRows = rows.slice(0, GROWTH_SUMMARY_WINDOW)
  const examCount = windowRows.length

  const moodCounts = {}
  const previousActionReviewCounts = { evet: 0, kismen: 0, hayir: 0 }
  for (const row of windowRows) {
    moodCounts[row.experience_mood] = (moodCounts[row.experience_mood] || 0) + 1
    if (row.experience_previous_action_review) {
      previousActionReviewCounts[row.experience_previous_action_review] =
        (previousActionReviewCounts[row.experience_previous_action_review] || 0) + 1
    }
  }

  let tagCounts = []
  if (windowRows.length) {
    const bindings = {}
    const placeholders = windowRows.map((row, index) => {
      const key = `examId${index}`
      bindings[key] = { type: sql.UniqueIdentifier, value: row.id }
      return `@${key}`
    })
    const tagsDb = await withRequest(bindings)
    const tagsResult = await tagsDb.query(`
      SELECT tag_code, COUNT(*) AS cnt
      FROM dbo.MockExamExperienceTags
      WHERE mock_exam_id IN (${placeholders.join(', ')})
      GROUP BY tag_code
      ORDER BY cnt DESC, tag_code ASC;
    `)
    tagCounts = tagsResult.recordset.map((row) => ({ code: row.tag_code, count: row.cnt }))
  }

  return {
    examCount,
    minExams: GROWTH_SUMMARY_MIN_EXAMS,
    windowSize: GROWTH_SUMMARY_WINDOW,
    moodCounts,
    tagCounts,
    previousActionReviewCounts,
  }
}

async function getMockExamGrowthSummaryHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) return error
    return json(200, await computeMockExamGrowthSummary(studentId))
  } catch (error) {
    return handleError(error, 'getMockExamGrowthSummaryHandler', 'Deneme gelişimi yüklenemedi.')
  }
}

/* ------------------------------------------------------------------ öğretmen salt-okuma uçları */

async function listTeacherMockExamsHandler(request) {
  try {
    const { error, studentId, subjectId } = await requireTeacherStudentContext(request)
    if (error) return error

    let subjectName = null
    if (subjectId) {
      const subjectDb = await withRequest({ subjectId: { type: sql.UniqueIdentifier, value: subjectId } })
      const subjectResult = await subjectDb.query(`SELECT name FROM dbo.Subjects WHERE id = @subjectId;`)
      subjectName = subjectResult.recordset[0]?.name || null
    }

    const exams = await listMockExamsForStudent(studentId)
    const visibleExams = exams.filter((exam) => examVisibleToTeacher(exam, { subjectId, subjectName }))
    return json(200, { mockExams: visibleExams })
  } catch (error) {
    return handleError(error, 'listTeacherMockExamsHandler', 'Deneme sınavları yüklenemedi.')
  }
}

async function getTeacherMockExamHandler(request) {
  try {
    const { error, studentId } = await requireTeacherStudentContext(request)
    if (error) return error
    const exam = await getMockExamDetailForStudent(studentId, request.params.mockExamId)
    if (!exam) return json(404, { error: 'Deneme bulunamadı.' })
    return json(200, { mockExam: exam })
  } catch (error) {
    return handleError(error, 'getTeacherMockExamHandler', 'Deneme yüklenemedi.')
  }
}

// Deneme fotoğrafını öğretmen bağlamında getirir (öğrencinin id'siyle sahiplik denetimi).
async function getTeacherMockExamPhotoHandler(request) {
  try {
    const { error, studentId } = await requireTeacherStudentContext(request)
    if (error) return error
    const db = await withRequest({
      id: { type: sql.UniqueIdentifier, value: request.params.wrongQuestionId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const result = await db.query(`
      SELECT photo_url FROM dbo.WrongQuestions
      WHERE id = @id AND student_id = @studentId AND mock_exam_subject_id IS NOT NULL;
    `)
    const photoUrl = result.recordset[0]?.photo_url
    if (!photoUrl) return json(404, { error: 'Fotoğraf bulunamadı.' })
    return json(200, { photoUrl })
  } catch (error) {
    return handleError(error, 'getTeacherMockExamPhotoHandler', 'Fotoğraf yüklenemedi.')
  }
}

async function getTeacherMockExamTopicStatsHandler(request) {
  try {
    const { error, studentId, subjectId } = await requireTeacherStudentContext(request)
    if (error) return error

    let subjectName = null
    if (subjectId) {
      const subjectDb = await withRequest({ subjectId: { type: sql.UniqueIdentifier, value: subjectId } })
      const subjectResult = await subjectDb.query(`SELECT name FROM dbo.Subjects WHERE id = @subjectId;`)
      subjectName = subjectResult.recordset[0]?.name || null
    }

    const stats = await computeMockExamTopicStats(studentId, {
      restrictSubjectId: subjectId,
      restrictSubjectName: subjectName,
    })
    return json(200, stats)
  } catch (error) {
    return handleError(error, 'getTeacherMockExamTopicStatsHandler', 'Konu analizi yüklenemedi.')
  }
}

async function getTeacherMockExamGrowthSummaryHandler(request) {
  try {
    const { error, studentId, subjectId } = await requireTeacherStudentContext(request)
    if (error) return error

    let subjectName = null
    if (subjectId) {
      const subjectDb = await withRequest({ subjectId: { type: sql.UniqueIdentifier, value: subjectId } })
      const subjectResult = await subjectDb.query(`SELECT name FROM dbo.Subjects WHERE id = @subjectId;`)
      subjectName = subjectResult.recordset[0]?.name || null
    }

    const summary = await computeMockExamGrowthSummary(studentId, {
      restrictSubjectId: subjectId,
      restrictSubjectName: subjectName,
    })
    return json(200, summary)
  } catch (error) {
    return handleError(error, 'getTeacherMockExamGrowthSummaryHandler', 'Deneme gelişimi yüklenemedi.')
  }
}

/* ------------------------------------------------------------------ öğretmen Sınıf Analizi */

const UNSPECIFIED_GRADE = '__none__'

async function getTeacherClassMockExamAnalysisHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) return error

    const grade = (request.query.get('grade') || '').trim()
    if (!grade) return json(400, { error: 'Sınıf belirtilmeli.' })

    const isUnspecified = grade === UNSPECIFIED_GRADE
    const bindings = { teacherUserId: { type: sql.UniqueIdentifier, value: teacherUserId } }
    if (!isUnspecified) bindings.grade = { type: sql.NVarChar(20), value: grade }
    const gradeWhere = isUnspecified
      ? "(sp.grade IS NULL OR LTRIM(RTRIM(sp.grade)) = '')"
      : 'LTRIM(RTRIM(sp.grade)) = @grade'

    const rosterDb = await withRequest(bindings)
    const rosterResult = await rosterDb.query(`
      SELECT st.student_id, u.full_name AS student_full_name, sp.photo_url AS student_photo_url,
             st.id AS student_teacher_id, st.subject_id, subj.name AS subject_name
      FROM dbo.StudentTeachers st
      INNER JOIN dbo.Users u ON u.id = st.student_id
      LEFT JOIN dbo.StudentProfiles sp ON sp.student_id = st.student_id
      LEFT JOIN dbo.Subjects subj ON subj.id = st.subject_id
      WHERE st.teacher_user_id = @teacherUserId AND st.is_active = 1 AND ${gradeWhere}
      ORDER BY u.full_name ASC;
    `)

    // Öğrenci başına: öğretmenin bu öğrenciyle takip ettiği ders(ler)in kimlik + adları.
    const byStudent = new Map()
    for (const row of rosterResult.recordset) {
      let entry = byStudent.get(row.student_id)
      if (!entry) {
        entry = {
          studentId: row.student_id,
          studentFullName: row.student_full_name,
          studentTeacherId: row.student_teacher_id,
          subjectIds: new Set(),
          subjectNames: new Set(),
        }
        byStudent.set(row.student_id, entry)
      }
      if (row.subject_id) entry.subjectIds.add(String(row.subject_id).toLowerCase())
      if (row.subject_name) entry.subjectNames.add(normalizeSubjectName(row.subject_name))
    }
    const roster = [...byStudent.values()]

    // Branş İzleme / Etüt: öğretmen yalnızca kendi takip ettiği derse ait sonucu görür.
    // Genel Deneme: tüm dersler görünür.
    const teacherCanSee = (student, exam) => {
      if (exam.kind === 'genel') return true
      const subject = exam.subjects[0]
      if (!subject) return false
      if (subject.subjectId && student.subjectIds.has(String(subject.subjectId).toLowerCase())) return true
      return student.subjectNames.has(normalizeSubjectName(subject.subjectName))
    }

    // Her öğrencinin (öğretmenin görebildiği) deneme sonuçları ham haliyle döner; aylık
    // grafik toplulaştırmasını frontend (ClassMockExamPanel) yapar.
    const students = []
    for (const row of roster) {
      const exams = await listMockExamsForStudent(row.studentId)
      students.push({
        studentId: row.studentId,
        studentTeacherId: row.studentTeacherId,
        studentFullName: row.studentFullName,
        exams: exams
          .filter((exam) => teacherCanSee(row, exam))
          .map((exam) => ({
            id: exam.id,
            examDate: exam.examDate,
            createdAt: exam.createdAt,
            kind: exam.kind,
            net: exam.net,
            successRate: exam.successRate,
            subjects: exam.subjects.map((subject) => ({
              subjectName: subject.subjectName,
              net: subject.net,
              successRate: subject.successRate,
            })),
          })),
      })
    }

    return json(200, { grade, students })
  } catch (error) {
    return handleError(error, 'getTeacherClassMockExamAnalysisHandler', 'Sınıf deneme analizi yüklenemedi.')
  }
}

module.exports = {
  MOCK_EXAM_KINDS,
  GENEL_DENEME_TEMPLATE,
  BRANS_QUESTION_COUNT,
  EXPERIENCE_MOODS,
  EXPERIENCE_TAG_CODES,
  EXPERIENCE_REVIEW_ANSWERS,
  validateMockExamPayload,
  normalizeExperiencePayload,
  pickEligiblePreviousExam,
  computeNet,
  examVisibleToTeacher,
  listMockExamsForStudent,
  listMockExamsHandler,
  getMockExamHandler,
  createMockExamHandler,
  updateMockExamHandler,
  updateMockExamExperienceHandler,
  deleteMockExamHandler,
  addMockExamPhotoHandler,
  addMockExamQuestionPhotoHandler,
  deleteMockExamPhotoHandler,
  getMockExamTopicSuggestionsHandler,
  getMockExamTopicStatsHandler,
  getMockExamGrowthSummaryHandler,
  listTeacherMockExamsHandler,
  getTeacherMockExamHandler,
  getTeacherMockExamPhotoHandler,
  getTeacherMockExamTopicStatsHandler,
  getTeacherMockExamGrowthSummaryHandler,
  getTeacherClassMockExamAnalysisHandler,
}
