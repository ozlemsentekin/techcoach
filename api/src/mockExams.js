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
      const counts = normalizeCounts(row, tpl.total)
      if (counts.error) return { error: `${tpl.name}: ${counts.error}` }
      const photos = normalizePhotos(row)
      if (photos.error) return { error: `${tpl.name}: ${photos.error}` }
      if (photos.value.length > counts.value.wrong + counts.value.blank) {
        return { error: `${tpl.name}: fotoğraf sayısı yanlış + boş sayısını aşamaz.` }
      }
      subjects.push({
        subjectId: isGuid(row.subjectId) ? row.subjectId.trim().toLowerCase() : null,
        subjectName: tpl.name,
        totalQuestions: tpl.total,
        ...counts.value,
        photos: photos.value,
      })
    }
  } else {
    if (rawSubjects.length !== 1) {
      return { error: 'Bir ders seçilmelidir.' }
    }
    const row = rawSubjects[0]
    const subjectName = typeof row?.subjectName === 'string' ? row.subjectName.trim().slice(0, 100) : ''
    if (!subjectName) return { error: 'Ders seçilmelidir.' }

    // Etüt'te ayrı "toplam soru" alanı yok — toplam, doğru + yanlış + boş sayısıdır.
    let total
    let counts
    if (kind === 'brans') {
      total = BRANS_QUESTION_COUNT
      counts = normalizeCounts(row, total)
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
    const photos = normalizePhotos(row)
    if (photos.error) return { error: photos.error }
    if (photos.value.length > counts.value.wrong + counts.value.blank) {
      return { error: 'Fotoğraf sayısı yanlış + boş sayısını aşamaz.' }
    }

    subjects = [
      {
        subjectId: isGuid(row.subjectId) ? row.subjectId.trim().toLowerCase() : null,
        subjectName,
        totalQuestions: total,
        ...counts.value,
        photos: photos.value,
      },
    ]
  }

  return { value: { kind, examDate, title, subjects } }
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
    createdByName: examRecord.created_by_name || undefined,
    createdAt: examRecord.created_at,
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
      SELECT e.id, e.kind, e.exam_date, e.title, e.created_at, u.full_name AS created_by_name
      FROM dbo.MockExams e
      LEFT JOIN dbo.Users u ON u.id = e.created_by_user_id
      WHERE e.student_id = @studentId
      ORDER BY COALESCE(e.exam_date, CAST(e.created_at AS date)) DESC, e.created_at DESC;
    `),
    subjectsDb.query(`
      SELECT s.id, s.mock_exam_id, s.subject_id, s.subject_name, s.total_questions,
             s.correct_count, s.wrong_count, s.blank_count,
             (SELECT COUNT(*) FROM dbo.WrongQuestions wq
              WHERE wq.mock_exam_subject_id = s.id AND wq.photo_url IS NOT NULL) AS photo_count
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
    SELECT e.id, e.kind, e.exam_date, e.title, e.created_at, u.full_name AS created_by_name
    FROM dbo.MockExams e
    LEFT JOIN dbo.Users u ON u.id = e.created_by_user_id
    WHERE e.id = @mockExamId AND e.student_id = @studentId;
  `)
  const examRecord = examResult.recordset[0]
  if (!examRecord) return null

  const [subjectsDb, questionsDb] = await Promise.all([
    withRequest({ mockExamId: { type: sql.UniqueIdentifier, value: mockExamId } }),
    withRequest({ mockExamId: { type: sql.UniqueIdentifier, value: mockExamId } }),
  ])
  const [subjectsResult, questionsResult] = await Promise.all([
    subjectsDb.query(`
      SELECT s.id, s.mock_exam_id, s.subject_id, s.subject_name, s.total_questions,
             s.correct_count, s.wrong_count, s.blank_count,
             (SELECT COUNT(*) FROM dbo.WrongQuestions wq
              WHERE wq.mock_exam_subject_id = s.id AND wq.photo_url IS NOT NULL) AS photo_count
      FROM dbo.MockExamSubjects s
      WHERE s.mock_exam_id = @mockExamId;
    `),
    questionsDb.query(`
      SELECT wq.id, wq.mock_exam_subject_id, wq.question_number,
             CASE WHEN wq.photo_url IS NOT NULL THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS has_photo,
             wq.created_at
      FROM dbo.WrongQuestions wq
      INNER JOIN dbo.MockExamSubjects s ON s.id = wq.mock_exam_subject_id
      WHERE s.mock_exam_id = @mockExamId
      ORDER BY wq.created_at ASC;
    `),
  ])

  const questionsBySubject = new Map()
  questionsResult.recordset.forEach((row) => {
    const list = questionsBySubject.get(row.mock_exam_subject_id) || []
    list.push({
      id: row.id,
      questionNumber: row.question_number || undefined,
      hasPhoto: Boolean(row.has_photo),
      createdAt: row.created_at,
    })
    questionsBySubject.set(row.mock_exam_subject_id, list)
  })

  const exam = buildExam(examRecord, subjectsResult.recordset)
  exam.subjects = exam.subjects.map((subject) => ({
    ...subject,
    questions: questionsBySubject.get(subject.id) || [],
  }))
  return exam
}

const MOCK_EXAM_WQ_INSERT_SQL = `
  INSERT INTO dbo.WrongQuestions
    (student_id, mock_exam_subject_id, subject, topic, book_name, question_number, error_type, photo_url)
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
    const { kind, examDate, title, subjects } = check.value

    const mockExamId = await withTransaction(async (makeRequest) => {
      const examResult = await makeRequest({
        studentId: { type: sql.UniqueIdentifier, value: studentId },
        kind: { type: sql.NVarChar(20), value: kind },
        examDate: { type: sql.Date, value: examDate },
        title: { type: sql.NVarChar(200), value: title },
        createdBy: { type: sql.UniqueIdentifier, value: actorId || null },
      }).query(`
        INSERT INTO dbo.MockExams (student_id, kind, exam_date, title, created_by_user_id)
        OUTPUT inserted.id
        VALUES (@studentId, @kind, @examDate, @title, @createdBy);
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
        }).query(`
          INSERT INTO dbo.MockExamSubjects
            (mock_exam_id, subject_id, subject_name, total_questions, correct_count, wrong_count, blank_count)
          OUTPUT inserted.id
          VALUES (@mockExamId, @subjectId, @subjectName, @total, @correct, @wrong, @blank);
        `)
        const subjectRowId = subjectResult.recordset[0].id
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
    const { examDate, title, subjects } = rebuilt.value

    await withTransaction(async (makeRequest) => {
      await makeRequest({
        mockExamId: { type: sql.UniqueIdentifier, value: mockExamId },
        examDate: { type: sql.Date, value: examDate },
        title: { type: sql.NVarChar(200), value: title },
      }).query(`
        UPDATE dbo.MockExams SET exam_date = @examDate, title = @title, updated_at = SYSUTCDATETIME()
        WHERE id = @mockExamId;
      `)

      for (const subject of subjects) {
        await makeRequest({
          mockExamId: { type: sql.UniqueIdentifier, value: mockExamId },
          subjectName: { type: sql.NVarChar(100), value: subject.subjectName },
          total: { type: sql.Int, value: subject.totalQuestions },
          correct: { type: sql.Int, value: subject.correct },
          wrong: { type: sql.Int, value: subject.wrong },
          blank: { type: sql.Int, value: subject.blank },
        }).query(`
          UPDATE dbo.MockExamSubjects
          SET total_questions = @total, correct_count = @correct, wrong_count = @wrong, blank_count = @blank
          WHERE mock_exam_id = @mockExamId AND subject_name = @subjectName;
        `)
      }
    })

    const exam = await getMockExamDetailForStudent(studentId, mockExamId)
    return json(200, { mockExam: exam })
  } catch (error) {
    return handleError(error, 'updateMockExamHandler', 'Deneme güncellenemedi.')
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

/* ------------------------------------------------------------------ öğretmen salt-okuma uçları */

async function listTeacherMockExamsHandler(request) {
  try {
    const { error, studentId } = await requireTeacherStudentContext(request)
    if (error) return error
    return json(200, { mockExams: await listMockExamsForStudent(studentId) })
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
  validateMockExamPayload,
  computeNet,
  listMockExamsForStudent,
  listMockExamsHandler,
  getMockExamHandler,
  createMockExamHandler,
  updateMockExamHandler,
  deleteMockExamHandler,
  addMockExamPhotoHandler,
  deleteMockExamPhotoHandler,
  listTeacherMockExamsHandler,
  getTeacherMockExamHandler,
  getTeacherMockExamPhotoHandler,
  getTeacherClassMockExamAnalysisHandler,
}
