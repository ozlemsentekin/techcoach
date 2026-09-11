const Anthropic = require('@anthropic-ai/sdk')
const { sql, withRequest, withTransaction } = require('./db')
const { getAnthropicConfig, isConfigError } = require('./config')
const { json } = require('./http')
const { requireStudentContext, requireStudentWriteContext } = require('./studentScope')
const { isSessionError } = require('./security')
const { fetchWrongQuestionAnalyses } = require('./progress')

const MODEL = 'claude-opus-5'
// DİKKAT — bug 1 (2026-09-11, çözüldü): 20 görsel + max_tokens 8000 ile kalabalık bir içerikte
// model max_tokens'a çarpıp yanıtı JSON'ın ortasında kesiyordu ("Yapay zeka yanıtı okunamadı").
// max_tokens 16000'e çıkarılıp streaming'e geçilerek çözüldü (aşağıda).
//
// DİKKAT — bug 2 (2026-09-11, hâlâ ampirik): yukarıdaki düzeltmeye rağmen 12 görsellik gerçek bir
// istek (prod'dan, tarayıcı üzerinden) "Kimlik doğrulama servisine ulaşılamadı" hatası verdi —
// bu authClient.js'nin durum kodu 500+ VE gövde JSON DEĞİLKEN döndürdüğü mesaj; yani istek bizim
// JSON hata yönetimimize hiç ulaşmadan platform tarafından kesildi. Azure SWA'nın managed
// functions API'si dokümante edilmemiş ama bilinen ~100 sn'lik sert bir HTTP zaman aşımına sahip
// (ayrı bir Azure Functions App yok, bkz. `az functionapp list` boş — sadece SWA'nın gömülü API'si;
// bu yüzden host.json functionTimeout'u da etkisiz, Durable/Queue trigger da yok). Script üzerinden
// (HTTP katmanını atlayarak) yapılan ölçümler bu yüzden yanıltıcıydı — gerçek sınır script'lerin
// gördüğünden daha düşük. Çözüm: Anthropic'in "fast mode"unu aç (aynı model, ~2.5x'e kadar daha
// hızlı çıktı, bkz. client.beta.messages.stream + speed:'fast') VE görsel sayısını düşür — ikisi
// birlikte 100 sn sınırının altında kalma ihtimalini artırıyor. Kalıcı çözüm SWA managed functions
// yerine gerçek bir Azure Functions App'e (Timer/Queue trigger ile asenkron üretim) geçmek olurdu.
const MAX_IMAGES = 8 // maliyet + yanıt boyutu + Azure SWA managed functions süresi guard'ı
const MAX_REPORTS_PER_DAY = 10 // 2026-09-11: 5'ten yükseltildi — ilk hafta test/kullanım daha sık
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
          imageIndex: {
            type: 'integer',
            description: 'Bu sorunun görseline verilen "Soru N" etiketindeki N değeri (görselle metni eşlemek için)',
          },
          testName: { type: 'string', description: 'Kaynak · Test adı' },
          questionNumber: { type: 'integer' },
          topic: { type: 'string' },
          correctAnswer: { type: 'string' },
          whatItAsked: { type: 'string', description: 'Sorunun ne sorduğu, kısa' },
          likelyMistake: { type: 'string', description: 'Öğrencinin nerede/neden hata yapmış olabileceği' },
        },
        required: ['imageIndex', 'testName', 'questionNumber', 'topic', 'correctAnswer', 'whatItAsked', 'likelyMistake'],
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
1. HER görsel için bir analyzedQuestions girdisi üret (görsel sayısı kadar, hiçbirini atlama) ve imageIndex alanına o görsele verilen "Soru N" etiketindeki N'yi yaz — bu, metni doğru görselle eşlemek için kullanılacak. Her biri için "ne sorulduğunu" ve öğrencinin "nerede/neden hata yapmış olabileceğini" kısa ve somut biçimde çıkar.
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

// Analiz edilebilir (hata görseli olan VE henüz bir AI raporuna dahil edilmemiş) derslerin
// ders başına soru sayısı. Bir kez analiz edilen görsel bir daha seçim listesine düşmesin diye
// (ai_analyzed_at) her üç sorgu da aynı filtreyi kullanır — bkz. markQuestionsAnalyzed.
async function fetchAvailableSubjects(studentId) {
  const requestDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
  })
  const result = await requestDb.query(`
    SELECT wq.subject AS subject, COUNT(*) AS question_count
    FROM dbo.WrongQuestions wq
    WHERE wq.student_id = @studentId AND wq.photo_url IS NOT NULL AND wq.subject IS NOT NULL
      AND wq.ai_analyzed_at IS NULL
    GROUP BY wq.subject
    ORDER BY wq.subject;
  `)
  return result.recordset.map((row) => ({ subject: row.subject, questionCount: row.question_count }))
}

// Bir derste hata görseli olan, henüz analiz edilmemiş TÜM sorular — "Yeni Rapor Oluştur"
// ekranının soru bazlı seçim ızgarası bunu kullanır (tarih/içerik filtreleri istemci tarafında
// uygulanır, veri seti öğrenci başına küçük olduğu için tekrar tekrar sorgu atmaya gerek yok).
// Görsel burada dönmez (liste ağırlaşmasın diye) — küçük resimler galerideki gibi tembel çekilir.
async function fetchScopeQuestions(studentId, subject) {
  const requestDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    subject: { type: sql.NVarChar(100), value: subject },
  })
  const result = await requestDb.query(`
    SELECT wq.id, wq.question_number, wq.created_at,
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
      AND wq.ai_analyzed_at IS NULL
    ORDER BY wq.created_at DESC;
  `)
  return result.recordset.map((row) => ({
    id: row.id,
    questionNumber: row.question_number || undefined,
    topic: row.topic || 'Genel',
    bookName: row.book_name || undefined,
    publisherName: row.publisher_name || undefined,
    testName: row.test_name || undefined,
    correctAnswer: row.correct_answer ? String(row.correct_answer).trim() : undefined,
    createdAt: row.created_at,
  }))
}

function bindIdList(ids, prefix = 'id') {
  const params = {}
  const placeholders = ids.map((id, index) => {
    params[`${prefix}${index}`] = { type: sql.UniqueIdentifier, value: id }
    return `@${prefix}${index}`
  })
  return { params, inClause: placeholders.join(', ') }
}

// Kullanıcının tek tek seçtiği sorular — görselleriyle birlikte (rapor üretimi için).
async function fetchQuestionsByIds(studentId, subject, ids) {
  if (!ids.length) return []
  const { params, inClause } = bindIdList(ids)
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
      AND wq.ai_analyzed_at IS NULL
      AND wq.id IN (${inClause})
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
  // Streaming + yüksek max_tokens: eskiden max_tokens:8000 ile (thinking + JSON aynı bütçeyi
  // paylaşıyor) kalabalık içeriklerde yanıt JSON'ın ortasında kesiliyordu (bkz. MAX_IMAGES yorumu).
  // Fast mode (client.beta.messages + betas + speed:'fast'): aynı modeli daha yüksek çıktı
  // hızıyla çalıştırır — Azure SWA managed functions'ın ~100 sn'lik sert HTTP zaman aşımının
  // altında kalma ihtimalini artırmak için (bkz. MAX_IMAGES üstündeki "bug 2" yorumu).
  const response = await client.beta.messages
    .stream({
      model: MODEL,
      max_tokens: 16000,
      betas: ['fast-mode-2026-02-01'],
      speed: 'fast',
      output_config: { format: { type: 'json_schema', schema: REPORT_SCHEMA } },
      messages: [{ role: 'user', content }],
    })
    .finalMessage()

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

async function checkQuota(studentId, sortedWrongQuestionIdsJson) {
  const requestDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    idsJson: { type: sql.NVarChar(sql.MAX), value: sortedWrongQuestionIdsJson },
  })
  const result = await requestDb.query(`
    SELECT
      (SELECT COUNT(*) FROM dbo.AiAnalysisReports
        WHERE student_id = @studentId AND created_at > DATEADD(DAY, -1, SYSUTCDATETIME())) AS day_count,
      (SELECT COUNT(*) FROM dbo.AiAnalysisReports
        WHERE student_id = @studentId AND wrong_question_ids_json = @idsJson
          AND created_at > DATEADD(HOUR, -${SAME_SCOPE_COOLDOWN_HOURS}, SYSUTCDATETIME())) AS recent_same_scope;
  `)
  const row = result.recordset[0]
  if (row.recent_same_scope > 0) {
    throw new ReportGenerationError(429, 'Bu sorular için az önce bir rapor oluşturuldu. Lütfen biraz sonra tekrar deneyin.')
  }
  if (row.day_count >= MAX_REPORTS_PER_DAY) {
    throw new ReportGenerationError(
      429,
      `Günlük rapor limitine ulaşıldı (${MAX_REPORTS_PER_DAY}). En eski raporunuzun üzerinden 24 saat geçince tekrar deneyebilirsiniz.`,
    )
  }
}

async function insertReport({ studentId, subject, sortedTopicNames, questionRows, report, createdByUserId, createdByRole }) {
  const wrongQuestionIds = questionRows.map((row) => String(row.id).toUpperCase())
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

// Bir rapora dahil edilen sorular bir daha "Yeni Rapor Oluştur" seçim listesine düşmesin
// (bkz. fetchAvailableSubjects/fetchScopeQuestions/fetchQuestionsByIds'daki ai_analyzed_at filtresi).
async function markQuestionsAnalyzed(ids) {
  if (!ids.length) return
  const params = {}
  const placeholders = ids.map((id, index) => {
    params[`id${index}`] = { type: sql.UniqueIdentifier, value: id }
    return `@id${index}`
  })
  const requestDb = await withRequest(params)
  await requestDb.query(`
    UPDATE dbo.WrongQuestions SET ai_analyzed_at = SYSUTCDATETIME() WHERE id IN (${placeholders.join(', ')});
  `)
}

// report.analyzedQuestions[i] hangi questionRows[idx] sorusuna ait? imageIndex alanı (Claude'a
// verilen "Soru N" etiketinin N'i) varsa onunla eşler, yoksa (uç durum) sırayla eşler — PDF'teki
// aynı eşleme mantığı (bkz. src/utils/aiReportPdf.js buildImageAnalysisMap), Hata Defteri'nde
// soru bazlı AI rozeti/analizi göstermek için burada da kullanılıyor.
function matchAnalysisToRows(report, rows) {
  const analyzed = report?.analyzedQuestions || []
  const hasIndex = analyzed.length > 0 && analyzed.every((q) => Number.isInteger(q.imageIndex))
  const byIndex = new Map()
  analyzed.forEach((q, i) => {
    const idx = hasIndex ? q.imageIndex - 1 : i
    if (idx >= 0 && idx < rows.length && !byIndex.has(idx)) byIndex.set(idx, q)
  })
  return rows.map((row, idx) => ({ row, analysis: byIndex.get(idx) || null }))
}

// Soru bazlı analiz metnini (ne sordu / olası hata) Hata Defteri'nin sorgulayabileceği ayrı bir
// tabloya yazar — rapor bütünüyle silinse/değişse bile bu satır o soruya kalıcı kalır.
async function insertWrongQuestionAiAnalyses(reportId, pairs) {
  const usable = pairs.filter((p) => p.analysis)
  if (!usable.length) return
  await withTransaction(async (requestInTransaction) => {
    for (const { row, analysis } of usable) {
      const request = requestInTransaction({
        wrongQuestionId: { type: sql.UniqueIdentifier, value: row.id },
        reportId: { type: sql.UniqueIdentifier, value: reportId },
        whatItAsked: { type: sql.NVarChar(sql.MAX), value: analysis.whatItAsked },
        likelyMistake: { type: sql.NVarChar(sql.MAX), value: analysis.likelyMistake },
      })
      await request.query(`
        INSERT INTO dbo.WrongQuestionAiAnalyses (wrong_question_id, ai_analysis_report_id, what_it_asked, likely_mistake)
        VALUES (@wrongQuestionId, @reportId, @whatItAsked, @likelyMistake);
      `)
    }
  })
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

// Ortak "yeni rapor oluştur" akışı — panel ve öğretmen uçları bunu çağırır. Kapsam artık içerik
// (konu) değil, kullanıcının ızgaradan tek tek işaretlediği soru id'leri — bkz. AiReportsView.jsx
// CreateReportModal (tarih/içerik filtreli soru seçim ekranı).
async function createReportForStudent({ studentId, subject, wrongQuestionIds, createdByUserId, createdByRole }) {
  const cleanIds = [...new Set((wrongQuestionIds || []).map((id) => String(id || '').trim().toUpperCase()).filter(Boolean))]
  if (!subject || !cleanIds.length) {
    throw new ReportGenerationError(400, 'Ders ve en az bir soru seçmelisiniz.')
  }
  if (cleanIds.length > MAX_IMAGES) {
    throw new ReportGenerationError(400, `Bir seferde en fazla ${MAX_IMAGES} soru seçebilirsiniz.`)
  }
  const sortedIdsJson = JSON.stringify([...cleanIds].sort())

  await checkQuota(studentId, sortedIdsJson)

  const questionRows = await fetchQuestionsByIds(studentId, subject, cleanIds)
  if (!questionRows.length) {
    throw new ReportGenerationError(
      400,
      'Seçilen sorular artık kullanılamıyor (örn. başka bir raporda analiz edilmiş olabilir). Lütfen listeyi yenileyip tekrar seçin.',
    )
  }

  const { report, usedQuestionRows } = await generateReport(questionRows)
  const sortedTopicNames = [...new Set(usedQuestionRows.map((row) => row.topic).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'tr'),
  )
  const record = await insertReport({
    studentId,
    subject,
    sortedTopicNames,
    questionRows: usedQuestionRows,
    report,
    createdByUserId,
    createdByRole,
  })
  await insertWrongQuestionAiAnalyses(record.id, matchAnalysisToRows(report, usedQuestionRows))
  await markQuestionsAnalyzed(usedQuestionRows.map((row) => row.id))
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
    return json(200, { questions: await fetchScopeQuestions(studentId, subject) })
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
      wrongQuestionIds: payload?.wrongQuestionIds,
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
  fetchScopeQuestions,
  fetchReportList,
  fetchReportRecord,
  buildReportDetail,
  createReportForStudent,
}
