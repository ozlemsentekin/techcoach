const { sql, withRequest, withTransaction } = require('./db')
const { isConfigError } = require('./config')
const { json } = require('./http')
const { isSessionError, readSessionToken, verifySessionToken } = require('./security')
const { requireStudentContext } = require('./studentScope')

// Hata Kitapçığı: admin, Hata Defteri'ndeki fotoğraflı yanlışlardan test üretir. Her öğrenci +
// ders için tek bir özel kaynak ("Hata Kitapçığı") ve altında tek içerik açılır; testler oraya
// cevap anahtarıyla eklenir. bkz. api/sql/create-mistake-booklets-schema.sql
const BOOKLET_BOOK_NAME = 'Hata Kitapçığı'
const BOOKLET_TOPIC_NAME = 'Hata Testleri'
const BOOKLET_PUBLISHER_NAME = 'TechCoach'
const ANSWER_LABELS = ['A', 'B', 'C', 'D', 'E']
const MAX_BOOKLET_QUESTIONS = 60

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

/**
 * Sorunun kitapçıklar arası kimliği: kitapçık sorusu ise eşlemedeki root_key, değilse kendi
 * test+soru numarası (testsiz deneme/serbest kayıtlarda kendi id'si).
 */
function ownRootKey(row) {
  const testId = row.test_id || row.testId
  const questionNumber = row.question_number ?? row.questionNumber
  if (testId && questionNumber != null && questionNumber !== '') {
    return `t:${String(testId).toLowerCase()}:${String(questionNumber).trim()}`
  }
  return `w:${String(row.id).toLowerCase()}`
}

function bookletMapKey(testId, orderNo) {
  return `${String(testId).toLowerCase()}:${String(orderNo).trim()}`
}

// Öğrencinin tüm kitapçık soru eşlemeleri: (test_id, order_no) -> root_key.
async function fetchBookletQuestionMap(studentId) {
  const db = await withRequest({ studentId: { type: sql.UniqueIdentifier, value: studentId } })
  const result = await db.query(`
    SELECT q.test_id, q.order_no, q.root_key
    FROM dbo.MistakeBookletQuestions q
    INNER JOIN dbo.ResourceBookTopicTests t ON t.id = q.test_id
    INNER JOIN dbo.MistakeBooklets mb ON mb.topic_id = t.topic_id
    WHERE mb.student_id = @studentId;
  `)
  return new Map(result.recordset.map((row) => [bookletMapKey(row.test_id, row.order_no), row.root_key]))
}

/**
 * Hata Defteri listesine "aynı soruda kaç kez yanlış" bilgisini ekler. Kitapçıkta tekrar yanlış
 * yapılan soru yeni bir WrongQuestions satırı olarak gelir; root_key ile orijinaliyle birleşir.
 * Migration henüz çalışmamışsa (tablo yok) liste bozulmasın diye sessizce sayaçsız döner.
 */
async function attachRepeatInfo(studentId, items) {
  let bookletMap = new Map()
  try {
    bookletMap = await fetchBookletQuestionMap(studentId)
  } catch (error) {
    console.warn('attachRepeatInfo: booklet map unavailable', error?.message)
  }

  const keyed = items.map((item) => {
    const bookletRoot =
      item.testId && item.questionNumber != null ? bookletMap.get(bookletMapKey(item.testId, item.questionNumber)) : null
    return { item, rootKey: bookletRoot || ownRootKey(item), isBookletQuestion: Boolean(bookletRoot) }
  })

  const usage = new Map()
  bookletMap.forEach((rootKey) => usage.set(rootKey, (usage.get(rootKey) || 0) + 1))

  const counts = new Map()
  keyed.forEach(({ rootKey }) => counts.set(rootKey, (counts.get(rootKey) || 0) + 1))

  return keyed.map(({ item, rootKey, isBookletQuestion }) => ({
    ...item,
    rootKey,
    repeatCount: counts.get(rootKey) || 1,
    bookletUseCount: usage.get(rootKey) || 0,
    isBookletQuestion,
  }))
}

// Admin kendi veli hesabında (is_admin) ya da bir veliyi impersonate ederken (actingAdminId) açılır.
async function requireBookletAdmin(request, options) {
  const context = await requireStudentContext(request, options)
  if (context.error) return context

  const session = verifySessionToken(readSessionToken(request))
  const adminCandidateId = session.actingAdminId || session.sub
  const db = await withRequest({ id: { type: sql.UniqueIdentifier, value: adminCandidateId } })
  const result = await db.query(`SELECT TOP 1 is_admin FROM dbo.Users WHERE id = @id;`)
  if (!result.recordset[0]?.is_admin || session.actingParentId) {
    return { error: json(403, { error: 'Bu işlem yalnızca yöneticiler içindir.' }) }
  }
  return { ...context, adminUserId: adminCandidateId }
}

async function findOrCreatePublisherId(requestInTransaction) {
  const name = { name: { type: sql.NVarChar(150), value: BOOKLET_PUBLISHER_NAME } }
  const existing = await requestInTransaction(name).query(`SELECT TOP 1 id FROM dbo.Publishers WHERE name = @name;`)
  if (existing.recordset[0]) return existing.recordset[0].id
  const inserted = await requestInTransaction(name).query(`
    INSERT INTO dbo.Publishers (name) OUTPUT inserted.id VALUES (@name);
  `)
  return inserted.recordset[0].id
}

// Öğrencinin bu dersteki Hata Kitapçığı'nı döndürür; yoksa kitap + içerik + öğrenci ataması
// aynı transaction'da oluşturulur (kitap öğrenci başına ders başına bir kez eklenir).
async function findOrCreateBooklet(requestInTransaction, { studentId, subjectId, adminUserId }) {
  const keys = {
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    subjectId: { type: sql.UniqueIdentifier, value: subjectId },
  }
  const existing = await requestInTransaction(keys).query(`
    SELECT TOP 1 mb.resource_book_id, mb.topic_id
    FROM dbo.MistakeBooklets mb WITH (UPDLOCK, HOLDLOCK)
    WHERE mb.student_id = @studentId AND mb.subject_id = @subjectId;
  `)
  if (existing.recordset[0]) {
    return { resourceBookId: existing.recordset[0].resource_book_id, topicId: existing.recordset[0].topic_id }
  }

  const publisherId = await findOrCreatePublisherId(requestInTransaction)
  const gradeResult = await requestInTransaction(keys).query(`
    SELECT TOP 1 grade FROM dbo.StudentProfiles WHERE student_id = @studentId;
  `)
  const hasPageCount = await requestInTransaction({}).query(
    `SELECT COL_LENGTH('dbo.ResourceBooks', 'page_count') AS has_col;`,
  )
  const withPageCount = hasPageCount.recordset[0]?.has_col != null

  const bookInsert = await requestInTransaction({
    ...keys,
    publisherId: { type: sql.UniqueIdentifier, value: publisherId },
    name: { type: sql.NVarChar(200), value: BOOKLET_BOOK_NAME },
    grade: { type: sql.NVarChar(20), value: gradeResult.recordset[0]?.grade || null },
    adminUserId: { type: sql.UniqueIdentifier, value: adminUserId },
  }).query(`
    INSERT INTO dbo.ResourceBooks
      (publisher_id, subject_id, name, is_active, resource_type, has_answer_key, content_mode, grade,
       resource_source, scope, status, created_by_role, created_by_user_id${withPageCount ? ', page_count' : ''})
    OUTPUT inserted.id
    VALUES
      (@publisherId, @subjectId, @name, 1, 'soru_bankasi', 1, 'structured', @grade,
       'ozel', 'private', 'approved', 'admin', @adminUserId${withPageCount ? ', 1' : ''});
  `)
  const resourceBookId = bookInsert.recordset[0].id

  const topicInsert = await requestInTransaction({
    resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId },
    name: { type: sql.NVarChar(200), value: BOOKLET_TOPIC_NAME },
  }).query(`
    INSERT INTO dbo.ResourceBookTopics (resource_book_id, name) OUTPUT inserted.id VALUES (@resourceBookId, @name);
  `)
  const topicId = topicInsert.recordset[0].id

  await requestInTransaction({
    ...keys,
    resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId },
    topicId: { type: sql.UniqueIdentifier, value: topicId },
  }).query(`
    INSERT INTO dbo.StudentResourceBooks (student_id, resource_book_id)
    SELECT @studentId, @resourceBookId
    WHERE NOT EXISTS (
      SELECT 1 FROM dbo.StudentResourceBooks WHERE student_id = @studentId AND resource_book_id = @resourceBookId
    );
    INSERT INTO dbo.MistakeBooklets (student_id, subject_id, resource_book_id, topic_id)
    VALUES (@studentId, @subjectId, @resourceBookId, @topicId);
  `)

  return { resourceBookId, topicId }
}

/**
 * POST /api/panel/mistake-booklets/tests
 * body: { studentId, testName, questions: [{ wrongQuestionId, correctLabel? }] } — sıra = test sırası.
 * correctLabel verilmezse kaynak testin cevap anahtarından alınır; hiçbiri yoksa 400.
 */
async function createMistakeBookletTestHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const context = await requireBookletAdmin(request, { studentId: payload?.studentId })
    if (context.error) return context.error
    const { studentId, adminUserId } = context

    const testName = String(payload?.testName || '').trim()
    if (!testName) return json(400, { error: 'Test adı girilmeli.' })
    if (testName.length > 200) return json(400, { error: 'Test adı en fazla 200 karakter olabilir.' })

    const questions = Array.isArray(payload?.questions) ? payload.questions : []
    if (!questions.length) return json(400, { error: 'En az bir soru seçilmeli.' })
    if (questions.length > MAX_BOOKLET_QUESTIONS) {
      return json(400, { error: `Bir teste en fazla ${MAX_BOOKLET_QUESTIONS} soru eklenebilir.` })
    }
    const ids = questions.map((question) => String(question?.wrongQuestionId || '').toLowerCase())
    if (ids.some((id) => !/^[0-9a-f-]{36}$/.test(id)) || new Set(ids).size !== ids.length) {
      return json(400, { error: 'Soru listesi geçersiz.' })
    }

    const db = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      idsCsv: { type: sql.NVarChar(sql.MAX), value: ids.join(',') },
    })
    const result = await db.query(`
      SELECT wq.id, wq.subject, wq.test_id, wq.question_number, tak.correct_label
      FROM dbo.WrongQuestions wq
      JOIN STRING_SPLIT(@idsCsv, ',') s ON TRY_CAST(s.value AS UNIQUEIDENTIFIER) = wq.id
      LEFT JOIN dbo.TestAnswerKeys tak
        ON tak.test_id = wq.test_id AND tak.order_no = TRY_CAST(wq.question_number AS INT)
      WHERE wq.student_id = @studentId AND wq.photo_url IS NOT NULL;
    `)
    const rowsById = new Map(result.recordset.map((row) => [String(row.id).toLowerCase(), row]))
    if (rowsById.size !== ids.length) {
      return json(400, { error: 'Seçilen sorulardan bazıları bulunamadı ya da fotoğrafı yok.' })
    }

    const subjects = new Set(result.recordset.map((row) => row.subject))
    if (subjects.size !== 1) return json(400, { error: 'Bir testteki sorular aynı dersten olmalı.' })
    const subjectName = result.recordset[0].subject

    const subjectDb = await withRequest({ name: { type: sql.NVarChar(100), value: subjectName } })
    const subjectResult = await subjectDb.query(`SELECT TOP 1 id FROM dbo.Subjects WHERE name = @name;`)
    const subjectId = subjectResult.recordset[0]?.id
    if (!subjectId) return json(400, { error: `"${subjectName}" dersi bulunamadı.` })

    const bookletMap = await fetchBookletQuestionMap(studentId)
    const entries = []
    for (let index = 0; index < ids.length; index += 1) {
      const row = rowsById.get(ids[index])
      const requested = String(questions[index]?.correctLabel || '').trim().toUpperCase()
      const fallback = row.correct_label ? String(row.correct_label).trim().toUpperCase() : ''
      const correctLabel = requested || fallback
      if (!ANSWER_LABELS.includes(correctLabel)) {
        return json(400, { error: `${index + 1}. sorunun doğru cevabı seçilmeli.` })
      }
      const bookletRoot =
        row.test_id && row.question_number != null
          ? bookletMap.get(bookletMapKey(row.test_id, row.question_number))
          : null
      entries.push({
        orderNo: index + 1,
        sourceWrongQuestionId: row.id,
        rootKey: bookletRoot || ownRootKey(row),
        correctLabel,
      })
    }

    const created = await withTransaction(async (requestInTransaction) => {
      const booklet = await findOrCreateBooklet(requestInTransaction, { studentId, subjectId, adminUserId })

      const duplicate = await requestInTransaction({
        topicId: { type: sql.UniqueIdentifier, value: booklet.topicId },
        name: { type: sql.NVarChar(200), value: testName },
      }).query(`SELECT TOP 1 1 AS found FROM dbo.ResourceBookTopicTests WHERE topic_id = @topicId AND name = @name;`)
      if (duplicate.recordset[0]) {
        const err = new Error('Hata Kitapçığı\'nda bu isimde bir test zaten var.')
        err.friendly = true
        throw err
      }

      const testInsert = await requestInTransaction({
        topicId: { type: sql.UniqueIdentifier, value: booklet.topicId },
        name: { type: sql.NVarChar(200), value: testName },
        questionCount: { type: sql.Int, value: entries.length },
      }).query(`
        INSERT INTO dbo.ResourceBookTopicTests (topic_id, topic_name, name, page_count, question_count)
        OUTPUT inserted.id
        VALUES (@topicId, NULL, @name, 1, @questionCount);
      `)
      const testId = testInsert.recordset[0].id

      for (const entry of entries) {
        await requestInTransaction({
          testId: { type: sql.UniqueIdentifier, value: testId },
          orderNo: { type: sql.Int, value: entry.orderNo },
          correctLabel: { type: sql.NChar(1), value: entry.correctLabel },
          sourceId: { type: sql.UniqueIdentifier, value: entry.sourceWrongQuestionId },
          rootKey: { type: sql.NVarChar(120), value: entry.rootKey },
        }).query(`
          INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label) VALUES (@testId, @orderNo, @correctLabel);
          INSERT INTO dbo.MistakeBookletQuestions (test_id, order_no, source_wrong_question_id, root_key)
          VALUES (@testId, @orderNo, @sourceId, @rootKey);
        `)
      }

      return { testId, resourceBookId: booklet.resourceBookId }
    })

    return json(201, {
      test: {
        id: created.testId,
        name: testName,
        questionCount: entries.length,
        resourceBookId: created.resourceBookId,
        bookName: BOOKLET_BOOK_NAME,
        subject: subjectName,
      },
    })
  } catch (error) {
    if (error?.friendly) return json(400, { error: error.message })
    return handleError(error, 'createMistakeBookletTestHandler', 'Test oluşturulamadı.')
  }
}

/**
 * GET /api/panel/mistake-booklets/tests/{testId}/questions — kitapçık testinin soru görselleri
 * (sırasıyla). Cevap anahtarı DÖNMEZ: öğrenci bu ekranı test çözerken açıyor.
 */
async function listMistakeBookletQuestionsHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) return error

    const db = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      testId: { type: sql.UniqueIdentifier, value: request.params.testId },
    })
    const result = await db.query(`
      SELECT t.name AS test_name, q.order_no, wq.photo_url
      FROM dbo.MistakeBookletQuestions q
      INNER JOIN dbo.ResourceBookTopicTests t ON t.id = q.test_id
      INNER JOIN dbo.MistakeBooklets mb ON mb.topic_id = t.topic_id
      LEFT JOIN dbo.WrongQuestions wq ON wq.id = q.source_wrong_question_id
      WHERE q.test_id = @testId AND mb.student_id = @studentId
      ORDER BY q.order_no ASC;
    `)
    if (!result.recordset.length) return json(404, { error: 'Kitapçık testi bulunamadı.' })

    return json(200, {
      testName: result.recordset[0].test_name,
      questions: result.recordset.map((row) => ({ orderNo: row.order_no, photoUrl: row.photo_url || null })),
    })
  } catch (error) {
    return handleError(error, 'listMistakeBookletQuestionsHandler', 'Kitapçık soruları yüklenemedi.')
  }
}

// Cevap kağıdı için: verilen testlerden hangileri Hata Kitapçığı testi (soru görseli gösterilir,
// fotoğraf soru-no doğrulaması atlanır — görseldeki numara orijinal kitabın numarasıdır).
async function fetchBookletTestIdSet(testIds) {
  if (!testIds.length) return new Set()
  try {
    const db = await withRequest({ idsCsv: { type: sql.NVarChar(sql.MAX), value: testIds.join(',') } })
    const result = await db.query(`
      SELECT DISTINCT q.test_id
      FROM dbo.MistakeBookletQuestions q
      JOIN STRING_SPLIT(@idsCsv, ',') s ON TRY_CAST(s.value AS UNIQUEIDENTIFIER) = q.test_id;
    `)
    return new Set(result.recordset.map((row) => String(row.test_id).toLowerCase()))
  } catch (error) {
    console.warn('fetchBookletTestIdSet unavailable', error?.message)
    return new Set()
  }
}

module.exports = {
  attachRepeatInfo,
  fetchBookletTestIdSet,
  createMistakeBookletTestHandler,
  listMistakeBookletQuestionsHandler,
}
