const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { clearSessionHeaders, json } = require('./http')
const { isSessionError } = require('./security')
const { toReadUrl } = require('./blobStore')
const { requireStudentContext, requireStudentWriteContext } = require('./studentScope')
const { fetchWrongQuestionAnalyses, addWrongQuestionAnalysisComment, MISTAKE_REASONS } = require('./progress')

// Hata Defteri kart görünümü (öğretmen "Çeyrek Dönem Analizi" + öğrenci/veli/öğretmen Hata Defteri):
// bir dersin TÜM yanlışları tek istekte, fotoğraf adresleriyle (SAS) birlikte döner — slayt
// görüntüleyici her soru için ayrı istek atmadan gezinebilsin, sıradaki görseller önceden
// yüklenebilsin diye. Her rol (ogrenci | ebeveyn | ogretmen) kendi analizini yazar: "Analiz yapıldı"
// = izleyicinin o soruya bıraktığı en az bir yorum (dbo.WrongQuestionAnalyses, kendi rolü ve
// kendi kullanıcı kimliğiyle). Yorumlar öğrencinin "Hata Analizlerim" menüsünde de görünür.

const SESSION_TOPIC_MAX = 200
const SESSION_NOTE_MAX = 1000

function readSessionAnalysisPayload(payload) {
  const questionTopic = typeof payload?.questionTopic === 'string' ? payload.questionTopic.trim() : ''
  const note = typeof payload?.note === 'string' ? payload.note.trim() : ''
  const mistakeReason = payload?.mistakeReason || null
  if (mistakeReason && !MISTAKE_REASONS.includes(mistakeReason)) {
    return { error: json(400, { error: 'Geçersiz hata nedeni.' }) }
  }
  if (!questionTopic && !note) {
    return { error: json(400, { error: 'Sorunun konusu veya dikkat edilmesi gereken yazılmalı.' }) }
  }
  if (questionTopic.length > SESSION_TOPIC_MAX) {
    return { error: json(400, { error: `Sorunun konusu en fazla ${SESSION_TOPIC_MAX} karakter olabilir.` }) }
  }
  if (note.length > SESSION_NOTE_MAX) {
    return { error: json(400, { error: `Dikkat edilmesi gereken en fazla ${SESSION_NOTE_MAX} karakter olabilir.` }) }
  }
  return { value: { questionTopic: questionTopic || null, note: note || null, mistakeReason } }
}

function sanitizeSessionAnalysis(row) {
  if (!row) return null
  return {
    id: row.id,
    questionTopic: row.question_topic || undefined,
    note: row.note || undefined,
    mistakeReason: row.mistake_reason || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Hatanın "tarihi" (gün, Türkiye saati): denemede deneme tarihi, kitapta testin çözüldüğü gün.
function sessionErrorDate(examDate, createdAt) {
  if (examDate) {
    return examDate instanceof Date ? examDate.toISOString().slice(0, 10) : String(examDate).slice(0, 10)
  }
  if (!createdAt) return ''
  const time = new Date(createdAt).getTime()
  return Number.isNaN(time) ? '' : new Date(time + 3 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function questionNumberSortKey(value) {
  const number = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(number) ? number : Number.MAX_SAFE_INTEGER
}

// Bir öğrencinin bir dersteki tüm (fotoğraflı) yanlışları + izleyicinin kendi analizi.
async function buildMistakeAnalysisSession({ studentId, subjectName, actorId, role }) {
  const bindings = {
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    subject: { type: sql.NVarChar(100), value: subjectName },
    actorId: { type: sql.UniqueIdentifier, value: actorId },
    role: { type: sql.NVarChar(20), value: role },
  }
  const [questionsDb, mineDb] = await Promise.all([withRequest(bindings), withRequest(bindings)])
  const [questionsResult, mineResult, analysesMap] = await Promise.all([
    questionsDb.query(`
      SELECT wq.id, wq.question_number, wq.test_name, wq.created_at, wq.photo_url,
             wq.mock_exam_subject_id,
             COALESCE(tp.name, wq.topic) AS topic,
             t.topic_name,
             COALESCE(rb.name, rb2.name, wq.book_name) AS book_name,
             COALESCE(pub.name, pub2.name, wq.publisher_name) AS publisher_name,
             me.title AS mock_exam_title, me.exam_date AS mock_exam_date, me.kind AS mock_exam_kind,
             tak.correct_label AS correct_answer,
             COALESCE(tk.completed_at, manual.marked_at) AS solved_at
      FROM dbo.WrongQuestions wq
      LEFT JOIN dbo.Tasks tk ON tk.id = wq.task_id
      OUTER APPLY (
        SELECT TOP 1 m.marked_at FROM dbo.StudentManualTestCompletions m
        WHERE m.student_id = wq.student_id AND m.test_id = wq.test_id
        ORDER BY m.marked_at DESC
      ) manual
      LEFT JOIN dbo.ResourceBookTopicTests t ON t.id = wq.test_id
      LEFT JOIN dbo.ResourceBookTopics tp ON tp.id = t.topic_id
      LEFT JOIN dbo.ResourceBooks rb ON rb.id = tp.resource_book_id
      LEFT JOIN dbo.Publishers pub ON pub.id = rb.publisher_id
      LEFT JOIN dbo.ResourceBooks rb2 ON rb2.id = wq.resource_book_id
      LEFT JOIN dbo.Publishers pub2 ON pub2.id = rb2.publisher_id
      LEFT JOIN dbo.TestAnswerKeys tak ON tak.test_id = wq.test_id AND tak.order_no = wq.question_number
      LEFT JOIN dbo.MockExamSubjects mes ON mes.id = wq.mock_exam_subject_id
      LEFT JOIN dbo.MockExams me ON me.id = mes.mock_exam_id
      WHERE wq.student_id = @studentId AND wq.subject = @subject AND wq.photo_url IS NOT NULL;
    `),
    mineDb.query(`
      SELECT a.id, a.wrong_question_id, a.question_topic, a.note, a.mistake_reason, a.created_at, a.updated_at
      FROM dbo.WrongQuestionAnalyses a
      INNER JOIN dbo.WrongQuestions wq ON wq.id = a.wrong_question_id
      WHERE wq.student_id = @studentId AND wq.subject = @subject
        AND a.role = @role AND a.analyzed_by_user_id = @actorId
      ORDER BY a.created_at ASC;
    `),
    fetchWrongQuestionAnalyses(studentId, { subject: subjectName }),
  ])

  // Aynı soruya birden fazla kendi yorumu varsa formda en sonuncusu düzenlenir.
  const mineByQuestion = new Map()
  mineResult.recordset.forEach((row) => mineByQuestion.set(row.wrong_question_id, row))
  const mineIds = new Set(mineResult.recordset.map((row) => row.id))

  return questionsResult.recordset
    .map((row) => {
      const isMockExam = Boolean(row.mock_exam_subject_id)
      return {
        id: row.id,
        questionNumber: row.question_number || undefined,
        testName: row.test_name || undefined,
        topic: isMockExam ? undefined : row.topic || undefined,
        topicName: row.topic_name || undefined,
        bookName: isMockExam ? 'Deneme Sınavları' : row.book_name || undefined,
        publisherName: isMockExam ? undefined : row.publisher_name || undefined,
        mockExamTitle: isMockExam ? row.mock_exam_title || row.topic || undefined : undefined,
        mockExamDate: isMockExam ? row.mock_exam_date || undefined : undefined,
        mockExamKind: isMockExam ? row.mock_exam_kind || undefined : undefined,
        correctAnswer: row.correct_answer || undefined,
        createdAt: row.created_at,
        // Kitapta testin çözüldüğü gün (görevin tamamlanması / kitaplıktan işaretlenme), yoksa kayıt günü.
        errorDate: sessionErrorDate(
          isMockExam ? row.mock_exam_date : null,
          isMockExam ? row.created_at : row.solved_at || row.created_at,
        ),
        photoUrl: toReadUrl(row.photo_url),
        // Diğer rollerin (ve aynı rolde başka kişinin) yorumları salt-okunur bağlam olarak gelir.
        otherComments: (analysesMap.get(row.id) || []).filter((comment) => !mineIds.has(comment.id)),
        myAnalysis: sanitizeSessionAnalysis(mineByQuestion.get(row.id)),
      }
    })
    // En yeni tarih önce (ör. bugünkü denemenin hataları en üstte); aynı gün içinde kaynak/test/soru
    // sırası korunur.
    .sort(
      (a, b) =>
        String(b.errorDate || '').localeCompare(String(a.errorDate || '')) ||
        String(a.bookName || '').localeCompare(String(b.bookName || ''), 'tr') ||
        String(a.topic || a.mockExamTitle || '').localeCompare(String(b.topic || b.mockExamTitle || ''), 'tr') ||
        String(a.testName || '').localeCompare(String(b.testName || ''), 'tr', { numeric: true }) ||
        questionNumberSortKey(a.questionNumber) - questionNumberSortKey(b.questionNumber) ||
        new Date(a.createdAt) - new Date(b.createdAt),
    )
}

// Soru bu öğrenciye (ve verildiyse bu derse) ait mi?
async function wrongQuestionInScope({ wrongQuestionId, studentId, subjectName }) {
  const db = await withRequest({
    id: { type: sql.UniqueIdentifier, value: wrongQuestionId },
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    ...(subjectName ? { subject: { type: sql.NVarChar(100), value: subjectName } } : {}),
  })
  const result = await db.query(`
    SELECT 1 AS ok FROM dbo.WrongQuestions
    WHERE id = @id AND student_id = @studentId ${subjectName ? 'AND subject = @subject' : ''};
  `)
  return result.recordset.length > 0
}

async function createOwnAnalysis({ wrongQuestionId, studentId, subjectName, role, actorId, value }) {
  if (!(await wrongQuestionInScope({ wrongQuestionId, studentId, subjectName }))) return null
  const comment = await addWrongQuestionAnalysisComment(wrongQuestionId, role, value, actorId)
  return {
    id: comment.id,
    questionTopic: comment.questionTopic,
    note: comment.note,
    mistakeReason: comment.mistakeReason,
    createdAt: comment.createdAt,
    updatedAt: comment.createdAt,
  }
}

// Kişi YALNIZCA kendi yazdığı (aynı rol + aynı kullanıcı) analizi düzeltebilir/geri alabilir;
// sahiplik ve öğrenci/ders kapsamı tek SQL koşulunda doğrulanır.
function ownAnalysisScope({ analysisId, wrongQuestionId, studentId, subjectName, role, actorId }) {
  return {
    bindings: {
      analysisId: { type: sql.UniqueIdentifier, value: analysisId },
      wrongQuestionId: { type: sql.UniqueIdentifier, value: wrongQuestionId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      role: { type: sql.NVarChar(20), value: role },
      actorId: { type: sql.UniqueIdentifier, value: actorId },
      ...(subjectName ? { subject: { type: sql.NVarChar(100), value: subjectName } } : {}),
    },
    where: `
      a.id = @analysisId AND a.wrong_question_id = @wrongQuestionId
      AND a.role = @role AND a.analyzed_by_user_id = @actorId
      AND EXISTS (
        SELECT 1 FROM dbo.WrongQuestions wq
        WHERE wq.id = a.wrong_question_id AND wq.student_id = @studentId
          ${subjectName ? 'AND wq.subject = @subject' : ''}
      )
    `,
  }
}

async function updateOwnAnalysis(scope, value) {
  const { bindings, where } = ownAnalysisScope(scope)
  const db = await withRequest({
    ...bindings,
    questionTopic: { type: sql.NVarChar(200), value: value.questionTopic },
    note: { type: sql.NVarChar(1000), value: value.note },
    mistakeReason: { type: sql.NVarChar(30), value: value.mistakeReason },
  })
  const result = await db.query(`
    UPDATE a
    SET question_topic = @questionTopic, note = @note, mistake_reason = @mistakeReason,
        updated_at = SYSUTCDATETIME()
    OUTPUT inserted.id, inserted.question_topic, inserted.note, inserted.mistake_reason,
           inserted.created_at, inserted.updated_at
    FROM dbo.WrongQuestionAnalyses a
    WHERE ${where};
  `)
  return sanitizeSessionAnalysis(result.recordset[0])
}

async function deleteOwnAnalysis(scope) {
  const { bindings, where } = ownAnalysisScope(scope)
  const db = await withRequest(bindings)
  const result = await db.query(`
    DELETE a
    OUTPUT deleted.id
    FROM dbo.WrongQuestionAnalyses a
    WHERE ${where};
  `)
  return Boolean(result.recordset[0])
}

/* ------------------------------------------------------------------ öğrenci / veli uçları */

function panelRole(actorRole) {
  return actorRole === 'ebeveyn' ? 'ebeveyn' : 'ogrenci'
}

function handlePanelError(error, label, message) {
  if (isConfigError(error)) return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
  if (isSessionError(error)) return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
  console.error(`${label} failed`, error)
  return json(500, { error: message })
}

// GET panel/mistake-analysis-session?subject=<ders adı>&studentId=<veli için>
async function getPanelMistakeAnalysisSessionHandler(request) {
  try {
    const { error, studentId, actorId, actorRole } = await requireStudentContext(request)
    if (error) return error
    const subjectName = String(request.query.get('subject') || '').trim()
    if (!subjectName) return json(400, { error: 'Ders belirtilmeli.' })
    const items = await buildMistakeAnalysisSession({ studentId, subjectName, actorId, role: panelRole(actorRole) })
    return json(200, { subjectName, items })
  } catch (error) {
    return handlePanelError(error, 'getPanelMistakeAnalysisSessionHandler', 'Hata defteri yüklenemedi.')
  }
}

async function createPanelMistakeAnalysisHandler(request) {
  try {
    const { error, studentId, actorId, actorRole } = await requireStudentWriteContext(request)
    if (error) return error
    const parsed = readSessionAnalysisPayload(await request.json().catch(() => null))
    if (parsed.error) return parsed.error
    const analysis = await createOwnAnalysis({
      wrongQuestionId: request.params.wrongQuestionId,
      studentId,
      role: panelRole(actorRole),
      actorId,
      value: parsed.value,
    })
    if (!analysis) return json(404, { error: 'Kayıt bulunamadı.' })
    return json(201, { analysis })
  } catch (error) {
    return handlePanelError(error, 'createPanelMistakeAnalysisHandler', 'Analiz kaydedilemedi.')
  }
}

async function updatePanelMistakeAnalysisHandler(request) {
  try {
    const { error, studentId, actorId, actorRole } = await requireStudentWriteContext(request)
    if (error) return error
    const parsed = readSessionAnalysisPayload(await request.json().catch(() => null))
    if (parsed.error) return parsed.error
    const analysis = await updateOwnAnalysis(
      {
        analysisId: request.params.analysisId,
        wrongQuestionId: request.params.wrongQuestionId,
        studentId,
        role: panelRole(actorRole),
        actorId,
      },
      parsed.value,
    )
    if (!analysis) return json(404, { error: 'Analiz bulunamadı.' })
    return json(200, { analysis })
  } catch (error) {
    return handlePanelError(error, 'updatePanelMistakeAnalysisHandler', 'Analiz güncellenemedi.')
  }
}

async function deletePanelMistakeAnalysisHandler(request) {
  try {
    const { error, studentId, actorId, actorRole } = await requireStudentWriteContext(request)
    if (error) return error
    const deleted = await deleteOwnAnalysis({
      analysisId: request.params.analysisId,
      wrongQuestionId: request.params.wrongQuestionId,
      studentId,
      role: panelRole(actorRole),
      actorId,
    })
    if (!deleted) return json(404, { error: 'Analiz bulunamadı.' })
    return json(200, { ok: true })
  } catch (error) {
    return handlePanelError(error, 'deletePanelMistakeAnalysisHandler', 'Analiz geri alınamadı.')
  }
}

module.exports = {
  readSessionAnalysisPayload,
  buildMistakeAnalysisSession,
  createOwnAnalysis,
  updateOwnAnalysis,
  deleteOwnAnalysis,
  getPanelMistakeAnalysisSessionHandler,
  createPanelMistakeAnalysisHandler,
  updatePanelMistakeAnalysisHandler,
  deletePanelMistakeAnalysisHandler,
}
