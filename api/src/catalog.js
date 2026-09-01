const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { clearSessionHeaders, json } = require('./http')
const { requireAdmin, requireCatalogStaff, requireLibraryEditor } = require('./admin')
const { isSessionError, readSessionToken, verifySessionToken } = require('./security')
const { requireStudentContext, requireStudentWriteContext } = require('./studentScope')
const { gradeTestAnswers } = require('./testGrading')
const { sanitizeMistakePhoto, WRONG_QUESTION_OUTPUT_COLUMNS } = require('./mistakePhoto')
const { sanitizeWrongQuestion } = require('./progress')

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

const RESOURCE_BOOK_TYPES = ['konu_anlatimi', 'soru_bankasi', 'okuma_kitabi', 'etkinlik']
const RESOURCE_BOOK_GRADES = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'])
// Kütüphane özelliği (veli/öğretmen kaynak gezinme + ekleme) ortaokul (5-8) ve lise (9-12) kademelerini kapsıyor.
const LIBRARY_GRADES = new Set(['5', '6', '7', '8', '9', '10', '11', '12'])
const LIBRARY_CREATOR_ROLES = new Set(['ogretmen', 'ebeveyn'])
const MAX_ANSWER_KEY_PHOTOS = 8
// Bir kaynak onaylıysa herkese, onay bekliyor/reddedildiyse sadece onu ekleyen kişiye görünür.
const LIBRARY_VISIBILITY_SQL = "(rb.status = 'approved' OR rb.created_by_user_id = @actorUserId)"
const MAX_RESOURCE_IMAGE_LENGTH = 350000
const RESOURCE_IMAGE_DATA_URL_PATTERN = /^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=\s]+$/i

function sanitizeResourceBookImageUrl(value) {
  const imageUrl = value?.trim() || null
  if (!imageUrl) return { value: null }

  if (imageUrl.length > MAX_RESOURCE_IMAGE_LENGTH) {
    return { error: 'Görsel dosyası çok büyük. Daha küçük bir görsel yükleyin.' }
  }

  if (
    imageUrl.startsWith('https://') ||
    imageUrl.startsWith('http://') ||
    RESOURCE_IMAGE_DATA_URL_PATTERN.test(imageUrl)
  ) {
    return { value: imageUrl }
  }

  return { error: 'Görsel için geçerli bir URL veya JPG/PNG/WEBP dosyası kullanılmalı.' }
}

function sanitizeResourceBook(record) {
  return {
    id: record.id,
    publisherId: record.publisher_id,
    publisherName: record.publisher_name || null,
    subjectId: record.subject_id,
    subjectName: record.subject_name || null,
    name: record.name,
    isActive: Boolean(record.is_active),
    type: record.resource_type,
    hasAnswerKey: Boolean(record.has_answer_key),
    imageUrl: record.image_url || null,
    publishYear: record.publish_year || null,
    publishMonthYear: record.publish_month_year || null,
    grade: record.grade || null,
    resourceSource: record.resource_source || null,
    scope: record.scope || 'catalog',
    status: record.status,
    createdByRole: record.created_by_role || null,
    createdByUserId: record.created_by_user_id || null,
    createdByName: record.created_by_name || null,
    rejectionReason: record.rejection_reason || null,
    createdAt: record.created_at,
  }
}

function isDisabledQueryParam(value) {
  return value === '0' || value?.toLowerCase() === 'false'
}

function sanitizeResourceBookPublishMonthYear(value) {
  const publishMonthYear = value?.trim() || null
  if (!publishMonthYear) return { value: null }

  if (publishMonthYear.length > 20) {
    return { error: 'Basım ay/yıl bilgisi en fazla 20 karakter olmalı.' }
  }

  return { value: publishMonthYear }
}

function sanitizeResourceBookPublishYear(value) {
  const publishYear = Number(value)
  const currentYear = new Date().getFullYear()
  if (!Number.isInteger(publishYear) || publishYear < 1900 || publishYear > currentYear + 1) {
    return { error: 'Basım yılı geçerli bir yıl olmalı.' }
  }

  return { value: publishYear }
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

function sanitizeResourceBookTopicTest(
  record,
  completedTestIds,
  manualTestIds,
  testResultCounts,
  assignedTestIds,
  answerKeyCountByTestId,
  manualAnswersByTestId,
) {
  const isGraded = Boolean(completedTestIds && completedTestIds.has(record.id))
  const isManual = Boolean(manualTestIds && manualTestIds.has(record.id))
  const result = testResultCounts ? testResultCounts.get(record.id) : null
  const completed = isGraded || isManual
  const answerKeyCount = answerKeyCountByTestId ? answerKeyCountByTestId.get(record.id) || 0 : 0
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
    completed,
    completionSource: isGraded ? 'graded' : isManual ? 'manual' : null,
    correctCount: result ? result.correct : undefined,
    wrongCount: result ? result.wrong : undefined,
    blankCount: result ? result.blank : undefined,
    // Zaten bir göreve eklenmiş ama henüz tamamlanmamış testler (yeni bir ödeve tekrar
    // eklenmeden önce panelde ayırt edilebilsin diye).
    assignedPending: !completed && Boolean(assignedTestIds && assignedTestIds.has(record.id)),
    // Testin tüm soruları için cevap anahtarı girilmişse veli optik form ile (cevap anahtarıyla
    // otomatik notlanan) sonuç girebilir; aksi halde sadece doğru/yanlış/boş sayısını elle girer.
    hasAnswerKey: answerKeyCount > 0 && answerKeyCount === record.question_count,
    manualAnswers: manualAnswersByTestId ? manualAnswersByTestId.get(record.id) : undefined,
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

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listSubjectsHandler failed', error)
    return json(500, { error: 'Dersler yüklenemedi.' })
  }
}

// Yeni bir ders (branş) ekler. Dersler tüm uygulamada ortaktır (dbo.Subjects). Aynı adlı
// ders zaten varsa (büyük/küçük harf duyarsız) mevcut kayıt döner — idempotent.
async function createSubjectHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const payload = await request.json().catch(() => null)
    const name = typeof payload?.name === 'string' ? payload.name.trim() : ''
    if (name.length < 2 || name.length > 100) {
      return json(400, { error: 'Ders adı 2-100 karakter olmalı.' })
    }

    const requestDb = await withRequest({ name: { type: sql.NVarChar(100), value: name } })
    const result = await requestDb.query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.Subjects WHERE name = @name)
        INSERT INTO dbo.Subjects (name) VALUES (@name);
      SELECT id, name, created_at FROM dbo.Subjects WHERE name = @name;
    `)

    return json(201, { subject: sanitizeSubject(result.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('createSubjectHandler failed', error)
    return json(500, { error: 'Ders eklenemedi.' })
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

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listSubjectsForPanelHandler failed', error)
    return json(500, { error: 'Dersler yüklenemedi.' })
  }
}

async function listSubjectsForRegistrationHandler() {
  try {
    const requestDb = await withRequest({})
    const result = await requestDb.query(`
      SELECT id, name, created_at FROM dbo.Subjects ORDER BY name ASC;
    `)

    return json(200, { subjects: result.recordset.map(sanitizeSubject) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('listSubjectsForRegistrationHandler failed', error)
    return json(500, { error: 'Dersler yüklenemedi.' })
  }
}

async function listPublishersHandler(request) {
  try {
    const { error } = await requireCatalogStaff(request)
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

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listPublishersHandler failed', error)
    return json(500, { error: 'Yayınevleri yüklenemedi.' })
  }
}

async function listPublishersForPanelHandler(request) {
  try {
    const token = readSessionToken(request)
    if (!token) {
      return json(401, { error: 'Oturum bulunamadı.' })
    }
    verifySessionToken(token)

    const requestDb = await withRequest({})
    const result = await requestDb.query(`
      SELECT id, name, created_at FROM dbo.Publishers ORDER BY name ASC;
    `)

    return json(200, { publishers: result.recordset.map(sanitizePublisher) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listPublishersForPanelHandler failed', error)
    return json(500, { error: 'Yayınevleri yüklenemedi.' })
  }
}

async function createPublisherHandler(request) {
  try {
    const { error } = await requireLibraryEditor(request)
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
    const { error } = await requireCatalogStaff(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({})
    const result = await requestDb.query(`
      SELECT rb.id, rb.publisher_id, p.name AS publisher_name, rb.subject_id, s.name AS subject_name,
             rb.name, rb.is_active, rb.resource_type, rb.has_answer_key, rb.image_url, rb.publish_year, rb.publish_month_year, rb.grade, rb.resource_source, rb.created_at,
             rb.status, rb.created_by_role, rb.created_by_user_id, rb.rejection_reason, u.full_name AS created_by_name
      FROM dbo.ResourceBooks rb
      LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
      LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
      LEFT JOIN dbo.Users u ON u.id = rb.created_by_user_id
      WHERE rb.scope = 'catalog' AND NOT (rb.status = 'pending' AND rb.is_active = 0)
      ORDER BY rb.created_at ASC;
    `)

    return json(200, { resourceBooks: result.recordset.map(sanitizeResourceBook) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listResourceBooksHandler failed', error)
    return json(500, { error: 'Kaynak kitaplar yüklenemedi.' })
  }
}

function sanitizeResourceBookAnswerKeyStatus(record) {
  return {
    ...sanitizeResourceBook(record),
    totalTestCount: record.total_test_count,
    incompleteTestCount: record.incomplete_test_count,
  }
}

async function listResourceBooksMissingAnswerKeyHandler(request) {
  try {
    const { error } = await requireCatalogStaff(request)
    if (error) {
      return error
    }

    // has_answer_key only marks that a book is *supposed* to have one; the actual answer
    // data lives per-test in TestAnswerKeys, entered separately from that flag. So a book
    // can have has_answer_key = 1 while its tests still sit at 0 entered answers — that's
    // the case this list needs to surface, not just books where the flag itself is off.
    const requestDb = await withRequest({})
    const result = await requestDb.query(`
      SELECT rb.id, rb.publisher_id, p.name AS publisher_name, rb.subject_id, s.name AS subject_name,
             rb.name, rb.is_active, rb.resource_type, rb.has_answer_key, rb.image_url, rb.publish_month_year, rb.grade, rb.created_at,
             COUNT(tt.id) AS total_test_count,
             SUM(CASE WHEN tt.question_count > ISNULL(ak.answer_count, 0) THEN 1 ELSE 0 END) AS incomplete_test_count
      FROM dbo.ResourceBooks rb
      LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
      LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
      INNER JOIN dbo.ResourceBookTopics rbt ON rbt.resource_book_id = rb.id
      INNER JOIN dbo.ResourceBookTopicTests tt ON tt.topic_id = rbt.id
      LEFT JOIN (
        SELECT test_id, COUNT(*) AS answer_count
        FROM dbo.TestAnswerKeys
        GROUP BY test_id
      ) ak ON ak.test_id = tt.id
      WHERE rb.scope = 'catalog' AND rb.resource_type = 'soru_bankasi' AND rb.has_answer_key = 1
      GROUP BY rb.id, rb.publisher_id, p.name, rb.subject_id, s.name, rb.name,
               rb.is_active, rb.resource_type, rb.has_answer_key, rb.image_url, rb.publish_month_year, rb.grade, rb.created_at
      HAVING SUM(CASE WHEN tt.question_count > ISNULL(ak.answer_count, 0) THEN 1 ELSE 0 END) > 0
      ORDER BY s.name ASC, rb.name ASC;
    `)

    return json(200, { resourceBooks: result.recordset.map(sanitizeResourceBookAnswerKeyStatus) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listResourceBooksMissingAnswerKeyHandler failed', error)
    return json(500, { error: 'Kaynak kitaplar yüklenemedi.' })
  }
}

async function listResourceBooksForPanelHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const subjectId = request.query.get('subjectId')
    const includeStats = !isDisabledQueryParam(request.query.get('includeStats'))
    const includeImages = !isDisabledQueryParam(request.query.get('includeImages'))
    const imageColumn = includeImages ? 'rb.image_url' : 'CAST(NULL AS NVARCHAR(MAX)) AS image_url'

    const requestDb = await withRequest(
      {
        studentId: { type: sql.UniqueIdentifier, value: studentId },
        ...(subjectId ? { subjectId: { type: sql.UniqueIdentifier, value: subjectId } } : {}),
      },
    )
    const result = await requestDb.query(`
      SELECT rb.id, rb.publisher_id, p.name AS publisher_name, rb.subject_id, s.name AS subject_name,
             rb.name, rb.is_active, rb.resource_type, rb.has_answer_key, ${imageColumn},
             rb.publish_month_year, rb.grade, rb.resource_source, rb.created_at
      FROM dbo.StudentResourceBooks srb
      INNER JOIN dbo.ResourceBooks rb ON rb.id = srb.resource_book_id
      LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
      LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
      WHERE srb.student_id = @studentId AND rb.is_active = 1 ${subjectId ? 'AND rb.subject_id = @subjectId' : ''}
      ORDER BY s.name ASC, rb.name ASC;
    `)

    const resourceBooks = result.recordset.map(sanitizeResourceBook)
    if (!includeStats) {
      return json(200, { resourceBooks })
    }

    const stats = await fetchResourceBookStatsForStudent(
      studentId,
      resourceBooks.map((book) => book.id),
    )
    const resourceBooksWithStats = resourceBooks.map((book) => {
      const bookStats = stats.get(book.id)
      if (!bookStats) return book
      return { ...book, completionRate: bookStats.completionRate, successRate: bookStats.successRate }
    })

    return json(200, { resourceBooks: resourceBooksWithStats })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listResourceBooksForPanelHandler failed', error)
    return json(500, { error: 'Kaynak kitaplar yüklenemedi.' })
  }
}

async function createResourceBookHandler(request) {
  try {
    const { error } = await requireLibraryEditor(request)
    if (error) {
      return error
    }

    const payload = await request.json().catch(() => null)
    const name = payload?.name?.trim()
    const publisherId = payload?.publisherId
    const subjectId = payload?.subjectId || null
    const isActive = payload?.isActive !== false
    const type = payload?.type
    const hasAnswerKey = payload?.hasAnswerKey !== false
    const imageResult = sanitizeResourceBookImageUrl(payload?.imageUrl)
    const publishMonthYearResult = sanitizeResourceBookPublishMonthYear(payload?.publishMonthYear)
    const grade = payload?.grade || null
    // Kaynak türü (okul/özel) artık UI'da seçtirilmiyor — tüm yeni kaynaklar 'ozel' olarak eklenir.
    // Kolon ileride tekrar kullanılabilir diye tabloda bırakıldı.
    const resourceSource = 'ozel'

    if (!publisherId) {
      return json(400, { error: 'Yayın evi seçilmeli.' })
    }
    if (!name || name.length < 2) {
      return json(400, { error: 'Kaynak kitap adı en az 2 karakter olmalı.' })
    }
    if (!RESOURCE_BOOK_TYPES.includes(type)) {
      return json(400, { error: 'Kaynak tipi seçilmeli.' })
    }
    if (imageResult.error) {
      return json(400, { error: imageResult.error })
    }
    if (publishMonthYearResult.error) {
      return json(400, { error: publishMonthYearResult.error })
    }
    if (!RESOURCE_BOOK_GRADES.has(grade)) {
      return json(400, { error: 'Sınıf seçilmeli.' })
    }

    const requestDb = await withRequest({
      publisherId: { type: sql.UniqueIdentifier, value: publisherId },
      subjectId: { type: sql.UniqueIdentifier, value: subjectId },
      name: { type: sql.NVarChar(200), value: name },
      isActive: { type: sql.Bit, value: isActive },
      resourceType: { type: sql.NVarChar(30), value: type },
      hasAnswerKey: { type: sql.Bit, value: hasAnswerKey },
      imageUrl: { type: sql.NVarChar(sql.MAX), value: imageResult.value },
      publishMonthYear: { type: sql.NVarChar(20), value: publishMonthYearResult.value },
      grade: { type: sql.NVarChar(20), value: grade },
      resourceSource: { type: sql.NVarChar(20), value: resourceSource },
    })

    const result = await requestDb.query(`
      INSERT INTO dbo.ResourceBooks (publisher_id, subject_id, name, is_active, resource_type, has_answer_key, image_url, publish_month_year, grade, resource_source)
      OUTPUT inserted.id, inserted.publisher_id, inserted.subject_id, inserted.name, inserted.is_active, inserted.resource_type, inserted.has_answer_key, inserted.image_url, inserted.publish_month_year, inserted.grade, inserted.resource_source, inserted.created_at
      VALUES (@publisherId, @subjectId, @name, @isActive, @resourceType, @hasAnswerKey, @imageUrl, @publishMonthYear, @grade, @resourceSource);
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
    const { error } = await requireLibraryEditor(request)
    if (error) {
      return error
    }

    const resourceBookId = request.params.resourceBookId
    const payload = await request.json().catch(() => null)
    const name = payload?.name?.trim()
    const publisherId = payload?.publisherId
    const subjectId = payload?.subjectId || null
    const isActive = payload?.isActive !== false
    const type = payload?.type
    const hasAnswerKey = payload?.hasAnswerKey !== false
    const imageResult = sanitizeResourceBookImageUrl(payload?.imageUrl)
    const publishMonthYearResult = sanitizeResourceBookPublishMonthYear(payload?.publishMonthYear)
    const grade = payload?.grade || null
    // Kaynak türü (okul/özel) artık UI'da seçtirilmiyor — tüm kaynaklar 'ozel' olarak kalır.
    // Kolon ileride tekrar kullanılabilir diye tabloda bırakıldı.
    const resourceSource = 'ozel'

    if (!publisherId) {
      return json(400, { error: 'Yayın evi seçilmeli.' })
    }
    if (!name || name.length < 2) {
      return json(400, { error: 'Kaynak kitap adı en az 2 karakter olmalı.' })
    }
    if (!RESOURCE_BOOK_TYPES.includes(type)) {
      return json(400, { error: 'Kaynak tipi seçilmeli.' })
    }
    if (imageResult.error) {
      return json(400, { error: imageResult.error })
    }
    if (publishMonthYearResult.error) {
      return json(400, { error: publishMonthYearResult.error })
    }
    if (!RESOURCE_BOOK_GRADES.has(grade)) {
      return json(400, { error: 'Sınıf seçilmeli.' })
    }

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: resourceBookId },
      publisherId: { type: sql.UniqueIdentifier, value: publisherId },
      subjectId: { type: sql.UniqueIdentifier, value: subjectId },
      name: { type: sql.NVarChar(200), value: name },
      isActive: { type: sql.Bit, value: isActive },
      resourceType: { type: sql.NVarChar(30), value: type },
      hasAnswerKey: { type: sql.Bit, value: hasAnswerKey },
      imageUrl: { type: sql.NVarChar(sql.MAX), value: imageResult.value },
      publishMonthYear: { type: sql.NVarChar(20), value: publishMonthYearResult.value },
      grade: { type: sql.NVarChar(20), value: grade },
      resourceSource: { type: sql.NVarChar(20), value: resourceSource },
    })

    const result = await requestDb.query(`
      UPDATE dbo.ResourceBooks
      SET publisher_id = @publisherId, subject_id = @subjectId, name = @name, is_active = @isActive, resource_type = @resourceType, has_answer_key = @hasAnswerKey, image_url = @imageUrl, publish_month_year = @publishMonthYear, grade = @grade, resource_source = @resourceSource
      OUTPUT inserted.id, inserted.publisher_id, inserted.subject_id, inserted.name, inserted.is_active, inserted.resource_type, inserted.has_answer_key, inserted.image_url, inserted.publish_month_year, inserted.grade, inserted.resource_source, inserted.created_at
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

const LIBRARY_RESOURCE_BOOK_SELECT = `
  SELECT rb.id, rb.publisher_id, p.name AS publisher_name, rb.subject_id, s.name AS subject_name,
         rb.name, rb.is_active, rb.resource_type, rb.has_answer_key, rb.image_url,
         rb.publish_year, rb.publish_month_year, rb.grade, rb.resource_source, rb.scope, rb.status,
         rb.created_by_role, rb.created_by_user_id, rb.rejection_reason, rb.created_at
  FROM dbo.ResourceBooks rb
  LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
  LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
`

/**
 * Kütüphane rafı: bir sınıf + ders için görülebilir kaynaklar. Onaylı kaynaklar herkese,
 * onay bekleyen/reddedilen kaynaklar ise sadece onu ekleyen kullanıcıya görünür.
 */
// limit varsayılanı yüksek tutulur (200) ki bugünkü tam liste davranışı fiilen değişmesin —
// sadece kaynak sayısı büyüdükçe listenin sınırsız büyümesine karşı bir güvenlik sınırı sağlar.
async function fetchLibraryResourceBooks({ grade, subjectId, actorUserId, source, limit = 200, isAdmin = false }) {
  const requestDb = await withRequest({
    grade: { type: sql.NVarChar(20), value: grade },
    subjectId: { type: sql.UniqueIdentifier, value: subjectId },
    actorUserId: { type: sql.UniqueIdentifier, value: actorUserId },
    limit: { type: sql.Int, value: limit },
    ...(source ? { source: { type: sql.NVarChar(20), value: source } } : {}),
  })
  const result = await requestDb.query(`
    ${LIBRARY_RESOURCE_BOOK_SELECT}
    WHERE rb.is_active = 1 AND rb.scope = 'catalog' AND rb.grade = @grade AND rb.subject_id = @subjectId
      AND ${LIBRARY_VISIBILITY_SQL} ${source ? 'AND rb.resource_source = @source' : ''}
    ORDER BY rb.name ASC
    OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY;
  `)
  return result.recordset.map((record) => ({
    ...sanitizeResourceBook(record),
    canDelete: isAdmin || String(record.created_by_user_id).toLowerCase() === String(actorUserId).toLowerCase(),
  }))
}

async function fetchResourceBookById(resourceBookId) {
  const requestDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: resourceBookId } })
  const result = await requestDb.query(`
    ${LIBRARY_RESOURCE_BOOK_SELECT}
    WHERE rb.id = @id;
  `)
  return result.recordset[0] ? sanitizeResourceBook(result.recordset[0]) : null
}

async function reviewResourceBookHandler(request) {
  try {
    const { error, session } = await requireLibraryEditor(request)
    if (error) {
      return error
    }

    const resourceBookId = request.params.resourceBookId
    const payload = await request.json().catch(() => null)
    const action = payload?.action
    const reason = payload?.reason?.trim() || null

    if (!['approve', 'reject'].includes(action)) {
      return json(400, { error: 'Geçersiz aksiyon.' })
    }
    if (action === 'reject' && (!reason || reason.length < 2)) {
      return json(400, { error: 'Red gerekçesi en az 2 karakter olmalı.' })
    }

    const nextStatus = action === 'approve' ? 'approved' : 'rejected'
    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: resourceBookId },
      status: { type: sql.NVarChar(20), value: nextStatus },
      reviewedByUserId: { type: sql.UniqueIdentifier, value: session.sub },
      rejectionReason: { type: sql.NVarChar(500), value: action === 'reject' ? reason : null },
    })
    const result = await requestDb.query(`
      UPDATE dbo.ResourceBooks
      SET status = @status, reviewed_by_user_id = @reviewedByUserId, reviewed_at = SYSUTCDATETIME(), rejection_reason = @rejectionReason
      OUTPUT inserted.id
      WHERE id = @id AND status = 'pending';
    `)

    if (!result.recordset[0]) {
      return json(404, { error: 'Onay bekleyen kaynak bulunamadı.' })
    }

    return json(200, { resourceBook: await fetchResourceBookById(resourceBookId) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('reviewResourceBookHandler failed', error)
    return json(500, { error: 'Kaynak güncellenemedi.' })
  }
}

// Kütüphane katalog içeriğini (konu/test/cevap anahtarı) yalnızca kütüphane editörleri
// düzenler. Özel (Kitaplık) bir kaynağın içeriğini ise yalnızca onu ekleyen kişi
// düzenleyebilir — diğer üçgen üyeleri yalnızca atama yapar/kullanır. resourceBookId
// çözülemezse (kayıt yok) orijinal editör kontrolünün 403'ü döner.
async function requireResourceBookEditor(request, resourceBookId) {
  const editor = await requireLibraryEditor(request)
  if (!editor.error || !resourceBookId) {
    return editor
  }

  let session
  try {
    session = verifySessionToken(readSessionToken(request) || '')
  } catch {
    return editor
  }
  // Veli, çocuğunun öğrenci görünümündeyken özel kaynak içeriğini düzenleyemez.
  if (session.actingParentId) {
    return editor
  }
  const actorId = session.sub

  const db = await withRequest({ id: { type: sql.UniqueIdentifier, value: resourceBookId } })
  const result = await db.query(`
    SELECT scope, created_by_user_id FROM dbo.ResourceBooks WHERE id = @id;
  `)
  const book = result.recordset[0]
  if (
    book &&
    book.scope === 'private' &&
    String(book.created_by_user_id || '').toLowerCase() === String(actorId).toLowerCase()
  ) {
    return { session }
  }
  return editor
}

async function resolveBookIdFromTopic(topicId) {
  if (!topicId) return null
  const db = await withRequest({ id: { type: sql.UniqueIdentifier, value: topicId } })
  const result = await db.query(`SELECT resource_book_id FROM dbo.ResourceBookTopics WHERE id = @id;`)
  return result.recordset[0]?.resource_book_id || null
}

async function resolveBookIdFromTest(testId) {
  if (!testId) return null
  const db = await withRequest({ id: { type: sql.UniqueIdentifier, value: testId } })
  const result = await db.query(`
    SELECT t.resource_book_id
    FROM dbo.ResourceBookTopicTests tt
    INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
    WHERE tt.id = @id;
  `)
  return result.recordset[0]?.resource_book_id || null
}

async function listResourceBookTopicsHandler(request) {
  try {
    const { error } = await requireCatalogStaff(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({})
    const result = await requestDb.query(`
      SELECT rbt.id, rbt.resource_book_id, rbt.name, rbt.created_at
      FROM dbo.ResourceBookTopics rbt
      INNER JOIN dbo.ResourceBooks rb ON rb.id = rbt.resource_book_id
      WHERE rb.scope = 'catalog'
      ORDER BY rbt.created_at ASC;
    `)

    return json(200, { topics: result.recordset.map(sanitizeResourceBookTopic) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listResourceBookTopicsHandler failed', error)
    return json(500, { error: 'Konular yüklenemedi.' })
  }
}

async function createResourceBookTopicHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const name = payload?.name?.trim()
    const resourceBookId = payload?.resourceBookId

    const { error } = await requireResourceBookEditor(request, resourceBookId)
    if (error) {
      return error
    }

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
    const topicId = request.params.topicId
    const { error } = await requireResourceBookEditor(request, await resolveBookIdFromTopic(topicId))
    if (error) {
      return error
    }

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

function extractWeekNumber(name) {
  const match = /^(\d+)\s*\./.exec(name || '')
  return match ? parseInt(match[1], 10) : null
}

// Topics have no page number of their own, so order them by their earliest test's page — the
// order a reader would actually encounter them in the book, not creation order. Also merges any
// ResourceBookTopics rows that share a name (content entry sometimes creates one per test added)
// into a single group so callers show one section per topic instead of repeating headings.
// `topicRecords`/`testsByTopicId` values are raw SQL rows (snake_case); sanitize after calling.
function groupAndOrderTopicsByPage(topicRecords, testsByTopicId) {
  const topicGroupsByName = new Map()
  topicRecords.forEach((topic) => {
    const group = topicGroupsByName.get(topic.name)
    if (!group) {
      topicGroupsByName.set(topic.name, { representative: topic, ids: [topic.id] })
    } else {
      group.ids.push(topic.id)
      if (new Date(topic.created_at) < new Date(group.representative.created_at)) {
        group.representative = topic
      }
    }
  })

  return Array.from(topicGroupsByName.values())
    .map(({ representative, ids }) => {
      const topicTests = ids.flatMap((id) => testsByTopicId.get(id) || [])
      const minPageStart = topicTests.length ? Math.min(...topicTests.map((t) => t.page_start)) : null
      return { topic: representative, topicTests, minPageStart }
    })
    .sort((a, b) => {
      if (a.minPageStart === null && b.minPageStart === null) {
        return new Date(a.topic.created_at) - new Date(b.topic.created_at)
      }
      if (a.minPageStart === null) return 1
      if (b.minPageStart === null) return -1
      if (a.minPageStart !== b.minPageStart) return a.minPageStart - b.minPageStart
      // Tests independently paginated per topic (e.g. weekly denemeler each starting at
      // page 1) tie on minPageStart — fall back to topic creation order in that case.
      return new Date(a.topic.created_at) - new Date(b.topic.created_at)
    })
    .map(({ topic, topicTests }) => ({
      topic,
      // Weekly tests are independently paginated (each often starting at page 1), so they tie
      // on page_start — sort by the week number embedded in the name (e.g. "05. Hafta - ...")
      // instead, falling back to page_start when a name has no leading week number.
      tests: [...topicTests].sort((a, b) => {
        const weekA = extractWeekNumber(a.name)
        const weekB = extractWeekNumber(b.name)
        if (weekA !== null && weekB !== null && weekA !== weekB) return weekA - weekB
        if (weekA !== null && weekB === null) return -1
        if (weekA === null && weekB !== null) return 1
        return a.page_start - b.page_start
      }),
    }))
}

async function fetchResourceBookTopicsWithTests(resourceBookId, studentId) {
  const requestDb = await withRequest({
    resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId },
  })
  const topicsResult = await requestDb.query(`
    SELECT id, resource_book_id, name, created_at
    FROM dbo.ResourceBookTopics
    WHERE resource_book_id = @resourceBookId;
  `)

  if (!topicsResult.recordset.length) {
    return []
  }

  const testsRequestDb = await withRequest({
    resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId },
  })
  const testsResult = await testsRequestDb.query(`
    SELECT tt.id, tt.topic_id, tt.topic_name, tt.name, tt.page_start, tt.page_end, tt.page_count, tt.question_count, tt.created_at
    FROM dbo.ResourceBookTopicTests tt
    INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
    CROSS APPLY (
      SELECT CASE WHEN PATINDEX('[0-9]%', tt.name) = 1
                  THEN TRY_CAST(LEFT(tt.name, PATINDEX('%[^0-9]%', tt.name + 'x') - 1) AS INT)
             END AS leading_no
    ) wk
    WHERE t.resource_book_id = @resourceBookId
    ORDER BY ISNULL(wk.leading_no, 999999) ASC, tt.page_start ASC;
  `)

  const tasksDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId },
  })
  const tasksResult = await tasksDb.query(`
    SELECT selected_test_ids_json, test_results_json
    FROM dbo.Tasks
    WHERE student_id = @studentId AND resource_book_id = @resourceBookId AND selected_test_ids_json IS NOT NULL;
  `)
  const assignedTestIds = new Set()
  const completedTestIds = new Set()
  const testResultCounts = new Map()
  tasksResult.recordset.forEach((row) => {
    let testIds
    try {
      testIds = JSON.parse(row.selected_test_ids_json) || []
    } catch {
      testIds = []
    }
    testIds.forEach((testId) => assignedTestIds.add(testId))

    if (!row.test_results_json) return
    let results
    try {
      results = JSON.parse(row.test_results_json)
    } catch {
      return
    }
    Object.entries(results || {}).forEach(([testId, result]) => {
      completedTestIds.add(testId)
      const existing = testResultCounts.get(testId)
      if (!existing || (result?.gradedAt && (!existing.gradedAt || result.gradedAt > existing.gradedAt))) {
        testResultCounts.set(testId, result)
      }
    })
  })

  const manualCompletionsDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId },
  })
  const manualCompletionsResult = await manualCompletionsDb.query(`
    SELECT smtc.test_id, smtc.correct_count, smtc.wrong_count, smtc.blank_count, smtc.answers_json
    FROM dbo.StudentManualTestCompletions smtc
    INNER JOIN dbo.ResourceBookTopicTests tt ON tt.id = smtc.test_id
    INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
    WHERE smtc.student_id = @studentId AND t.resource_book_id = @resourceBookId;
  `)
  const manualTestIds = new Set(manualCompletionsResult.recordset.map((row) => row.test_id))
  const manualAnswersByTestId = new Map()
  manualCompletionsResult.recordset.forEach((row) => {
    if (row.answers_json) {
      try {
        manualAnswersByTestId.set(row.test_id, JSON.parse(row.answers_json))
      } catch {
        // yok say, düzenlenemez ama sonuç sayıları hâlâ gösterilir
      }
    }
    if (row.correct_count === null && row.wrong_count === null && row.blank_count === null) return
    testResultCounts.set(row.test_id, {
      correct: row.correct_count,
      wrong: row.wrong_count,
      blank: row.blank_count,
    })
  })

  const answerKeyCountsDb = await withRequest({
    resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId },
  })
  const answerKeyCountsResult = await answerKeyCountsDb.query(`
    SELECT tt.id AS test_id, COUNT(tak.id) AS key_count
    FROM dbo.ResourceBookTopicTests tt
    INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
    LEFT JOIN dbo.TestAnswerKeys tak ON tak.test_id = tt.id
    WHERE t.resource_book_id = @resourceBookId
    GROUP BY tt.id;
  `)
  const answerKeyCountByTestId = new Map(answerKeyCountsResult.recordset.map((row) => [row.test_id, row.key_count]))

  const testsByTopicId = new Map()
  testsResult.recordset.forEach((test) => {
    const list = testsByTopicId.get(test.topic_id) || []
    list.push(test)
    testsByTopicId.set(test.topic_id, list)
  })

  return groupAndOrderTopicsByPage(topicsResult.recordset, testsByTopicId).map(({ topic, tests }) => ({
    ...sanitizeResourceBookTopic(topic),
    tests: tests.map((test) =>
      sanitizeResourceBookTopicTest(
        test,
        completedTestIds,
        manualTestIds,
        testResultCounts,
        assignedTestIds,
        answerKeyCountByTestId,
        manualAnswersByTestId,
      ),
    ),
  }))
}

// Kitap listesi ekranlarında (veli/öğretmen kaynak kütüphanesi) her kart için tamamlanma ve
// başarı oranı göstermek amacıyla, verilen kaynak kitapların tümü için tek seferde toplu
// istatistik hesaplar (kitap başına ayrı sorgu atmamak için).
async function fetchResourceBookStatsForStudent(studentId, resourceBookIds) {
  const stats = new Map()
  if (!resourceBookIds.length) return stats

  const idBindings = Object.fromEntries(
    resourceBookIds.map((id, index) => [`resourceBookId${index}`, { type: sql.UniqueIdentifier, value: id }]),
  )
  const idPlaceholders = resourceBookIds.map((_, index) => `@resourceBookId${index}`).join(', ')

  const testsDb = await withRequest(idBindings)
  const testsResult = await testsDb.query(`
    SELECT tt.id AS test_id, t.resource_book_id
    FROM dbo.ResourceBookTopicTests tt
    INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
    WHERE t.resource_book_id IN (${idPlaceholders});
  `)

  const bookIdByTestId = new Map()
  testsResult.recordset.forEach((row) => {
    bookIdByTestId.set(row.test_id, row.resource_book_id)
    if (!stats.has(row.resource_book_id)) {
      stats.set(row.resource_book_id, { totalTests: 0, completedTests: 0, correct: 0, wrong: 0, blank: 0 })
    }
    stats.get(row.resource_book_id).totalTests += 1
  })

  if (!bookIdByTestId.size) return stats

  const completedTestIds = new Set()
  const testResultCounts = new Map()

  const tasksDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    ...idBindings,
  })
  const tasksResult = await tasksDb.query(`
    SELECT test_results_json
    FROM dbo.Tasks
    WHERE student_id = @studentId AND resource_book_id IN (${idPlaceholders}) AND test_results_json IS NOT NULL;
  `)
  tasksResult.recordset.forEach((row) => {
    let results
    try {
      results = JSON.parse(row.test_results_json)
    } catch {
      return
    }
    Object.entries(results || {}).forEach(([testId, result]) => {
      if (!bookIdByTestId.has(testId)) return
      completedTestIds.add(testId)
      const existing = testResultCounts.get(testId)
      if (!existing || (result?.gradedAt && (!existing.gradedAt || result.gradedAt > existing.gradedAt))) {
        testResultCounts.set(testId, result)
      }
    })
  })

  const manualDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    ...idBindings,
  })
  const manualResult = await manualDb.query(`
    SELECT smtc.test_id, smtc.correct_count, smtc.wrong_count, smtc.blank_count
    FROM dbo.StudentManualTestCompletions smtc
    INNER JOIN dbo.ResourceBookTopicTests tt ON tt.id = smtc.test_id
    INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
    WHERE smtc.student_id = @studentId AND t.resource_book_id IN (${idPlaceholders});
  `)
  manualResult.recordset.forEach((row) => {
    if (!bookIdByTestId.has(row.test_id)) return
    completedTestIds.add(row.test_id)
    if (row.correct_count === null && row.wrong_count === null && row.blank_count === null) return
    testResultCounts.set(row.test_id, {
      correct: row.correct_count,
      wrong: row.wrong_count,
      blank: row.blank_count,
    })
  })

  completedTestIds.forEach((testId) => {
    const bookId = bookIdByTestId.get(testId)
    if (!bookId || !stats.has(bookId)) return
    const entry = stats.get(bookId)
    entry.completedTests += 1
    const result = testResultCounts.get(testId)
    if (result) {
      entry.correct += Number(result.correct) || 0
      entry.wrong += Number(result.wrong) || 0
      entry.blank += Number(result.blank) || 0
    }
  })

  stats.forEach((entry, bookId) => {
    const answered = entry.correct + entry.wrong + entry.blank
    stats.set(bookId, {
      completionRate: entry.totalTests > 0 ? entry.completedTests / entry.totalTests : null,
      successRate: answered > 0 ? entry.correct / answered : null,
      correct: entry.correct,
      answered,
    })
  })

  return stats
}

async function listResourceBookTopicsForPanelHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const resourceBookId = request.query.get('resourceBookId')
    if (!resourceBookId) {
      return json(200, { topics: [] })
    }

    const assignmentDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId },
    })
    const assignmentResult = await assignmentDb.query(`
      SELECT TOP 1 rb.id
      FROM dbo.StudentResourceBooks srb
      INNER JOIN dbo.ResourceBooks rb ON rb.id = srb.resource_book_id
      WHERE srb.student_id = @studentId AND srb.resource_book_id = @resourceBookId AND rb.is_active = 1;
    `)
    if (!assignmentResult.recordset[0]) {
      return json(404, { error: 'Bu kaynak öğrenciye atanmamış.' })
    }

    const topics = await fetchResourceBookTopicsWithTests(resourceBookId, studentId)
    return json(200, { topics })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listResourceBookTopicsForPanelHandler failed', error)
    return json(500, { error: 'Konular yüklenemedi.' })
  }
}

async function verifyStudentTestAssignment(studentId, testId) {
  const requestDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    testId: { type: sql.UniqueIdentifier, value: testId },
  })
  const result = await requestDb.query(`
    SELECT TOP 1 tt.id
    FROM dbo.ResourceBookTopicTests tt
    INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
    INNER JOIN dbo.ResourceBooks rb ON rb.id = t.resource_book_id
    INNER JOIN dbo.StudentResourceBooks srb ON srb.resource_book_id = rb.id AND srb.student_id = @studentId
    WHERE tt.id = @testId AND rb.is_active = 1;
  `)
  return Boolean(result.recordset[0])
}

function parseNullableCount(value) {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) return null
  return parsed
}

async function markResourceBookTopicTestCompletionHandler(request) {
  try {
    const { error, studentId, actorId } = await requireStudentWriteContext(request)
    if (error) {
      return error
    }

    const testId = request.params.testId
    const isAssigned = await verifyStudentTestAssignment(studentId, testId)
    if (!isAssigned) {
      return json(404, { error: 'Test bu öğrenciye atanmış bir kaynakta bulunamadı.' })
    }

    const payload = await request.json().catch(() => null)
    const correctCount = parseNullableCount(payload?.correctCount)
    const wrongCount = parseNullableCount(payload?.wrongCount)
    const blankCount = parseNullableCount(payload?.blankCount)

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      testId: { type: sql.UniqueIdentifier, value: testId },
      markedByUserId: { type: sql.UniqueIdentifier, value: actorId },
      correctCount: { type: sql.Int, value: correctCount },
      wrongCount: { type: sql.Int, value: wrongCount },
      blankCount: { type: sql.Int, value: blankCount },
    })
    await requestDb.query(`
      MERGE dbo.StudentManualTestCompletions AS target
      USING (SELECT @studentId AS student_id, @testId AS test_id) AS source
        ON target.student_id = source.student_id AND target.test_id = source.test_id
      WHEN MATCHED THEN UPDATE SET
        correct_count = @correctCount,
        wrong_count = @wrongCount,
        blank_count = @blankCount
      WHEN NOT MATCHED THEN
        INSERT (student_id, test_id, marked_by_user_id, correct_count, wrong_count, blank_count)
        VALUES (@studentId, @testId, @markedByUserId, @correctCount, @wrongCount, @blankCount);
    `)

    return json(200, { success: true, completionSource: 'manual', correctCount, wrongCount, blankCount })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('markResourceBookTopicTestCompletionHandler failed', error)
    return json(500, { error: 'Test tamamlandı olarak işaretlenemedi.' })
  }
}

async function unmarkResourceBookTopicTestCompletionHandler(request) {
  try {
    const { error, studentId } = await requireStudentWriteContext(request)
    if (error) {
      return error
    }

    const testId = request.params.testId
    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      testId: { type: sql.UniqueIdentifier, value: testId },
    })
    await requestDb.query(`
      DELETE FROM dbo.StudentManualTestCompletions WHERE student_id = @studentId AND test_id = @testId;
    `)

    return json(200, { success: true, completionSource: null })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('unmarkResourceBookTopicTestCompletionHandler failed', error)
    return json(500, { error: 'İşaret kaldırılamadı.' })
  }
}

async function submitManualOpticalAnswersHandler(request) {
  try {
    const { error, studentId, actorId } = await requireStudentWriteContext(request)
    if (error) {
      return error
    }

    const testId = request.params.testId
    const isAssigned = await verifyStudentTestAssignment(studentId, testId)
    if (!isAssigned) {
      return json(404, { error: 'Test bu öğrenciye atanmış bir kaynakta bulunamadı.' })
    }

    const testDb = await withRequest({ testId: { type: sql.UniqueIdentifier, value: testId } })
    const testResult = await testDb.query(`SELECT question_count FROM dbo.ResourceBookTopicTests WHERE id = @testId;`)
    const questionCount = testResult.recordset[0]?.question_count
    if (!questionCount) {
      return json(404, { error: 'Test bulunamadı.' })
    }

    const payload = await request.json().catch(() => null)
    const { answers, result } = await gradeTestAnswers(testId, questionCount, payload?.answers)
    if (!result) {
      return json(400, { error: 'Tüm soruları işaretleyin — bu test için notlama ancak eksiksiz cevap anahtarıyla yapılabilir.' })
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      testId: { type: sql.UniqueIdentifier, value: testId },
      markedByUserId: { type: sql.UniqueIdentifier, value: actorId },
      correctCount: { type: sql.Int, value: result.correct },
      wrongCount: { type: sql.Int, value: result.wrong },
      blankCount: { type: sql.Int, value: result.blank },
      answersJson: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(answers) },
    })
    await requestDb.query(`
      MERGE dbo.StudentManualTestCompletions AS target
      USING (SELECT @studentId AS student_id, @testId AS test_id) AS source
        ON target.student_id = source.student_id AND target.test_id = source.test_id
      WHEN MATCHED THEN UPDATE SET
        correct_count = @correctCount,
        wrong_count = @wrongCount,
        blank_count = @blankCount,
        answers_json = @answersJson
      WHEN NOT MATCHED THEN
        INSERT (student_id, test_id, marked_by_user_id, correct_count, wrong_count, blank_count, answers_json)
        VALUES (@studentId, @testId, @markedByUserId, @correctCount, @wrongCount, @blankCount, @answersJson);
    `)

    return json(200, {
      success: true,
      completionSource: 'manual',
      correctCount: result.correct,
      wrongCount: result.wrong,
      blankCount: result.blank,
      correctLabels: result.correctLabels,
      answers,
    })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('submitManualOpticalAnswersHandler failed', error)
    return json(500, { error: 'Cevaplar kaydedilemedi.' })
  }
}

// Optik formda yanlış işaretlenmiş bir soruya velinin galeriden seçtiği ya da kamerayla çektiği
// fotoğrafı kaydeder. Doğruluk kontrolünü StudentManualTestCompletions.answers_json + TestAnswerKeys
// üzerinden server tarafında yapar (client'a güvenmiyoruz); tasks.js'deki Task'a bağlı akışın
// muadili ama task_id NULL bırakılarak dbo.WrongQuestions'a yazılır (Hata Defterim bu satırları da okur).
async function saveManualWrongQuestionPhotoHandler(request) {
  try {
    const testId = request.params.testId
    const orderNo = request.params.orderNo
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentWriteContext(request)
    if (error) {
      return error
    }

    const photoCheck = sanitizeMistakePhoto(payload?.photo)
    if (photoCheck.error) {
      return json(400, { error: photoCheck.error })
    }

    const completionDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      testId: { type: sql.UniqueIdentifier, value: testId },
    })
    const completionResult = await completionDb.query(`
      SELECT answers_json FROM dbo.StudentManualTestCompletions WHERE student_id = @studentId AND test_id = @testId;
    `)
    const completionRecord = completionResult.recordset[0]
    if (!completionRecord) {
      return json(404, { error: 'Bu test için kaydedilmiş bir sonuç bulunamadı.' })
    }

    const answers = completionRecord.answers_json ? JSON.parse(completionRecord.answers_json) : {}
    const studentAnswer = answers[orderNo]

    const keyDb = await withRequest({
      testId: { type: sql.UniqueIdentifier, value: testId },
      orderNo: { type: sql.Int, value: Number(orderNo) },
    })
    const keyResult = await keyDb.query(`
      SELECT correct_label FROM dbo.TestAnswerKeys WHERE test_id = @testId AND order_no = @orderNo;
    `)
    const correctLabel = keyResult.recordset[0]?.correct_label?.trim()

    const isActuallyWrong = Boolean(correctLabel) && Boolean(studentAnswer) && studentAnswer !== correctLabel
    if (!isActuallyWrong) {
      return json(400, { error: 'Bu soru yanlış işaretlenmemiş.' })
    }

    const testInfoDb = await withRequest({ testId: { type: sql.UniqueIdentifier, value: testId } })
    const testInfoResult = await testInfoDb.query(`
      SELECT t.name AS test_name, tp.name AS topic_name, rb.name AS book_name, pub.name AS publisher_name, s.name AS subject_name
      FROM dbo.ResourceBookTopicTests t
      JOIN dbo.ResourceBookTopics tp ON tp.id = t.topic_id
      JOIN dbo.ResourceBooks rb ON rb.id = tp.resource_book_id
      JOIN dbo.Publishers pub ON pub.id = rb.publisher_id
      LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
      WHERE t.id = @testId;
    `)
    const testInfo = testInfoResult.recordset[0]
    if (!testInfo) {
      return json(404, { error: 'Test bulunamadı.' })
    }

    const bindings = {
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      testId: { type: sql.UniqueIdentifier, value: testId },
      questionNumber: { type: sql.NVarChar(20), value: orderNo },
      subject: { type: sql.NVarChar(100), value: testInfo.subject_name || 'Genel' },
      topic: { type: sql.NVarChar(200), value: testInfo.topic_name || null },
      testName: { type: sql.NVarChar(200), value: testInfo.test_name || null },
      bookName: { type: sql.NVarChar(200), value: testInfo.book_name || null },
      publisherName: { type: sql.NVarChar(200), value: testInfo.publisher_name || null },
      photoUrl: { type: sql.NVarChar(sql.MAX), value: photoCheck.value },
      errorType: { type: sql.NVarChar(50), value: 'cevap-kagidi' },
    }

    const updateDb = await withRequest(bindings)
    const updateResult = await updateDb.query(`
      UPDATE dbo.WrongQuestions
      SET topic = @topic, test_name = @testName, book_name = @bookName, publisher_name = @publisherName, photo_url = @photoUrl
      OUTPUT ${WRONG_QUESTION_OUTPUT_COLUMNS}
      WHERE student_id = @studentId AND task_id IS NULL AND test_id = @testId AND question_number = @questionNumber;
    `)

    let wrongQuestionRecord = updateResult.recordset[0]
    if (!wrongQuestionRecord) {
      const insertDb = await withRequest(bindings)
      const insertResult = await insertDb.query(`
        INSERT INTO dbo.WrongQuestions (student_id, test_id, subject, topic, test_name, book_name, publisher_name, question_number, error_type, photo_url)
        OUTPUT ${WRONG_QUESTION_OUTPUT_COLUMNS}
        VALUES (@studentId, @testId, @subject, @topic, @testName, @bookName, @publisherName, @questionNumber, @errorType, @photoUrl);
      `)
      wrongQuestionRecord = insertResult.recordset[0]
    }

    return json(200, { wrongQuestion: sanitizeWrongQuestion(wrongQuestionRecord) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('saveManualWrongQuestionPhotoHandler failed', error)
    return json(500, { error: 'Fotoğraf kaydedilemedi.' })
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

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listQuestionsForTestHandler failed', error)
    return json(500, { error: 'Sorular yüklenemedi.' })
  }
}

async function createQuestionHandler(request) {
  try {
    const { error } = await requireLibraryEditor(request)
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
    const { error } = await requireCatalogStaff(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({})
    const result = await requestDb.query(`
      SELECT tt.id, tt.topic_id, tt.topic_name, tt.name, tt.page_start, tt.page_end, tt.page_count, tt.question_count, tt.created_at
      FROM dbo.ResourceBookTopicTests tt
      INNER JOIN dbo.ResourceBookTopics rbt ON rbt.id = tt.topic_id
      INNER JOIN dbo.ResourceBooks rb ON rb.id = rbt.resource_book_id
      WHERE rb.scope = 'catalog'
      ORDER BY tt.created_at ASC;
    `)

    const answerKeyCountsDb = await withRequest({})
    const answerKeyCountsResult = await answerKeyCountsDb.query(`
      SELECT test_id, COUNT(*) AS key_count FROM dbo.TestAnswerKeys GROUP BY test_id;
    `)
    const answerKeyCountByTestId = new Map(answerKeyCountsResult.recordset.map((row) => [row.test_id, row.key_count]))

    return json(200, {
      tests: result.recordset.map((record) =>
        sanitizeResourceBookTopicTest(record, undefined, undefined, undefined, undefined, answerKeyCountByTestId),
      ),
    })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listResourceBookTopicTestsHandler failed', error)
    return json(500, { error: 'Testler yüklenemedi.' })
  }
}

async function createResourceBookTopicTestHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const name = payload?.name?.trim()
    const topicName = payload?.topicName?.trim()
    const topicId = payload?.topicId

    const { error } = await requireResourceBookEditor(request, await resolveBookIdFromTopic(topicId))
    if (error) {
      return error
    }
    const pageStart = Number(payload?.pageStart)
    const pageEnd = Number(payload?.pageEnd)
    const questionCountRaw = payload?.questionCount
    const questionCount =
      questionCountRaw === undefined || questionCountRaw === null || questionCountRaw === ''
        ? null
        : Number(questionCountRaw)

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
    if (questionCount !== null && (!Number.isInteger(questionCount) || questionCount <= 0)) {
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

    if (error.number === 2601 || error.number === 2627) {
      return json(400, { error: 'Bu konuda aynı isimde bir test zaten var.' })
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
    const testId = request.params.testId
    const { error } = await requireResourceBookEditor(request, await resolveBookIdFromTest(testId))
    if (error) {
      return error
    }

    const payload = await request.json().catch(() => null)
    const name = payload?.name?.trim()
    const topicName = payload?.topicName?.trim()
    const pageStart = Number(payload?.pageStart)
    const pageEnd = Number(payload?.pageEnd)
    // Soru sayısı isteğe bağlı: alan hiç gönderilmezse (örn. konu/sayfa düzenlemesi) mevcut
    // değer korunur; cevap anahtarı akışında ise ayrıca gönderilip güncellenir.
    const hasQuestionCount = payload ? Object.prototype.hasOwnProperty.call(payload, 'questionCount') : false
    const questionCountRaw = payload?.questionCount
    const questionCount =
      questionCountRaw === undefined || questionCountRaw === null || questionCountRaw === ''
        ? null
        : Number(questionCountRaw)

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
    if (hasQuestionCount && questionCount !== null && (!Number.isInteger(questionCount) || questionCount <= 0)) {
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
      hasQuestionCount: { type: sql.Bit, value: hasQuestionCount },
      questionCount: { type: sql.Int, value: questionCount },
    })

    const result = await requestDb.query(`
      UPDATE dbo.ResourceBookTopicTests
      SET topic_name = @topicName, name = @name, page_start = @pageStart, page_end = @pageEnd, page_count = @pageCount,
          question_count = CASE WHEN @hasQuestionCount = 1 THEN @questionCount ELSE question_count END
      OUTPUT inserted.id, inserted.topic_id, inserted.topic_name, inserted.name, inserted.page_start, inserted.page_end, inserted.page_count, inserted.question_count, inserted.created_at
      WHERE id = @id;
    `)

    const record = result.recordset[0]
    if (!record) {
      return json(404, { error: 'Test bulunamadı.' })
    }

    return json(200, { test: sanitizeResourceBookTopicTest(record) })
  } catch (error) {
    if (error.number === 2601 || error.number === 2627) {
      return json(400, { error: 'Bu konuda aynı isimde bir test zaten var.' })
    }

    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('updateResourceBookTopicTestHandler failed', error)
    return json(500, { error: 'Test güncellenemedi.' })
  }
}

async function deleteResourceBookTopicTestHandler(request) {
  try {
    const testId = request.params.testId
    const { error } = await requireResourceBookEditor(request, await resolveBookIdFromTest(testId))
    if (error) {
      return error
    }

    const requestDb = await withRequest({
      testId: { type: sql.UniqueIdentifier, value: testId },
    })

    const result = await requestDb.query(`
      DELETE FROM dbo.QuestionOptions WHERE question_id IN (SELECT id FROM dbo.Questions WHERE test_id = @testId);
      DELETE FROM dbo.Questions WHERE test_id = @testId;
      DELETE FROM dbo.TestAnswerKeys WHERE test_id = @testId;
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
    const testId = request.params.testId
    const { error } = await requireResourceBookEditor(request, await resolveBookIdFromTest(testId))
    if (error) {
      return error
    }

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

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listTestAnswerKeyHandler failed', error)
    return json(500, { error: 'Cevap anahtarı yüklenemedi.' })
  }
}

async function setTestAnswerKeyHandler(request) {
  try {
    const testId = request.params.testId
    const { error } = await requireResourceBookEditor(request, await resolveBookIdFromTest(testId))
    if (error) {
      return error
    }

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
      if (!['A', 'B', 'C', 'D'].includes(correctLabel)) {
        return json(400, { error: `${orderNo}. sorunun cevabı A-D arasında olmalı.` })
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

const SCHOOL_TYPES = new Set(['devlet', 'ozel'])
const MAX_BULK_IMPORT_LINES = 500

function sanitizeSchool(record) {
  return {
    id: record.id,
    provinceId: record.province_id,
    provinceName: record.province_name || null,
    districtId: record.district_id,
    districtName: record.district_name || null,
    name: record.name,
    type: record.school_type,
    isActive: Boolean(record.is_active),
    createdAt: record.created_at,
  }
}

async function fetchDistrictWithProvince(districtId) {
  const requestDb = await withRequest({
    districtId: { type: sql.UniqueIdentifier, value: districtId },
  })
  const result = await requestDb.query(`
    SELECT TOP 1 id, province_id FROM dbo.Districts WHERE id = @districtId;
  `)
  return result.recordset[0] || null
}

async function listSchoolsForAdminHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const provinceId = request.query.get('provinceId') || null
    const districtId = request.query.get('districtId') || null
    const search = request.query.get('search')?.trim() || null

    const requestDb = await withRequest({
      provinceId: { type: sql.UniqueIdentifier, value: provinceId },
      districtId: { type: sql.UniqueIdentifier, value: districtId },
      search: { type: sql.NVarChar(200), value: search ? `%${search}%` : null },
    })
    const result = await requestDb.query(`
      SELECT s.id, s.province_id, pr.name AS province_name, s.district_id, d.name AS district_name,
             s.name, s.school_type, s.is_active, s.created_at
      FROM dbo.Schools s
      INNER JOIN dbo.Provinces pr ON pr.id = s.province_id
      INNER JOIN dbo.Districts d ON d.id = s.district_id
      WHERE (@provinceId IS NULL OR s.province_id = @provinceId)
        AND (@districtId IS NULL OR s.district_id = @districtId)
        AND (@search IS NULL OR s.name LIKE @search)
      ORDER BY pr.name ASC, d.name ASC, s.name ASC;
    `)

    return json(200, { schools: result.recordset.map(sanitizeSchool) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('listSchoolsForAdminHandler failed', error)
    return json(500, { error: 'Okullar yüklenemedi.' })
  }
}

async function createSchoolHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const payload = await request.json().catch(() => null)
    const districtId = payload?.districtId?.trim()
    const name = payload?.name?.trim()
    const type = payload?.type

    if (!districtId) {
      return json(400, { error: 'İlçe seçilmeli.' })
    }
    if (!name || name.length < 2) {
      return json(400, { error: 'Okul adı en az 2 karakter olmalı.' })
    }
    if (!SCHOOL_TYPES.has(type)) {
      return json(400, { error: 'Okul türü devlet veya özel olmalı.' })
    }

    const district = await fetchDistrictWithProvince(districtId)
    if (!district) {
      return json(400, { error: 'Seçilen ilçe bulunamadı.' })
    }

    const requestDb = await withRequest({
      provinceId: { type: sql.UniqueIdentifier, value: district.province_id },
      districtId: { type: sql.UniqueIdentifier, value: district.id },
      name: { type: sql.NVarChar(200), value: name },
      schoolType: { type: sql.NVarChar(20), value: type },
    })

    const result = await requestDb.query(`
      INSERT INTO dbo.Schools (province_id, district_id, name, school_type)
      OUTPUT inserted.id, inserted.province_id, inserted.district_id, inserted.name,
             inserted.school_type, inserted.is_active, inserted.created_at
      VALUES (@provinceId, @districtId, @name, @schoolType);
    `)

    const created = result.recordset[0]
    const withNamesDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: created.id },
    })
    const withNamesResult = await withNamesDb.query(`
      SELECT s.id, s.province_id, pr.name AS province_name, s.district_id, d.name AS district_name,
             s.name, s.school_type, s.is_active, s.created_at
      FROM dbo.Schools s
      INNER JOIN dbo.Provinces pr ON pr.id = s.province_id
      INNER JOIN dbo.Districts d ON d.id = s.district_id
      WHERE s.id = @id;
    `)

    return json(201, { school: sanitizeSchool(withNamesResult.recordset[0]) })
  } catch (error) {
    if (error.number === 2601 || error.number === 2627) {
      return json(409, { error: 'Bu ilçede aynı isimde bir okul zaten var.' })
    }

    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('createSchoolHandler failed', error)
    return json(500, { error: 'Okul oluşturulamadı.' })
  }
}

async function updateSchoolHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const schoolId = request.params.schoolId
    const payload = await request.json().catch(() => null)
    const name = payload?.name?.trim()
    const type = payload?.type
    const isActive = payload?.isActive

    if (!name || name.length < 2) {
      return json(400, { error: 'Okul adı en az 2 karakter olmalı.' })
    }
    if (!SCHOOL_TYPES.has(type)) {
      return json(400, { error: 'Okul türü devlet veya özel olmalı.' })
    }
    if (typeof isActive !== 'boolean') {
      return json(400, { error: 'Durum bilgisi geçersiz.' })
    }

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: schoolId },
      name: { type: sql.NVarChar(200), value: name },
      schoolType: { type: sql.NVarChar(20), value: type },
      isActive: { type: sql.Bit, value: isActive },
    })

    const result = await requestDb.query(`
      UPDATE dbo.Schools
      SET name = @name, school_type = @schoolType, is_active = @isActive
      WHERE id = @id;

      SELECT s.id, s.province_id, pr.name AS province_name, s.district_id, d.name AS district_name,
             s.name, s.school_type, s.is_active, s.created_at
      FROM dbo.Schools s
      INNER JOIN dbo.Provinces pr ON pr.id = s.province_id
      INNER JOIN dbo.Districts d ON d.id = s.district_id
      WHERE s.id = @id;
    `)

    const updated = result.recordset[0]
    if (!updated) {
      return json(404, { error: 'Okul bulunamadı.' })
    }

    return json(200, { school: sanitizeSchool(updated) })
  } catch (error) {
    if (error.number === 2601 || error.number === 2627) {
      return json(409, { error: 'Bu ilçede aynı isimde bir okul zaten var.' })
    }

    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('updateSchoolHandler failed', error)
    return json(500, { error: 'Okul güncellenemedi.' })
  }
}

async function bulkImportSchoolsHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const payload = await request.json().catch(() => null)
    const districtId = payload?.districtId?.trim()
    const rowsText = payload?.rows

    if (!districtId) {
      return json(400, { error: 'İlçe seçilmeli.' })
    }
    if (typeof rowsText !== 'string' || !rowsText.trim()) {
      return json(400, { error: 'İçe aktarılacak okul listesi boş olamaz.' })
    }

    const district = await fetchDistrictWithProvince(districtId)
    if (!district) {
      return json(400, { error: 'Seçilen ilçe bulunamadı.' })
    }

    const lines = rowsText.split('\n').map((line) => line.trim()).filter(Boolean)
    if (lines.length > MAX_BULK_IMPORT_LINES) {
      return json(400, { error: `En fazla ${MAX_BULK_IMPORT_LINES} satır içe aktarabilirsiniz.` })
    }

    const validRows = []
    const errors = []
    lines.forEach((line, index) => {
      const parts = line.split(';').map((part) => part.trim())
      const [name, rawType] = parts
      const type = rawType?.toLocaleLowerCase('tr-TR')

      if (parts.length !== 2 || !name || name.length < 2 || !SCHOOL_TYPES.has(type)) {
        errors.push({ line: index + 1, reason: 'Beklenen biçim: Okul Adı;devlet veya Okul Adı;ozel' })
        return
      }

      validRows.push({ name, type })
    })

    let createdCount = 0
    let skippedCount = 0

    for (const row of validRows) {
      const requestDb = await withRequest({
        provinceId: { type: sql.UniqueIdentifier, value: district.province_id },
        districtId: { type: sql.UniqueIdentifier, value: district.id },
        name: { type: sql.NVarChar(200), value: row.name },
        schoolType: { type: sql.NVarChar(20), value: row.type },
      })
      const result = await requestDb.query(`
        INSERT INTO dbo.Schools (province_id, district_id, name, school_type)
        SELECT @provinceId, @districtId, @name, @schoolType
        WHERE NOT EXISTS (
          SELECT 1 FROM dbo.Schools WHERE district_id = @districtId AND name = @name
        );
      `)

      if (result.rowsAffected[0] > 0) {
        createdCount += 1
      } else {
        skippedCount += 1
      }
    }

    return json(200, { createdCount, skippedCount, errors })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('bulkImportSchoolsHandler failed', error)
    return json(500, { error: 'Okullar içe aktarılamadı.' })
  }
}

module.exports = {
  listSubjectsHandler,
  createSubjectHandler,
  listSubjectsForPanelHandler,
  listSubjectsForRegistrationHandler,
  listPublishersHandler,
  listPublishersForPanelHandler,
  createPublisherHandler,
  listResourceBooksHandler,
  listResourceBooksMissingAnswerKeyHandler,
  listResourceBooksForPanelHandler,
  createResourceBookHandler,
  updateResourceBookHandler,
  reviewResourceBookHandler,
  LIBRARY_GRADES,
  RESOURCE_BOOK_TYPES,
  fetchLibraryResourceBooks,
  fetchResourceBookById,
  listResourceBookTopicsHandler,
  createResourceBookTopicHandler,
  updateResourceBookTopicHandler,
  listResourceBookTopicsForPanelHandler,
  markResourceBookTopicTestCompletionHandler,
  unmarkResourceBookTopicTestCompletionHandler,
  submitManualOpticalAnswersHandler,
  saveManualWrongQuestionPhotoHandler,
  fetchResourceBookTopicsWithTests,
  fetchResourceBookStatsForStudent,
  listResourceBookTopicTestsHandler,
  createResourceBookTopicTestHandler,
  updateResourceBookTopicTestHandler,
  deleteResourceBookTopicTestHandler,
  listQuestionsForTestHandler,
  createQuestionHandler,
  listTestAnswerKeyHandler,
  setTestAnswerKeyHandler,
  listSchoolsForAdminHandler,
  createSchoolHandler,
  updateSchoolHandler,
  bulkImportSchoolsHandler,
}
