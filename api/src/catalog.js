const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { clearSessionHeaders, json } = require('./http')
const { requireAdmin } = require('./admin')
const { readSessionToken, verifySessionToken } = require('./security')

function sanitizeSubject(record) {
  return {
    id: record.id,
    name: record.name,
    createdAt: record.created_at,
  }
}

function sanitizePublisher(record) {
  return {
    id: record.id,
    name: record.name,
    createdAt: record.created_at,
  }
}

const RESOURCE_BOOK_TYPES = ['konu_anlatimi', 'soru_bankasi', 'okuma_kitabi']

function sanitizeResourceBook(record) {
  return {
    id: record.id,
    publisherId: record.publisher_id,
    publisherName: record.publisher_name || null,
    subjectId: record.subject_id,
    name: record.name,
    pageCount: record.page_count,
    isActive: Boolean(record.is_active),
    type: record.resource_type,
    createdAt: record.created_at,
  }
}

function sanitizeTestAnswerKeyEntry(record) {
  return {
    orderNo: record.order_no,
    correctLabel: record.correct_label.trim(),
  }
}

function sanitizeResourceBookTopic(record) {
  return {
    id: record.id,
    resourceBookId: record.resource_book_id,
    name: record.name,
    createdAt: record.created_at,
  }
}

function sanitizeResourceBookTopicTest(record) {
  return {
    id: record.id,
    topicId: record.topic_id,
    topicName: record.topic_name,
    name: record.name,
    pageStart: record.page_start,
    pageEnd: record.page_end,
    pageCount: record.page_count,
    questionCount: record.question_count,
    createdAt: record.created_at,
  }
}

async function listSubjectsHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({})
    const result = await requestDb.query(`
      SELECT id, name, created_at FROM dbo.Subjects ORDER BY name ASC;
    `)

    return json(200, { subjects: result.recordset.map(sanitizeSubject) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('listSubjectsHandler failed', error)
    return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
  }
}

async function listSubjectsForPanelHandler(request) {
  try {
    const token = readSessionToken(request)
    if (!token) {
      return json(401, { error: 'Oturum bulunamadı.' })
    }
    verifySessionToken(token)

    const requestDb = await withRequest({})
    const result = await requestDb.query(`
      SELECT id, name, created_at FROM dbo.Subjects ORDER BY name ASC;
    `)

    return json(200, { subjects: result.recordset.map(sanitizeSubject) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('listSubjectsForPanelHandler failed', error)
    return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
  }
}

async function listPublishersHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({})
    const result = await requestDb.query(`
      SELECT id, name, created_at FROM dbo.Publishers ORDER BY name ASC;
    `)

    return json(200, { publishers: result.recordset.map(sanitizePublisher) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('listPublishersHandler failed', error)
    return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
  }
}

async function createPublisherHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const payload = await request.json().catch(() => null)
    const name = payload?.name?.trim()
    if (!name || name.length < 2) {
      return json(400, { error: 'Yayın evi adı en az 2 karakter olmalı.' })
    }

    const requestDb = await withRequest({
      name: { type: sql.NVarChar(150), value: name },
    })

    const result = await requestDb.query(`
      INSERT INTO dbo.Publishers (name)
      OUTPUT inserted.id, inserted.name, inserted.created_at
      VALUES (@name);
    `)

    return json(201, { publisher: sanitizePublisher(result.recordset[0]) })
  } catch (error) {
    if (error.number === 2601 || error.number === 2627) {
      return json(409, { error: 'Bu isimde bir yayın evi zaten var.' })
    }

    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('createPublisherHandler failed', error)
    return json(500, { error: 'Yayın evi oluşturulamadı.' })
  }
}

async function listResourceBooksHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({})
    const result = await requestDb.query(`
      SELECT rb.id, rb.publisher_id, p.name AS publisher_name, rb.subject_id, rb.name, rb.page_count,
             rb.is_active, rb.resource_type, rb.created_at
      FROM dbo.ResourceBooks rb
      LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
      ORDER BY rb.created_at ASC;
    `)

    return json(200, { resourceBooks: result.recordset.map(sanitizeResourceBook) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('listResourceBooksHandler failed', error)
    return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
  }
}

async function listResourceBooksForPanelHandler(request) {
  try {
    const token = readSessionToken(request)
    if (!token) {
      return json(401, { error: 'Oturum bulunamadı.' })
    }
    verifySessionToken(token)

    const subjectId = request.query.get('subjectId')

    const requestDb = await withRequest(
      subjectId ? { subjectId: { type: sql.UniqueIdentifier, value: subjectId } } : {},
    )
    const result = await requestDb.query(`
      SELECT rb.id, rb.publisher_id, p.name AS publisher_name, rb.subject_id, rb.name, rb.page_count,
             rb.is_active, rb.resource_type, rb.created_at
      FROM dbo.ResourceBooks rb
      LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
      WHERE rb.is_active = 1 ${subjectId ? 'AND rb.subject_id = @subjectId' : ''}
      ORDER BY rb.name ASC;
    `)

    return json(200, { resourceBooks: result.recordset.map(sanitizeResourceBook) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('listResourceBooksForPanelHandler failed', error)
    return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
  }
}

async function createResourceBookHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const payload = await request.json().catch(() => null)
    const name = payload?.name?.trim()
    const publisherId = payload?.publisherId
    const subjectId = payload?.subjectId || null
    const pageCount = Number(payload?.pageCount)
    const isActive = payload?.isActive !== false
    const type = payload?.type

    if (!publisherId) {
      return json(400, { error: 'Yayın evi seçilmeli.' })
    }
    if (!name || name.length < 2) {
      return json(400, { error: 'Kaynak kitap adı en az 2 karakter olmalı.' })
    }
    if (!Number.isInteger(pageCount) || pageCount <= 0) {
      return json(400, { error: 'Sayfa sayısı pozitif bir tam sayı olmalı.' })
    }
    if (!RESOURCE_BOOK_TYPES.includes(type)) {
      return json(400, { error: 'Kaynak tipi seçilmeli.' })
    }

    const requestDb = await withRequest({
      publisherId: { type: sql.UniqueIdentifier, value: publisherId },
      subjectId: { type: sql.UniqueIdentifier, value: subjectId },
      name: { type: sql.NVarChar(200), value: name },
      pageCount: { type: sql.Int, value: pageCount },
      isActive: { type: sql.Bit, value: isActive },
      resourceType: { type: sql.NVarChar(30), value: type },
    })

    const result = await requestDb.query(`
      INSERT INTO dbo.ResourceBooks (publisher_id, subject_id, name, page_count, is_active, resource_type)
      OUTPUT inserted.id, inserted.publisher_id, inserted.subject_id, inserted.name, inserted.page_count, inserted.is_active, inserted.resource_type, inserted.created_at
      VALUES (@publisherId, @subjectId, @name, @pageCount, @isActive, @resourceType);
    `)

    return json(201, { resourceBook: sanitizeResourceBook(result.recordset[0]) })
  } catch (error) {
    if (error.number === 547) {
      return json(400, { error: 'Seçilen yayın evi veya ders bulunamadı.' })
    }

    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('createResourceBookHandler failed', error)
    return json(500, { error: 'Kaynak kitap oluşturulamadı.' })
  }
}

async function updateResourceBookHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const resourceBookId = request.params.resourceBookId
    const payload = await request.json().catch(() => null)
    const name = payload?.name?.trim()
    const publisherId = payload?.publisherId
    const subjectId = payload?.subjectId || null
    const pageCount = Number(payload?.pageCount)
    const isActive = payload?.isActive !== false
    const type = payload?.type

    if (!publisherId) {
      return json(400, { error: 'Yayın evi seçilmeli.' })
    }
    if (!name || name.length < 2) {
      return json(400, { error: 'Kaynak kitap adı en az 2 karakter olmalı.' })
    }
    if (!Number.isInteger(pageCount) || pageCount <= 0) {
      return json(400, { error: 'Sayfa sayısı pozitif bir tam sayı olmalı.' })
    }
    if (!RESOURCE_BOOK_TYPES.includes(type)) {
      return json(400, { error: 'Kaynak tipi seçilmeli.' })
    }

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: resourceBookId },
      publisherId: { type: sql.UniqueIdentifier, value: publisherId },
      subjectId: { type: sql.UniqueIdentifier, value: subjectId },
      name: { type: sql.NVarChar(200), value: name },
      pageCount: { type: sql.Int, value: pageCount },
      isActive: { type: sql.Bit, value: isActive },
      resourceType: { type: sql.NVarChar(30), value: type },
    })

    const result = await requestDb.query(`
      UPDATE dbo.ResourceBooks
      SET publisher_id = @publisherId, subject_id = @subjectId, name = @name, page_count = @pageCount, is_active = @isActive, resource_type = @resourceType
      OUTPUT inserted.id, inserted.publisher_id, inserted.subject_id, inserted.name, inserted.page_count, inserted.is_active, inserted.resource_type, inserted.created_at
      WHERE id = @id;
    `)

    const record = result.recordset[0]
    if (!record) {
      return json(404, { error: 'Kaynak kitap bulunamadı.' })
    }

    return json(200, { resourceBook: sanitizeResourceBook(record) })
  } catch (error) {
    if (error.number === 547) {
      return json(400, { error: 'Seçilen yayın evi veya ders bulunamadı.' })
    }

    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('updateResourceBookHandler failed', error)
    return json(500, { error: 'Kaynak kitap güncellenemedi.' })
  }
}

async function listResourceBookTopicsHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({})
    const result = await requestDb.query(`
      SELECT id, resource_book_id, name, created_at
      FROM dbo.ResourceBookTopics
      ORDER BY created_at ASC;
    `)

    return json(200, { topics: result.recordset.map(sanitizeResourceBookTopic) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('listResourceBookTopicsHandler failed', error)
    return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
  }
}

async function createResourceBookTopicHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const payload = await request.json().catch(() => null)
    const name = payload?.name?.trim()
    const resourceBookId = payload?.resourceBookId

    if (!resourceBookId) {
      return json(400, { error: 'Kaynak kitap seçilmeli.' })
    }
    if (!name || name.length < 2) {
      return json(400, { error: 'İçerik adı en az 2 karakter olmalı.' })
    }

    const requestDb = await withRequest({
      resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId },
      name: { type: sql.NVarChar(200), value: name },
    })

    const result = await requestDb.query(`
      INSERT INTO dbo.ResourceBookTopics (resource_book_id, name)
      OUTPUT inserted.id, inserted.resource_book_id, inserted.name, inserted.created_at
      VALUES (@resourceBookId, @name);
    `)

    return json(201, { topic: sanitizeResourceBookTopic(result.recordset[0]) })
  } catch (error) {
    if (error.number === 547) {
      return json(400, { error: 'Seçilen kaynak kitap bulunamadı.' })
    }

    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('createResourceBookTopicHandler failed', error)
    return json(500, { error: 'İçerik oluşturulamadı.' })
  }
}

async function updateResourceBookTopicHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const topicId = request.params.topicId
    const payload = await request.json().catch(() => null)
    const name = payload?.name?.trim()

    if (!name || name.length < 2) {
      return json(400, { error: 'İçerik adı en az 2 karakter olmalı.' })
    }

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: topicId },
      name: { type: sql.NVarChar(200), value: name },
    })

    const result = await requestDb.query(`
      UPDATE dbo.ResourceBookTopics
      SET name = @name
      OUTPUT inserted.id, inserted.resource_book_id, inserted.name, inserted.created_at
      WHERE id = @id;
    `)

    const record = result.recordset[0]
    if (!record) {
      return json(404, { error: 'İçerik bulunamadı.' })
    }

    return json(200, { topic: sanitizeResourceBookTopic(record) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('updateResourceBookTopicHandler failed', error)
    return json(500, { error: 'İçerik güncellenemedi.' })
  }
}

async function listResourceBookTopicsForPanelHandler(request) {
  try {
    const token = readSessionToken(request)
    if (!token) {
      return json(401, { error: 'Oturum bulunamadı.' })
    }
    verifySessionToken(token)

    const resourceBookId = request.query.get('resourceBookId')
    if (!resourceBookId) {
      return json(200, { topics: [] })
    }

    const requestDb = await withRequest({
      resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId },
    })
    const topicsResult = await requestDb.query(`
      SELECT id, resource_book_id, name, created_at
      FROM dbo.ResourceBookTopics
      WHERE resource_book_id = @resourceBookId;
    `)

    if (!topicsResult.recordset.length) {
      return json(200, { topics: [] })
    }

    const testsRequestDb = await withRequest({
      resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId },
    })
    const testsResult = await testsRequestDb.query(`
      SELECT tt.id, tt.topic_id, tt.topic_name, tt.name, tt.page_start, tt.page_end, tt.page_count, tt.question_count, tt.created_at
      FROM dbo.ResourceBookTopicTests tt
      INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
      WHERE t.resource_book_id = @resourceBookId
      ORDER BY tt.page_start ASC;
    `)

    const testsByTopicId = new Map()
    testsResult.recordset.forEach((test) => {
      const list = testsByTopicId.get(test.topic_id) || []
      list.push(test)
      testsByTopicId.set(test.topic_id, list)
    })

    // Topics have no page number of their own, so order them by their earliest test's page — the
    // order a student would actually encounter them in the book, not alphabetical.
    const topics = topicsResult.recordset
      .map((topic) => {
        const topicTests = testsByTopicId.get(topic.id) || []
        const minPageStart = topicTests.length ? Math.min(...topicTests.map((t) => t.page_start)) : null
        return { topic, topicTests, minPageStart }
      })
      .sort((a, b) => {
        if (a.minPageStart === null && b.minPageStart === null) {
          return new Date(a.topic.created_at) - new Date(b.topic.created_at)
        }
        if (a.minPageStart === null) return 1
        if (b.minPageStart === null) return -1
        return a.minPageStart - b.minPageStart
      })
      .map(({ topic, topicTests }) => ({
        ...sanitizeResourceBookTopic(topic),
        tests: topicTests.map(sanitizeResourceBookTopicTest),
      }))

    return json(200, { topics })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('listResourceBookTopicsForPanelHandler failed', error)
    return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
  }
}

function sanitizeQuestionOption(record) {
  return {
    id: record.id,
    questionId: record.question_id,
    label: record.option_label,
    text: record.option_text,
    isCorrect: Boolean(record.is_correct),
  }
}

function sanitizeQuestion(record, options) {
  return {
    id: record.id,
    testId: record.test_id,
    orderNo: record.order_no,
    passageText: record.passage_text,
    questionText: record.question_text,
    createdAt: record.created_at,
    options: options.map(sanitizeQuestionOption),
  }
}

async function listQuestionsForTestHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const testId = request.params.testId

    const requestDb = await withRequest({
      testId: { type: sql.UniqueIdentifier, value: testId },
    })
    const questionsResult = await requestDb.query(`
      SELECT id, test_id, order_no, passage_text, question_text, created_at
      FROM dbo.Questions
      WHERE test_id = @testId
      ORDER BY order_no ASC;
    `)

    const optionsRequestDb = await withRequest({
      testId: { type: sql.UniqueIdentifier, value: testId },
    })
    const optionsResult = await optionsRequestDb.query(`
      SELECT o.id, o.question_id, o.option_label, o.option_text, o.is_correct
      FROM dbo.QuestionOptions o
      INNER JOIN dbo.Questions q ON q.id = o.question_id
      WHERE q.test_id = @testId
      ORDER BY o.option_label ASC;
    `)

    const optionsByQuestionId = new Map()
    optionsResult.recordset.forEach((option) => {
      const list = optionsByQuestionId.get(option.question_id) || []
      list.push(option)
      optionsByQuestionId.set(option.question_id, list)
    })

    const questions = questionsResult.recordset.map((question) =>
      sanitizeQuestion(question, optionsByQuestionId.get(question.id) || []),
    )

    return json(200, { questions })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('listQuestionsForTestHandler failed', error)
    return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
  }
}

async function createQuestionHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const testId = request.params.testId
    const payload = await request.json().catch(() => null)
    const orderNo = Number(payload?.orderNo)
    const passageText = payload?.passageText?.trim() || null
    const questionText = payload?.questionText?.trim()
    const options = Array.isArray(payload?.options) ? payload.options : []

    if (!Number.isInteger(orderNo) || orderNo <= 0) {
      return json(400, { error: 'Soru sırası pozitif bir tam sayı olmalı.' })
    }
    if (!questionText || questionText.length < 2) {
      return json(400, { error: 'Soru metni en az 2 karakter olmalı.' })
    }
    if (options.length < 2) {
      return json(400, { error: 'En az 2 seçenek girilmeli.' })
    }
    if (!options.some((option) => option?.isCorrect)) {
      return json(400, { error: 'Doğru cevap işaretlenmeli.' })
    }

    const requestDb = await withRequest({
      testId: { type: sql.UniqueIdentifier, value: testId },
      orderNo: { type: sql.Int, value: orderNo },
      passageText: { type: sql.NVarChar(sql.MAX), value: passageText },
      questionText: { type: sql.NVarChar(sql.MAX), value: questionText },
    })

    const questionResult = await requestDb.query(`
      INSERT INTO dbo.Questions (test_id, order_no, passage_text, question_text)
      OUTPUT inserted.id, inserted.test_id, inserted.order_no, inserted.passage_text, inserted.question_text, inserted.created_at
      VALUES (@testId, @orderNo, @passageText, @questionText);
    `)

    const question = questionResult.recordset[0]

    const insertedOptions = []
    for (const option of options) {
      const label = option?.label?.trim()?.toUpperCase()
      const text = option?.text?.trim()
      const isCorrect = Boolean(option?.isCorrect)

      if (!label || !text) {
        continue
      }

      const optionRequestDb = await withRequest({
        questionId: { type: sql.UniqueIdentifier, value: question.id },
        label: { type: sql.NChar(1), value: label },
        text: { type: sql.NVarChar(sql.MAX), value: text },
        isCorrect: { type: sql.Bit, value: isCorrect },
      })

      const optionResult = await optionRequestDb.query(`
        INSERT INTO dbo.QuestionOptions (question_id, option_label, option_text, is_correct)
        OUTPUT inserted.id, inserted.question_id, inserted.option_label, inserted.option_text, inserted.is_correct
        VALUES (@questionId, @label, @text, @isCorrect);
      `)

      insertedOptions.push(optionResult.recordset[0])
    }

    return json(201, { question: sanitizeQuestion(question, insertedOptions) })
  } catch (error) {
    if (error.number === 547) {
      return json(400, { error: 'Seçilen test bulunamadı.' })
    }
    if (error.number === 2601 || error.number === 2627) {
      return json(409, { error: 'Bu sıra numarası veya seçenek zaten kayıtlı.' })
    }

    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('createQuestionHandler failed', error)
    return json(500, { error: 'Soru oluşturulamadı.' })
  }
}

async function listResourceBookTopicTestsHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({})
    const result = await requestDb.query(`
      SELECT id, topic_id, topic_name, name, page_start, page_end, page_count, question_count, created_at
      FROM dbo.ResourceBookTopicTests
      ORDER BY created_at ASC;
    `)

    return json(200, { tests: result.recordset.map(sanitizeResourceBookTopicTest) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('listResourceBookTopicTestsHandler failed', error)
    return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
  }
}

async function createResourceBookTopicTestHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const payload = await request.json().catch(() => null)
    const name = payload?.name?.trim()
    const topicName = payload?.topicName?.trim()
    const topicId = payload?.topicId
    const pageStart = Number(payload?.pageStart)
    const pageEnd = Number(payload?.pageEnd)
    const questionCount = Number(payload?.questionCount)

    if (!topicId) {
      return json(400, { error: 'İçerik seçilmeli.' })
    }
    if (!topicName || topicName.length < 2) {
      return json(400, { error: 'Konu adı en az 2 karakter olmalı.' })
    }
    if (!name || name.length < 2) {
      return json(400, { error: 'Test adı en az 2 karakter olmalı.' })
    }
    if (!Number.isInteger(pageStart) || pageStart <= 0) {
      return json(400, { error: 'Başlangıç sayfası pozitif bir tam sayı olmalı.' })
    }
    if (!Number.isInteger(pageEnd) || pageEnd < pageStart) {
      return json(400, { error: 'Bitiş sayfası başlangıç sayfasından küçük olamaz.' })
    }
    if (!Number.isInteger(questionCount) || questionCount <= 0) {
      return json(400, { error: 'Soru sayısı pozitif bir tam sayı olmalı.' })
    }

    const pageCount = pageEnd - pageStart + 1

    const requestDb = await withRequest({
      topicId: { type: sql.UniqueIdentifier, value: topicId },
      topicName: { type: sql.NVarChar(200), value: topicName },
      name: { type: sql.NVarChar(200), value: name },
      pageStart: { type: sql.Int, value: pageStart },
      pageEnd: { type: sql.Int, value: pageEnd },
      pageCount: { type: sql.Int, value: pageCount },
      questionCount: { type: sql.Int, value: questionCount },
    })

    const result = await requestDb.query(`
      INSERT INTO dbo.ResourceBookTopicTests (topic_id, topic_name, name, page_start, page_end, page_count, question_count)
      OUTPUT inserted.id, inserted.topic_id, inserted.topic_name, inserted.name, inserted.page_start, inserted.page_end, inserted.page_count, inserted.question_count, inserted.created_at
      VALUES (@topicId, @topicName, @name, @pageStart, @pageEnd, @pageCount, @questionCount);
    `)

    return json(201, { test: sanitizeResourceBookTopicTest(result.recordset[0]) })
  } catch (error) {
    if (error.number === 547) {
      return json(400, { error: 'Seçilen içerik bulunamadı.' })
    }

    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('createResourceBookTopicTestHandler failed', error)
    return json(500, { error: 'Test oluşturulamadı.' })
  }
}

async function updateResourceBookTopicTestHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const testId = request.params.testId
    const payload = await request.json().catch(() => null)
    const name = payload?.name?.trim()
    const topicName = payload?.topicName?.trim()
    const pageStart = Number(payload?.pageStart)
    const pageEnd = Number(payload?.pageEnd)
    const questionCount = Number(payload?.questionCount)

    if (!topicName || topicName.length < 2) {
      return json(400, { error: 'Konu adı en az 2 karakter olmalı.' })
    }
    if (!name || name.length < 2) {
      return json(400, { error: 'Test adı en az 2 karakter olmalı.' })
    }
    if (!Number.isInteger(pageStart) || pageStart <= 0) {
      return json(400, { error: 'Başlangıç sayfası pozitif bir tam sayı olmalı.' })
    }
    if (!Number.isInteger(pageEnd) || pageEnd < pageStart) {
      return json(400, { error: 'Bitiş sayfası başlangıç sayfasından küçük olamaz.' })
    }
    if (!Number.isInteger(questionCount) || questionCount <= 0) {
      return json(400, { error: 'Soru sayısı pozitif bir tam sayı olmalı.' })
    }

    const pageCount = pageEnd - pageStart + 1

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: testId },
      topicName: { type: sql.NVarChar(200), value: topicName },
      name: { type: sql.NVarChar(200), value: name },
      pageStart: { type: sql.Int, value: pageStart },
      pageEnd: { type: sql.Int, value: pageEnd },
      pageCount: { type: sql.Int, value: pageCount },
      questionCount: { type: sql.Int, value: questionCount },
    })

    const result = await requestDb.query(`
      UPDATE dbo.ResourceBookTopicTests
      SET topic_name = @topicName, name = @name, page_start = @pageStart, page_end = @pageEnd, page_count = @pageCount, question_count = @questionCount
      OUTPUT inserted.id, inserted.topic_id, inserted.topic_name, inserted.name, inserted.page_start, inserted.page_end, inserted.page_count, inserted.question_count, inserted.created_at
      WHERE id = @id;
    `)

    const record = result.recordset[0]
    if (!record) {
      return json(404, { error: 'Test bulunamadı.' })
    }

    return json(200, { test: sanitizeResourceBookTopicTest(record) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('updateResourceBookTopicTestHandler failed', error)
    return json(500, { error: 'Test güncellenemedi.' })
  }
}

async function deleteResourceBookTopicTestHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const testId = request.params.testId

    const requestDb = await withRequest({
      testId: { type: sql.UniqueIdentifier, value: testId },
    })

    const result = await requestDb.query(`
      DELETE FROM dbo.QuestionOptions WHERE question_id IN (SELECT id FROM dbo.Questions WHERE test_id = @testId);
      DELETE FROM dbo.Questions WHERE test_id = @testId;
      DELETE FROM dbo.ResourceBookTopicTests WHERE id = @testId;
    `)

    const deletedCount = result.rowsAffected[result.rowsAffected.length - 1]
    if (!deletedCount) {
      return json(404, { error: 'Test bulunamadı.' })
    }

    return json(200, { success: true })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('deleteResourceBookTopicTestHandler failed', error)
    return json(500, { error: 'Test silinemedi.' })
  }
}

async function listTestAnswerKeyHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const testId = request.params.testId

    const requestDb = await withRequest({
      testId: { type: sql.UniqueIdentifier, value: testId },
    })
    const result = await requestDb.query(`
      SELECT order_no, correct_label FROM dbo.TestAnswerKeys WHERE test_id = @testId ORDER BY order_no ASC;
    `)

    return json(200, { entries: result.recordset.map(sanitizeTestAnswerKeyEntry) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('listTestAnswerKeyHandler failed', error)
    return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
  }
}

async function setTestAnswerKeyHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const testId = request.params.testId
    const payload = await request.json().catch(() => null)
    const entries = Array.isArray(payload?.entries) ? payload.entries : []

    const seenOrderNos = new Set()
    const normalizedEntries = []
    for (const entry of entries) {
      const orderNo = Number(entry?.orderNo)
      const correctLabel = entry?.correctLabel?.trim()?.toUpperCase()

      if (!Number.isInteger(orderNo) || orderNo <= 0) {
        return json(400, { error: 'Soru sırası pozitif bir tam sayı olmalı.' })
      }
      if (!['A', 'B', 'C', 'D', 'E'].includes(correctLabel)) {
        return json(400, { error: `${orderNo}. sorunun cevabı A-E arasında olmalı.` })
      }
      if (seenOrderNos.has(orderNo)) {
        return json(400, { error: `${orderNo}. soru için birden fazla cevap girilmiş.` })
      }
      seenOrderNos.add(orderNo)
      normalizedEntries.push({ orderNo, correctLabel })
    }

    const deleteRequestDb = await withRequest({
      testId: { type: sql.UniqueIdentifier, value: testId },
    })
    await deleteRequestDb.query(`DELETE FROM dbo.TestAnswerKeys WHERE test_id = @testId;`)

    for (const entry of normalizedEntries) {
      const insertRequestDb = await withRequest({
        testId: { type: sql.UniqueIdentifier, value: testId },
        orderNo: { type: sql.Int, value: entry.orderNo },
        correctLabel: { type: sql.NChar(1), value: entry.correctLabel },
      })
      await insertRequestDb.query(`
        INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label)
        VALUES (@testId, @orderNo, @correctLabel);
      `)
    }

    return json(200, { entries: normalizedEntries })
  } catch (error) {
    if (error.number === 547) {
      return json(400, { error: 'Seçilen test bulunamadı.' })
    }

    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('setTestAnswerKeyHandler failed', error)
    return json(500, { error: 'Cevap anahtarı kaydedilemedi.' })
  }
}

module.exports = {
  listSubjectsHandler,
  listSubjectsForPanelHandler,
  listPublishersHandler,
  createPublisherHandler,
  listResourceBooksHandler,
  listResourceBooksForPanelHandler,
  createResourceBookHandler,
  updateResourceBookHandler,
  listResourceBookTopicsHandler,
  createResourceBookTopicHandler,
  updateResourceBookTopicHandler,
  listResourceBookTopicsForPanelHandler,
  listResourceBookTopicTestsHandler,
  createResourceBookTopicTestHandler,
  updateResourceBookTopicTestHandler,
  deleteResourceBookTopicTestHandler,
  listQuestionsForTestHandler,
  createQuestionHandler,
  listTestAnswerKeyHandler,
  setTestAnswerKeyHandler,
}
