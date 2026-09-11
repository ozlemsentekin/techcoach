const Anthropic = require('@anthropic-ai/sdk')
const { sql, withRequest } = require('./db')
const { getAnthropicConfig, isConfigError } = require('./config')
const { json } = require('./http')
const { requireStudentContext, requireStudentWriteContext } = require('./studentScope')
const { isSessionError } = require('./security')
const { fetchWrongQuestionAnalyses } = require('./progress')

const MODEL = 'claude-opus-5'
const MAX_IMAGES = 20 // maliyet + Azure Functions HTTP süresi guard'ı
const MAX_REPORTS_PER_DAY = 5
const SAME_SCOPE_COOLDOWN_HOURS = 1

// Claude'un döndüreceği yapılandırılmış rapor. Ekranda "yol gösterici" düzende render edilir.
const REPORT_SCHEMA = {
  type: 'object',
  properties: {
    overview: { type: 'string', description: '2-3 cümlelik genel durum değerlendirmesi' },
    analyzedQuestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          testName: { type: 'string', description: 'Kaynak · Test adı' },
          questionNumber: { type: 'integer' },
          topic: { type: 'string' },
          correctAnswer: { type: 'string' },
          whatItAsked: { type: 'string', description: 'Sorunun ne sorduğu, kısa' },
          likelyMistake: { type: 'string', description: 'Öğrencinin nerede/neden hata yapmış olabileceği' },
        },
        required: ['testName', 'questionNumber', 'topic', 'correctAnswer', 'whatItAsked', 'likelyMistake'],
        additionalProperties: false,
      },
    },
    gaps: {
      type: 'array',
      description: 'Sorularda tekrar eden kavram eksikleri, önceliklendirilmiş',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          explanation: { type: 'string', description: 'Neden eksik, hangi sorulardan anlaşılıyor' },
          priority: { type: 'string', enum: ['yuksek', 'orta', 'dusuk'] },
        },
        required: ['title', 'explanation', 'priority'],
        additionalProperties: false,
      },
    },
    studyRecommendations: {
      type: 'array',
      description: 'Somut, yol gösterici çalışma önerileri',
      items: { type: 'string' },
    },
    reinforcementTopics: {
      type: 'array',
      description: 'Tekrar edilmesi gereken kazanım/konu başlıkları',
      items: { type: 'string' },
    },
  },
  required: ['overview', 'analyzedQuestions', 'gaps', 'studyRecommendations', 'reinforcementTopics'],
  additionalProperties: false,
}

const ANALYSIS_INSTRUCTION = `Yukarıdaki görseller bir 8. sınıf öğrencisinin bir soru bankasında ÇÖZÜP YANLIŞ YAPTIĞI sorulardır. Görsellerde el yazısıyla yapılmış işaretlemeler öğrencinin işaretlediği (çoğunlukla yanlış) cevap olabilir; her sorunun gerçek doğru cevabı görselden ön­ceki metinde verildi.

Görevin:
1. Her soru için "ne sorulduğunu" ve öğrencinin "nerede/neden hata yapmış olabileceğini" kısa ve somut biçimde çıkar (analyzedQuestions).
2. Sorular arasında TEKRAR EDEN kavram eksiklerini bul, önem sırasına koy (gaps). Tek soruda görünen bir şeyi düşük, birden çok soruda görüneni yüksek öncelikli işaretle.
3. Öğrenciye/veliye yol gösterecek, uygulanabilir çalışma önerileri yaz (studyRecommendations).
4. Tekrar edilmesi gereken kazanım/konu başlıklarını listele (reinforcementTopics).

Tümü Türkçe olsun. Sadece verilen JSON şemasına uygun yanıt ver.`

function getAnthropicClient() {
  const { anthropicApiKey } = getAnthropicConfig()
  return new Anthropic({ apiKey: anthropicApiKey })
}

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/(?:png|jpe?g|gif|webp));base64,(.+)$/i.exec(dataUrl || '')
  if (!match) return null
  const mediaType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase()
  return { mediaType, data: match[2] }
}

// --- Sorgular -------------------------------------------------------------------

// Analiz edilebilir (hata görseli olan) derslerin ders başına soru sayısı.
async function fetchAvailableSubjects(studentId) {
  const requestDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
  })
  const result = await requestDb.query(`
    SELECT wq.subject AS subject, COUNT(*) AS question_count
    FROM dbo.WrongQuestions wq
    WHERE wq.student_id = @studentId AND wq.photo_url IS NOT NULL AND wq.subject IS NOT NULL
    GROUP BY wq.subject
    ORDER BY wq.subject;
  `)
  return result.recordset.map((row) => ({ subject: row.subject, questionCount: row.question_count }))
}

// Bir derste hata görseli olan içerik (konu) adları, içerik başına soru sayısı.
async function fetchSubjectTopics(studentId, subject) {
  const requestDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    subject: { type: sql.NVarChar(100), value: subject },
  })
  const result = await requestDb.query(`
    SELECT COALESCE(tp.name, wq.topic) AS topic_name, COUNT(*) AS question_count
    FROM dbo.WrongQuestions wq
    LEFT JOIN dbo.ResourceBookTopicTests t ON t.id = wq.test_id
    LEFT JOIN dbo.ResourceBookTopics tp ON tp.id = t.topic_id
    WHERE wq.student_id = @studentId AND wq.subject = @subject AND wq.photo_url IS NOT NULL
      AND COALESCE(tp.name, wq.topic) IS NOT NULL
    GROUP BY COALESCE(tp.name, wq.topic)
    ORDER BY question_count DESC, topic_name;
  `)
  return result.recordset.map((row) => ({ topicName: row.topic_name, questionCount: row.question_count }))
}

function bindTopicList(topicNames) {
  const params = {}
  const placeholders = topicNames.map((name, index) => {
    params[`topic${index}`] = { type: sql.NVarChar(200), value: name }
    return `@topic${index}`
  })
  return { params, inClause: placeholders.join(', ') }
}

// Seçili içeriklerdeki, hata görseli olan yanlış sorular — görselleriyle birlikte (en yeni MAX_IMAGES).
async function fetchAnalyzableQuestions(studentId, subject, topicNames) {
  const { params, inClause } = bindTopicList(topicNames)
  const requestDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    subject: { type: sql.NVarChar(100), value: subject },
    ...params,
  })
  const result = await requestDb.query(`
    SELECT wq.id, wq.question_number, wq.photo_url, wq.created_at,
           COALESCE(tp.name, wq.topic) AS topic,
           COALESCE(rb.name, wq.book_name) AS book_name,
           COALESCE(pub.name, wq.publisher_name) AS publisher_name,
           wq.test_name,
           tak.correct_label AS correct_answer
    FROM dbo.WrongQuestions wq
    LEFT JOIN dbo.ResourceBookTopicTests t ON t.id = wq.test_id
    LEFT JOIN dbo.ResourceBookTopics tp ON tp.id = t.topic_id
    LEFT JOIN dbo.ResourceBooks rb ON rb.id = tp.resource_book_id
    LEFT JOIN dbo.Publishers pub ON pub.id = rb.publisher_id
    LEFT JOIN dbo.TestAnswerKeys tak ON tak.test_id = wq.test_id AND tak.order_no = wq.question_number
    WHERE wq.student_id = @studentId AND wq.subject = @subject AND wq.photo_url IS NOT NULL
      AND COALESCE(tp.name, wq.topic) IN (${inClause})
    ORDER BY wq.created_at DESC;
  `)
  return result.recordset
}

// Rapor detayında galeriye verilecek yanlış-soru meta bilgisi (görselleri tembel çekilir).
async function fetchWrongQuestionsForGallery(studentId, ids) {
  if (!ids.length) return []
  const params = {}
  const placeholders = ids.map((id, index) => {
    params[`id${index}`] = { type: sql.UniqueIdentifier, value: id }
    return `@id${index}`
  })
  const requestDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    ...params,
  })
  const result = await requestDb.query(`
    SELECT wq.id, wq.question_number,
           COALESCE(tp.name, wq.topic) AS topic,
           COALESCE(rb.name, wq.book_name) AS book_name,
           COALESCE(pub.name, wq.publisher_name) AS publisher_name,
           wq.test_name, wq.error_type,
           tak.correct_label AS correct_answer
    FROM dbo.WrongQuestions wq
    LEFT JOIN dbo.ResourceBookTopicTests t ON t.id = wq.test_id
    LEFT JOIN dbo.ResourceBookTopics tp ON tp.id = t.topic_id
    LEFT JOIN dbo.ResourceBooks rb ON rb.id = tp.resource_book_id
    LEFT JOIN dbo.Publishers pub ON pub.id = rb.publisher_id
    LEFT JOIN dbo.TestAnswerKeys tak ON tak.test_id = wq.test_id AND tak.order_no = wq.question_number
    WHERE wq.student_id = @studentId AND wq.id IN (${placeholders.join(', ')});
  `)
  const analysesMap = await fetchWrongQuestionAnalyses(studentId).catch(() => new Map())
  const byId = new Map(
    result.recordset.map((row) => [
      String(row.id).toLowerCase(),
      {
        id: row.id,
        questionNumber: row.question_number || undefined,
        topic: row.topic || undefined,
        bookName: row.book_name || undefined,
        publisherName: row.publisher_name || undefined,
        testName: row.test_name || undefined,
        errorType: row.error_type,
        correctAnswer: row.correct_answer ? String(row.correct_answer).trim() : undefined,
        hasPhoto: true,
        analyses: analysesMap.get(row.id) || {},
      },
    ]),
  )
  // Rapordaki sırayı koru
  return ids.map((id) => byId.get(String(id).toLowerCase())).filter(Boolean)
}

// --- Rapor üretimi -------------------------------------------------------------

class ReportGenerationError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function generateReport(questionRows) {
  const usable = questionRows
    .map((row) => ({ row, parsed: parseDataUrl(row.photo_url) }))
    .filter((entry) => entry.parsed)
    .slice(0, MAX_IMAGES)

  if (!usable.length) {
    throw new ReportGenerationError(400, 'Seçilen içeriklerde analiz edilecek hata görseli bulunamadı.')
  }

  const content = []
  usable.forEach((entry, index) => {
    const { row, parsed } = entry
    const label = [row.publisher_name, row.book_name, row.test_name].filter(Boolean).join(' · ')
    content.push({ type: 'image', source: { type: 'base64', media_type: parsed.mediaType, data: parsed.data } })
    content.push({
      type: 'text',
      text: `Soru ${index + 1} — ${label || 'Kaynak bilinmiyor'} · Konu: ${row.topic || '-'} · Soru no: ${
        row.question_number || '-'
      } · Doğru cevap: ${row.correct_answer ? String(row.correct_answer).trim() : 'bilinmiyor'}`,
    })
  })
  content.push({ type: 'text', text: ANALYSIS_INSTRUCTION })

  const client = getAnthropicClient()
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    output_config: { format: { type: 'json_schema', schema: REPORT_SCHEMA } },
    messages: [{ role: 'user', content }],
  })

  if (response.stop_reason === 'refusal') {
    throw new ReportGenerationError(422, 'Görseller işlenemedi (model isteği reddetti).')
  }

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock) {
    throw new ReportGenerationError(502, 'Yapay zeka beklenmeyen bir yanıt döndürdü.')
  }

  let report
  try {
    report = JSON.parse(textBlock.text)
  } catch {
    throw new ReportGenerationError(502, 'Yapay zeka yanıtı okunamadı.')
  }

  return { report, usedQuestionRows: usable.map((entry) => entry.row) }
}

async function checkQuota(studentId, subject, sortedTopicNamesJson) {
  const requestDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    subject: { type: sql.NVarChar(100), value: subject },
    topicNamesJson: { type: sql.NVarChar(sql.MAX), value: sortedTopicNamesJson },
  })
  const result = await requestDb.query(`
    SELECT
      (SELECT COUNT(*) FROM dbo.AiAnalysisReports
        WHERE student_id = @studentId AND created_at > DATEADD(DAY, -1, SYSUTCDATETIME())) AS day_count,
      (SELECT COUNT(*) FROM dbo.AiAnalysisReports
        WHERE student_id = @studentId AND subject = @subject
          AND topic_names_json = @topicNamesJson
          AND created_at > DATEADD(HOUR, -${SAME_SCOPE_COOLDOWN_HOURS}, SYSUTCDATETIME())) AS recent_same_scope;
  `)
  const row = result.recordset[0]
  if (row.recent_same_scope > 0) {
    throw new ReportGenerationError(429, 'Bu içerikler için az önce bir rapor oluşturuldu. Lütfen biraz sonra tekrar deneyin.')
  }
  if (row.day_count >= MAX_REPORTS_PER_DAY) {
    throw new ReportGenerationError(429, `Günlük rapor limitine ulaşıldı (${MAX_REPORTS_PER_DAY}). Yarın tekrar deneyebilirsiniz.`)
  }
}

async function insertReport({ studentId, subject, sortedTopicNames, questionRows, report, createdByUserId, createdByRole }) {
  const wrongQuestionIds = questionRows.map((row) => String(row.id))
  const requestDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    subject: { type: sql.NVarChar(100), value: subject },
    topicNamesJson: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(sortedTopicNames) },
    wrongQuestionIdsJson: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(wrongQuestionIds) },
    reportJson: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(report) },
    questionCount: { type: sql.Int, value: wrongQuestionIds.length },
    model: { type: sql.NVarChar(50), value: MODEL },
    createdByUserId: { type: sql.UniqueIdentifier, value: createdByUserId || null },
    createdByRole: { type: sql.NVarChar(20), value: createdByRole },
  })
  const result = await requestDb.query(`
    INSERT INTO dbo.AiAnalysisReports
      (student_id, subject, topic_names_json, wrong_question_ids_json, report_json, question_count, model, created_by_user_id, created_by_role)
    OUTPUT inserted.id, inserted.subject, inserted.topic_names_json, inserted.wrong_question_ids_json,
           inserted.report_json, inserted.question_count, inserted.model, inserted.created_by_role, inserted.created_at
    VALUES
      (@studentId, @subject, @topicNamesJson, @wrongQuestionIdsJson, @reportJson, @questionCount, @model, @createdByUserId, @createdByRole);
  `)
  return result.recordset[0]
}

function safeParseArray(value) {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function sanitizeReportRow(record) {
  return {
    id: record.id,
    subject: record.subject,
    createdAt: record.created_at,
    createdByRole: record.created_by_role,
    questionCount: record.question_count,
    topicNames: safeParseArray(record.topic_names_json),
  }
}

async function buildReportDetail(studentId, record) {
  const wrongQuestionIds = safeParseArray(record.wrong_question_ids_json)
  const wrongQuestions = await fetchWrongQuestionsForGallery(studentId, wrongQuestionIds)
  let report
  try {
    report = JSON.parse(record.report_json)
  } catch {
    report = null
  }
  return {
    ...sanitizeReportRow(record),
    model: record.model,
    report,
    wrongQuestions,
  }
}

async function fetchReportRecord(studentId, reportId, { subject } = {}) {
  const requestDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    reportId: { type: sql.UniqueIdentifier, value: reportId },
    ...(subject ? { subject: { type: sql.NVarChar(100), value: subject } } : {}),
  })
  const result = await requestDb.query(`
    SELECT id, student_id, subject, topic_names_json, wrong_question_ids_json, report_json,
           question_count, model, created_by_role, created_at
    FROM dbo.AiAnalysisReports
    WHERE id = @reportId AND student_id = @studentId
      ${subject ? 'AND subject = @subject' : ''};
  `)
  return result.recordset[0] || null
}

async function fetchReportList(studentId, { subject } = {}) {
  const requestDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    ...(subject ? { subject: { type: sql.NVarChar(100), value: subject } } : {}),
  })
  const result = await requestDb.query(`
    SELECT id, subject, topic_names_json, question_count, created_by_role, created_at
    FROM dbo.AiAnalysisReports
    WHERE student_id = @studentId ${subject ? 'AND subject = @subject' : ''}
    ORDER BY created_at DESC;
  `)
  return result.recordset.map(sanitizeReportRow)
}

// Ortak "yeni rapor oluştur" akışı — panel ve öğretmen uçları bunu çağırır.
async function createReportForStudent({ studentId, subject, topicNames, createdByUserId, createdByRole }) {
  const cleanTopicNames = [...new Set((topicNames || []).map((name) => String(name || '').trim()).filter(Boolean))]
  if (!subject || !cleanTopicNames.length) {
    throw new ReportGenerationError(400, 'Ders ve en az bir içerik seçmelisiniz.')
  }
  const sortedTopicNames = [...cleanTopicNames].sort((a, b) => a.localeCompare(b, 'tr'))
  const sortedTopicNamesJson = JSON.stringify(sortedTopicNames)

  await checkQuota(studentId, subject, sortedTopicNamesJson)

  const questionRows = await fetchAnalyzableQuestions(studentId, subject, cleanTopicNames)
  if (!questionRows.length) {
    throw new ReportGenerationError(400, 'Seçilen içeriklerde hata görseli bulunamadı.')
  }

  const { report, usedQuestionRows } = await generateReport(questionRows)
  const record = await insertReport({
    studentId,
    subject,
    sortedTopicNames,
    questionRows: usedQuestionRows,
    report,
    createdByUserId,
    createdByRole,
  })
  return buildReportDetail(studentId, record)
}

// --- Panel (öğrenci / veli) uçları -------------------------------------------

function handlePanelError(error, label, fallbackMessage) {
  if (error instanceof ReportGenerationError) {
    return json(error.status, { error: error.message })
  }
  if (isConfigError(error)) {
    return json(503, { error: 'Yapay zeka servisi yapılandırması eksik.' })
  }
  if (isSessionError(error)) {
    return json(401, { error: 'Oturum geçersiz.' })
  }
  console.error(`${label} failed`, error)
  return json(500, { error: fallbackMessage })
}

async function listAiAnalysisReportsHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) return error
    const [reports, availableSubjects] = await Promise.all([
      fetchReportList(studentId),
      fetchAvailableSubjects(studentId),
    ])
    return json(200, { reports, availableSubjects })
  } catch (error) {
    return handlePanelError(error, 'listAiAnalysisReportsHandler', 'Raporlar yüklenemedi.')
  }
}

async function getAiAnalysisScopeHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) return error
    const subject = request.query.get('subject')
    if (!subject) {
      return json(200, { availableSubjects: await fetchAvailableSubjects(studentId) })
    }
    return json(200, { topics: await fetchSubjectTopics(studentId, subject) })
  } catch (error) {
    return handlePanelError(error, 'getAiAnalysisScopeHandler', 'İçerikler yüklenemedi.')
  }
}

async function getAiAnalysisReportHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) return error
    const record = await fetchReportRecord(studentId, request.params.reportId)
    if (!record) return json(404, { error: 'Rapor bulunamadı.' })
    return json(200, { report: await buildReportDetail(studentId, record) })
  } catch (error) {
    return handlePanelError(error, 'getAiAnalysisReportHandler', 'Rapor yüklenemedi.')
  }
}

async function createAiAnalysisReportHandler(request) {
  try {
    const { error, studentId, actorId, actorRole } = await requireStudentWriteContext(request)
    if (error) return error
    const payload = await request.json().catch(() => null)
    const report = await createReportForStudent({
      studentId,
      subject: payload?.subject,
      topicNames: payload?.topicNames,
      createdByUserId: actorId,
      createdByRole: actorRole === 'ebeveyn' ? 'ebeveyn' : 'ogrenci',
    })
    return json(201, { report })
  } catch (error) {
    return handlePanelError(error, 'createAiAnalysisReportHandler', 'Rapor oluşturulamadı.')
  }
}

module.exports = {
  // panel handlers
  listAiAnalysisReportsHandler,
  getAiAnalysisScopeHandler,
  getAiAnalysisReportHandler,
  createAiAnalysisReportHandler,
  // öğretmen ucu için yeniden kullanılan parçalar
  ReportGenerationError,
  fetchAvailableSubjects,
  fetchSubjectTopics,
  fetchReportList,
  fetchReportRecord,
  buildReportDetail,
  createReportForStudent,
}
