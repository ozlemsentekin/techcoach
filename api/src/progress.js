const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { json } = require('./http')
const { isSessionError } = require('./security')
const { requireStudentContext, requireStudentWriteContext } = require('./studentScope')

const MISTAKE_REASONS = ['dikkat-hatasi', 'bilgi-eksikligi']

function toISODate(value) {
  if (!value) return null
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10)
}

function sanitizeCheckIn(record) {
  if (!record) return null
  return {
    date: record.date instanceof Date ? record.date.toISOString().slice(0, 10) : record.date,
    energyLevel: record.energy_level,
    note: record.note || '',
  }
}

function sanitizeWrongQuestion(record) {
  return {
    id: record.id,
    studentId: record.student_id,
    taskId: record.task_id,
    testId: record.test_id || undefined,
    subject: record.subject,
    topic: record.topic || undefined,
    topicName: record.topic_name || undefined,
    testName: record.test_name || undefined,
    bookName: record.book_name || undefined,
    publisherName: record.publisher_name || undefined,
    questionNumber: record.question_number || undefined,
    pageStart: record.page_start ?? undefined,
    pageEnd: record.page_end ?? undefined,
    errorType: record.error_type,
    studentNote: record.student_note || undefined,
    mistakeReason: record.mistake_reason || undefined,
    reviewStatus: record.review_status,
    resolvedAt: record.resolved_at,
    // Liste uçları (listWrongQuestionsHandler vb.) her satırın base64 fotoğrafını çekmenin
    // çok pahalı olması nedeniyle sadece has_photo bayrağını seçer; tam photoUrl sadece tekil
    // fotoğraf uçlarından (getWrongQuestionPhotoHandler) veya foto kaydeden akışlardan gelir.
    hasPhoto: record.has_photo !== undefined ? Boolean(record.has_photo) : Boolean(record.photo_url),
    photoUrl: record.photo_url || undefined,
    bookImageUrl: record.book_image_url || undefined,
    createdAt: record.created_at,
  }
}

function sanitizeStudySession(record) {
  return {
    id: record.id,
    studentId: record.student_id,
    taskId: record.task_id,
    startedAt: record.started_at,
    endedAt: record.ended_at,
    durationMinutes: record.duration_minutes,
    completedQuestionCount: record.completed_question_count,
    correctCount: record.correct_count ?? undefined,
    wrongCount: record.wrong_count ?? undefined,
    blankCount: record.blank_count ?? undefined,
    difficultyRating: record.difficulty_rating || undefined,
    emotion: record.emotion || undefined,
    note: record.note || undefined,
    createdAt: record.created_at,
  }
}

function parseJson(value, fallback) {
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function sanitizeProgressResourceBook(record) {
  return {
    id: record.id,
    publisherId: record.publisher_id,
    publisherName: record.publisher_name || undefined,
    subjectId: record.subject_id || undefined,
    subjectName: record.subject_name || undefined,
    name: record.name,
    pageCount: record.page_count,
    type: record.resource_type,
    hasAnswerKey: record.has_answer_key === null || record.has_answer_key === undefined ? undefined : Boolean(record.has_answer_key),
  }
}

function sanitizeProgressTest(record) {
  return {
    id: record.id,
    resourceBookId: record.resource_book_id,
    topicName: record.topic_name || undefined,
    name: record.name,
    questionCount: record.question_count,
  }
}

function sanitizeProgressTask(record) {
  return {
    id: record.id,
    date: toISODate(record.date),
    title: record.title,
    taskType: record.task_type,
    homeworkId: record.homework_id || undefined,
    subject: record.subject || undefined,
    topic: record.topic || undefined,
    durationMinutes: record.duration_minutes,
    timerStartedAt: record.timer_started_at,
    timerStoppedAt: record.timer_stopped_at,
    timerElapsedSeconds: record.timer_elapsed_seconds ?? undefined,
    targetQuestionCount: record.target_question_count ?? undefined,
    completedQuestionCount: record.completed_question_count ?? undefined,
    targetPageCount: record.target_page_count ?? undefined,
    completedPageCount: record.completed_page_count ?? undefined,
    status: record.status,
    completedAt: record.completed_at,
    correctCount: record.correct_count ?? undefined,
    wrongCount: record.wrong_count ?? undefined,
    blankCount: record.blank_count ?? undefined,
    resourceBookId: record.resource_book_id || undefined,
    resourceBookName: record.resource_book_name || undefined,
    resourceType: record.resource_type || undefined,
    resourceBookImageUrl: record.image_url || undefined,
    publisherName: record.publisher_name || undefined,
    subjectId: record.resource_subject_id || undefined,
    subjectName: record.resource_subject_name || undefined,
    selectedTestIds: parseJson(record.selected_test_ids_json, []),
    testResults: parseJson(record.test_results_json, {}),
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

function sanitizeProgressSession(record) {
  return {
    ...sanitizeStudySession(record),
    taskDate: toISODate(record.task_date),
    taskTitle: record.task_title || undefined,
    taskType: record.task_type || undefined,
    homeworkId: record.homework_id || undefined,
    taskDurationMinutes: record.task_duration_minutes ?? undefined,
    subject: record.subject || undefined,
    topic: record.topic || undefined,
    resourceBookId: record.resource_book_id || undefined,
    resourceBookName: record.resource_book_name || undefined,
    resourceType: record.resource_type || undefined,
    resourceBookImageUrl: record.image_url || undefined,
    publisherName: record.publisher_name || undefined,
    subjectId: record.resource_subject_id || undefined,
    subjectName: record.resource_subject_name || undefined,
    selectedTestIds: parseJson(record.selected_test_ids_json, []),
    testResults: parseJson(record.test_results_json, {}),
  }
}

function sanitizeManualTestCompletion(record) {
  return {
    testId: record.test_id,
    testName: record.test_name || undefined,
    topicName: record.topic_name || undefined,
    questionCount: record.question_count,
    resourceBookId: record.resource_book_id,
    resourceBookName: record.resource_book_name || undefined,
    resourceType: record.resource_type || undefined,
    resourceBookImageUrl: record.image_url || undefined,
    publisherName: record.publisher_name || undefined,
    subjectId: record.subject_id || undefined,
    subjectName: record.subject_name || undefined,
    correctCount: record.correct_count ?? undefined,
    wrongCount: record.wrong_count ?? undefined,
    blankCount: record.blank_count ?? undefined,
    markedAt: record.marked_at,
  }
}

function sanitizeProgressHomework(record) {
  return {
    id: record.id,
    subjectId: record.subject_id || undefined,
    subject: record.subject_name,
    resourceBookId: record.resource_book_id || undefined,
    resourceBookName: record.resource_book_name || undefined,
    resourceType: record.resource_type || undefined,
    resourceBookImageUrl: record.image_url || undefined,
    publisherName: record.publisher_name || undefined,
    title: record.title,
    description: record.description || undefined,
    assignedDate: toISODate(record.assigned_date),
    dueDate: toISODate(record.due_date),
    totalQuestionCount: record.total_question_count,
    completedQuestionCount: record.completed_question_count,
    totalPageCount: record.total_page_count ?? undefined,
    status: record.status,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

async function getCheckInHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const date = request.query.get('date')
    if (!date) {
      return json(400, { error: 'Tarih zorunludur.' })
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      date: { type: sql.Date, value: date },
    })
    const result = await requestDb.query(`
      SELECT TOP 1 date, energy_level, note FROM dbo.CheckIns WHERE student_id = @studentId AND date = @date;
    `)

    return json(200, { checkIn: sanitizeCheckIn(result.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('getCheckInHandler failed', error)
    return json(500, { error: 'Check-in bilgisi yüklenemedi.' })
  }
}

async function saveCheckInHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentWriteContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

    const date = payload?.date
    const energyLevel = payload?.energyLevel
    const note = payload?.note || null

    if (!date || !energyLevel) {
      return json(400, { error: 'Tarih ve enerji seviyesi zorunludur.' })
    }

    const updateDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      date: { type: sql.Date, value: date },
      energyLevel: { type: sql.NVarChar(30), value: energyLevel },
      note: { type: sql.NVarChar(500), value: note },
    })
    const updateResult = await updateDb.query(`
      UPDATE dbo.CheckIns SET energy_level = @energyLevel, note = @note
      WHERE student_id = @studentId AND date = @date;
    `)

    if (!updateResult.rowsAffected[0]) {
      const insertDb = await withRequest({
        studentId: { type: sql.UniqueIdentifier, value: studentId },
        date: { type: sql.Date, value: date },
        energyLevel: { type: sql.NVarChar(30), value: energyLevel },
        note: { type: sql.NVarChar(500), value: note },
      })
      await insertDb.query(`
        INSERT INTO dbo.CheckIns (student_id, date, energy_level, note)
        VALUES (@studentId, @date, @energyLevel, @note);
      `)
    }

    return json(200, { checkIn: { date, energyLevel, note: note || '' } })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('saveCheckInHandler failed', error)
    return json(500, { error: 'Check-in kaydedilemedi.' })
  }
}

// Kapak fotoğrafları ResourceBooks.image_url'de base64 JPEG olarak saklanıyor (~140KB/kitap).
// listWrongQuestionsHandler'ın ana sorgusu bunu her yanlış-soru satırında tekrar seçseydi,
// aynı kitaptan onlarca sorusu olan bir öğrencide tek sayfa yüklemesi onlarca MB'a çıkıyordu
// (247 satır × 140KB ≈ 33MB — sayfanın "yükleniyor"da donmasının asıl nedeni buydu). Bunun
// yerine sadece farklı kitaplar için bir kez çekip book_name üzerinden JS'te eşliyoruz.
async function fetchWrongQuestionBookImagesByName(studentId, { resourceBookId } = {}) {
  const requestDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    ...(resourceBookId ? { resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId } } : {}),
  })
  const result = await requestDb.query(`
    SELECT DISTINCT rb.name AS book_name, rb.image_url AS book_image_url
    FROM dbo.WrongQuestions wq
    INNER JOIN dbo.ResourceBookTopicTests t ON t.id = wq.test_id
    INNER JOIN dbo.ResourceBookTopics tp ON tp.id = t.topic_id
    INNER JOIN dbo.ResourceBooks rb ON rb.id = tp.resource_book_id
    WHERE wq.student_id = @studentId AND wq.test_id IS NOT NULL AND rb.image_url IS NOT NULL
    ${resourceBookId ? 'AND tp.resource_book_id = @resourceBookId' : ''};
  `)
  return new Map(result.recordset.map((row) => [row.book_name, row.book_image_url]))
}

async function listWrongQuestionsHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    // Kaynak kitap ekranı (BookTopics) sadece o kitaptaki testler için fotoğraf durumunu
    // sorduğundan, öğrencinin tüm geçmişini çekmek yerine resourceBookId verildiğinde sorguyu
    // o kitapla sınırlıyoruz — büyük hata defterlerinde bu ekranın yavaş açılmasını önler.
    const resourceBookId = request.query.get('resourceBookId')

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      ...(resourceBookId ? { resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId } } : {}),
    })
    // topic/book_name/publisher_name kolonları o anki değerin bir anlık görüntüsü (kaydedildiği
    // ana ait): kaynağın içerik ağacı sonradan yeniden düzenlenirse (ör. testler farklı bir
    // ünitede toplanırsa) eski kayıt bayatlar. Bu yüzden test_id üzerinden katalogdaki güncel
    // konu/kitap/yayın evi adına öncelik veriyoruz; test_id'siz eski manuel kayıtlarda tabloya
    // kaydedilmiş metne geri düşülür.
    const [result, bookImageByName] = await Promise.all([
      requestDb.query(`
        SELECT wq.id, wq.student_id, wq.task_id, wq.test_id, wq.subject, wq.test_name,
               wq.question_number, wq.error_type, wq.student_note, wq.mistake_reason,
               wq.review_status, wq.resolved_at,
               CAST(1 AS bit) AS has_photo, wq.created_at,
               COALESCE(tp.name, wq.topic) AS topic,
               COALESCE(rb.name, wq.book_name) AS book_name,
               COALESCE(pub.name, wq.publisher_name) AS publisher_name,
               t.topic_name, t.page_start, t.page_end
        FROM dbo.WrongQuestions wq
        LEFT JOIN dbo.ResourceBookTopicTests t ON t.id = wq.test_id
        LEFT JOIN dbo.ResourceBookTopics tp ON tp.id = t.topic_id
        LEFT JOIN dbo.ResourceBooks rb ON rb.id = tp.resource_book_id
        LEFT JOIN dbo.Publishers pub ON pub.id = rb.publisher_id
        WHERE wq.student_id = @studentId AND wq.test_id IS NOT NULL
        ${resourceBookId ? 'AND tp.resource_book_id = @resourceBookId' : ''}
        ORDER BY wq.created_at DESC;
      `),
      fetchWrongQuestionBookImagesByName(studentId, { resourceBookId }),
    ])

    // bookImageUrl'i her satırda tekrar tekrar döndürmek yerine (bkz. yukarıdaki
    // fetchWrongQuestionBookImagesByName yorumu) ayrı, kitap başına tek girişli bir harita
    // olarak gönderiyoruz; istemci bunu book_name ile eşleyip sadece görüntülerken kullanır.
    return json(200, {
      wrongQuestions: result.recordset.map(sanitizeWrongQuestion),
      bookImages: Object.fromEntries(bookImageByName),
    })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('listWrongQuestionsHandler failed', error)
    return json(500, { error: 'Yanlış sorular yüklenemedi.' })
  }
}

// Tek bir yanlış sorunun base64 fotoğrafını getirir. listWrongQuestionsHandler'ın aksine
// (o sadece has_photo bayrağı döner, bkz. yukarısı) galeri sadece o an gösterilen fotoğrafı
// bu uçtan tembel (lazy) çeker — onlarca fotoğrafı tek istekte çekmenin getirdiği yavaşlığı önler.
async function getWrongQuestionPhotoHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const wrongQuestionId = request.params.wrongQuestionId
    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: wrongQuestionId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const result = await requestDb.query(`
      SELECT photo_url FROM dbo.WrongQuestions WHERE id = @id AND student_id = @studentId;
    `)

    const photoUrl = result.recordset[0]?.photo_url
    if (!photoUrl) {
      return json(404, { error: 'Fotoğraf bulunamadı.' })
    }

    return json(200, { photoUrl })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('getWrongQuestionPhotoHandler failed', error)
    return json(500, { error: 'Fotoğraf yüklenemedi.' })
  }
}

async function addWrongQuestionHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentWriteContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

    const subject = payload?.subject?.trim()
    const errorType = payload?.errorType

    if (!subject) {
      return json(400, { error: 'Ders zorunludur.' })
    }
    if (!errorType) {
      return json(400, { error: 'Hata türü zorunludur.' })
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      taskId: { type: sql.UniqueIdentifier, value: payload?.taskId || null },
      subject: { type: sql.NVarChar(100), value: subject },
      topic: { type: sql.NVarChar(200), value: payload?.topic || null },
      questionNumber: { type: sql.NVarChar(20), value: payload?.questionNumber || null },
      errorType: { type: sql.NVarChar(50), value: errorType },
      studentNote: { type: sql.NVarChar(1000), value: payload?.studentNote || null },
    })
    const result = await requestDb.query(`
      INSERT INTO dbo.WrongQuestions (student_id, task_id, subject, topic, question_number, error_type, student_note)
      OUTPUT inserted.id, inserted.student_id, inserted.task_id, inserted.subject, inserted.topic, inserted.question_number,
             inserted.error_type, inserted.student_note, inserted.review_status, inserted.resolved_at, inserted.created_at
      VALUES (@studentId, @taskId, @subject, @topic, @questionNumber, @errorType, @studentNote);
    `)

    return json(201, { wrongQuestion: sanitizeWrongQuestion(result.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('addWrongQuestionHandler failed', error)
    return json(500, { error: 'Yanlış kaydı eklenemedi.' })
  }
}

async function updateWrongQuestionHandler(request) {
  try {
    const wrongQuestionId = request.params.wrongQuestionId
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentWriteContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

    const setClauses = []
    const bindings = {
      id: { type: sql.UniqueIdentifier, value: wrongQuestionId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    }

    if (payload?.reviewStatus !== undefined) {
      setClauses.push('review_status = @reviewStatus')
      bindings.reviewStatus = { type: sql.NVarChar(30), value: payload.reviewStatus }
    }
    if (payload?.resolvedAt !== undefined) {
      setClauses.push('resolved_at = @resolvedAt')
      bindings.resolvedAt = { type: sql.DateTime2, value: payload.resolvedAt }
    }
    if (payload?.studentNote !== undefined) {
      setClauses.push('student_note = @studentNote')
      bindings.studentNote = { type: sql.NVarChar(1000), value: payload.studentNote || null }
    }
    if (payload?.mistakeReason !== undefined) {
      if (!MISTAKE_REASONS.includes(payload.mistakeReason)) {
        return json(400, { error: 'Geçersiz hata nedeni.' })
      }
      setClauses.push('mistake_reason = @mistakeReason')
      bindings.mistakeReason = { type: sql.NVarChar(30), value: payload.mistakeReason }
    }

    if (setClauses.length === 0) {
      return json(400, { error: 'Güncellenecek alan bulunamadı.' })
    }

    const requestDb = await withRequest(bindings)
    const result = await requestDb.query(`
      UPDATE dbo.WrongQuestions SET ${setClauses.join(', ')} WHERE id = @id AND student_id = @studentId;
    `)

    if (!result.rowsAffected[0]) {
      return json(404, { error: 'Kayıt bulunamadı.' })
    }

    const fetchDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: wrongQuestionId } })
    const fetchResult = await fetchDb.query(`
      SELECT id, student_id, task_id, subject, topic, question_number, error_type, student_note, mistake_reason,
             review_status, resolved_at, created_at
      FROM dbo.WrongQuestions WHERE id = @id;
    `)

    return json(200, { wrongQuestion: sanitizeWrongQuestion(fetchResult.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('updateWrongQuestionHandler failed', error)
    return json(500, { error: 'Kayıt güncellenemedi.' })
  }
}

function topicStatsKey(subject, topic) {
  return `${(subject || '').trim()}::${(topic || '').trim()}`
}

function normalizeTopicStatKeys(topicKeys) {
  const normalized = []
  const seen = new Set()

  topicKeys.forEach(({ subject, topic }) => {
    const entry = {
      subject: (subject || '').trim(),
      topic: (topic || '').trim() || null,
    }
    const key = topicStatsKey(entry.subject, entry.topic)
    if (seen.has(key)) return
    seen.add(key)
    normalized.push(entry)
  })

  return normalized
}

// Bir öğrencinin fotoğraflı yanlışlarını içerik (konu) bazında kart olarak göstermek için,
// aynı konudaki TÜM atanmış kaynaklardan (farklı kitap/yayınevi) toplam çözülen soru sayısını ve
// başarı oranını hesaplar (topicStats — "İçerik Grubuna Göre" sekmesi için). Aynı geçişte, her
// (ders, konu, kitap) üçlüsü için de ayrı bir kırılım hesaplar (sourceTopicStats — "Kaynağa Göre"
// sekmesinde bir kaynağa girildiğinde, başarı oranının sadece o kaynaktaki sorulara göre
// gösterilmesi için). catalog.js'deki computeResourceBookStats ile aynı JSON-birleştirme
// mantığını kullanır, ama kitap yerine (ders, konu) çiftine göre gruplar.
// teacherId verildiğinde (öğretmen panelinden çağrıldığında) testler ayrıca o öğretmene atanmış
// kaynaklarla sınırlanır (bkz. teacher.js'deki getTeacherStudentProgressOverviewHandler'daki aynı kısıtlama).
async function computeWrongQuestionTopicStats(studentId, topicKeys, { teacherId } = {}) {
  const normalizedTopicKeys = normalizeTopicStatKeys(topicKeys)
  if (!normalizedTopicKeys.length) return { topicStats: [], sourceTopicStats: [] }

  const statsDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    topicKeysJson: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(normalizedTopicKeys) },
    ...(teacherId ? { teacherId: { type: sql.UniqueIdentifier, value: teacherId } } : {}),
  })
  const statsResult = await statsDb.query(`
    WITH WantedTopics AS (
      SELECT DISTINCT
             LTRIM(RTRIM(COALESCE(JSON_VALUE([value], '$.subject'), N''))) AS subject_name,
             LTRIM(RTRIM(COALESCE(JSON_VALUE([value], '$.topic'), N''))) AS topic_name
      FROM OPENJSON(@topicKeysJson)
    ),
    WantedTests AS (
      SELECT DISTINCT tt.id AS test_id,
             LTRIM(RTRIM(COALESCE(s.name, N''))) AS subject_name,
             LTRIM(RTRIM(COALESCE(tt.topic_name, rbt.name, N''))) AS topic_name,
             rb.name AS book_name
      FROM dbo.ResourceBookTopicTests tt
      INNER JOIN dbo.ResourceBookTopics rbt ON rbt.id = tt.topic_id
      INNER JOIN dbo.ResourceBooks rb ON rb.id = rbt.resource_book_id
      INNER JOIN dbo.StudentResourceBooks srb ON srb.resource_book_id = rb.id AND srb.student_id = @studentId
      LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
      ${teacherId ? 'INNER JOIN dbo.StudentTeacherResourceBooks strb ON strb.teacher_id = @teacherId AND strb.resource_book_id = rb.id' : ''}
      INNER JOIN WantedTopics wt
        ON wt.subject_name = LTRIM(RTRIM(COALESCE(s.name, N'')))
       AND wt.topic_name = LTRIM(RTRIM(COALESCE(tt.topic_name, rbt.name, N'')))
      WHERE rb.is_active = 1
    ),
    DigitalCandidates AS (
      SELECT wt.test_id, wt.subject_name, wt.topic_name, wt.book_name,
             parsed.correct_count, parsed.wrong_count, parsed.blank_count, parsed.graded_at,
             ROW_NUMBER() OVER (
               PARTITION BY wt.test_id
               ORDER BY
                 CASE WHEN parsed.graded_at IS NULL THEN 1 ELSE 0 END,
                 parsed.graded_at DESC,
                 t.updated_at DESC,
                 t.created_at DESC
             ) AS result_rank
      FROM dbo.Tasks t
      CROSS APPLY OPENJSON(CASE WHEN ISJSON(t.test_results_json) = 1 THEN t.test_results_json ELSE N'{}' END) AS result_json
      INNER JOIN WantedTests wt ON CONVERT(NVARCHAR(36), wt.test_id) = result_json.[key]
      CROSS APPLY (
        SELECT TRY_CONVERT(INT, JSON_VALUE(result_json.[value], '$.correct')) AS correct_count,
               TRY_CONVERT(INT, JSON_VALUE(result_json.[value], '$.wrong')) AS wrong_count,
               TRY_CONVERT(INT, JSON_VALUE(result_json.[value], '$.blank')) AS blank_count,
               JSON_VALUE(result_json.[value], '$.gradedAt') AS graded_at
      ) parsed
      WHERE t.student_id = @studentId AND t.test_results_json IS NOT NULL
    ),
    DigitalResults AS (
      SELECT test_id, subject_name, topic_name, book_name, correct_count, wrong_count, blank_count
      FROM DigitalCandidates
      WHERE result_rank = 1
    ),
    ManualResults AS (
      SELECT wt.test_id, wt.subject_name, wt.topic_name, wt.book_name,
             smtc.correct_count, smtc.wrong_count, smtc.blank_count
      FROM dbo.StudentManualTestCompletions smtc
      INNER JOIN WantedTests wt ON wt.test_id = smtc.test_id
      WHERE smtc.student_id = @studentId
        AND (smtc.correct_count IS NOT NULL OR smtc.wrong_count IS NOT NULL OR smtc.blank_count IS NOT NULL)
    ),
    RankedResults AS (
      SELECT test_id, subject_name, topic_name, book_name, correct_count, wrong_count, blank_count,
             ROW_NUMBER() OVER (PARTITION BY test_id ORDER BY source_priority DESC) AS source_rank
      FROM (
        SELECT test_id, subject_name, topic_name, book_name, correct_count, wrong_count, blank_count, 0 AS source_priority
        FROM DigitalResults
        UNION ALL
        SELECT test_id, subject_name, topic_name, book_name, correct_count, wrong_count, blank_count, 1 AS source_priority
        FROM ManualResults
      ) all_results
    ),
    ChosenResults AS (
      SELECT subject_name, topic_name, book_name,
             COALESCE(correct_count, 0) AS correct_count,
             COALESCE(wrong_count, 0) AS wrong_count,
             COALESCE(blank_count, 0) AS blank_count
      FROM RankedResults
      WHERE source_rank = 1
    )
    SELECT subject_name, topic_name, book_name,
           SUM(correct_count) AS correct_count,
           SUM(wrong_count) AS wrong_count,
           SUM(blank_count) AS blank_count
    FROM ChosenResults
    GROUP BY subject_name, topic_name, book_name;
  `)

  const totals = new Map()
  const sourceTopicStats = statsResult.recordset.map((row) => {
    const correct = Number(row.correct_count) || 0
    const wrong = Number(row.wrong_count) || 0
    const blank = Number(row.blank_count) || 0
    const topicKey = topicStatsKey(row.subject_name, row.topic_name)

    if (!totals.has(topicKey)) {
      totals.set(topicKey, { correct: 0, wrong: 0, blank: 0 })
    }
    const topicEntry = totals.get(topicKey)
    topicEntry.correct += correct
    topicEntry.wrong += wrong
    topicEntry.blank += blank

    const totalAnswered = correct + wrong + blank
    return {
      subject: row.subject_name,
      topic: row.topic_name || null,
      bookName: row.book_name || null,
      totalAnswered,
      successRate: totalAnswered > 0 ? correct / totalAnswered : null,
    }
  })

  const topicStats = normalizedTopicKeys.map(({ subject, topic }) => {
    const entry = totals.get(topicStatsKey(subject, topic))
    const totalAnswered = entry ? entry.correct + entry.wrong + entry.blank : 0
    return {
      subject,
      topic,
      totalAnswered,
      successRate: entry && totalAnswered > 0 ? entry.correct / totalAnswered : null,
    }
  })

  return { topicStats, sourceTopicStats }
}

async function getWrongQuestionTopicStatsHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    // computeWrongQuestionTopicStats, katalogdaki güncel konu adlarına göre eşleştirme yapıyor
    // (bkz. aşağıdaki fonksiyon yorumu); bu yüzden anahtar kümesi de wq.topic yerine aynı
    // COALESCE(tp.name, wq.topic) canlı adına göre çıkarılmalı, yoksa listWrongQuestionsHandler'ın
    // gösterdiği (canlı) konu adıyla burada üretilen istatistik anahtarı eşleşmez.
    const requestDb = await withRequest({ studentId: { type: sql.UniqueIdentifier, value: studentId } })
    const result = await requestDb.query(`
      SELECT DISTINCT wq.subject, COALESCE(tp.name, wq.topic) AS topic
      FROM dbo.WrongQuestions wq
      LEFT JOIN dbo.ResourceBookTopicTests t ON t.id = wq.test_id
      LEFT JOIN dbo.ResourceBookTopics tp ON tp.id = t.topic_id
      WHERE wq.student_id = @studentId AND wq.test_id IS NOT NULL;
    `)

    const { topicStats, sourceTopicStats } = await computeWrongQuestionTopicStats(studentId, result.recordset)
    return json(200, { topicStats, sourceTopicStats })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('getWrongQuestionTopicStatsHandler failed', error)
    return json(500, { error: 'İçerik istatistikleri yüklenemedi.' })
  }
}

async function listStudySessionsHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const result = await requestDb.query(`
      SELECT id, student_id, task_id, started_at, ended_at, duration_minutes, completed_question_count,
             correct_count, wrong_count, blank_count, difficulty_rating, emotion, note, created_at
      FROM dbo.StudySessions
      WHERE student_id = @studentId
      ORDER BY started_at DESC;
    `)

    return json(200, { sessions: result.recordset.map(sanitizeStudySession) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('listStudySessionsHandler failed', error)
    return json(500, { error: 'Çalışma oturumları yüklenemedi.' })
  }
}

// tasks/sessions/homeworks/manualTestCompletions'ın her biri aynı kitaba defalarca (öğrencinin
// o kitaptan yaptığı her görev/oturum için bir kez) referans verebilir. rb.image_url'i (kapak
// fotoğrafı, ~140KB base64) bu dört sorgunun her satırında tekrar seçmek — ve sanitize edilmiş
// nesnelere tekrar tekrar gömmek — WrongQuestions listesinde yaşanan aynı N-kat büyüme sorununu
// yaratır (bkz. fetchWrongQuestionBookImagesByName). Bunun yerine dört sonuç kümesi çözüldükten
// sonra sadece gerçekten referans verilen kitapların kimliklerini toplayıp tek bir sorguda,
// kitap başına bir kez çekiyoruz.
async function fetchResourceBookImagesByIds(resourceBookIds) {
  const ids = Array.from(new Set(resourceBookIds.filter(Boolean)))
  if (!ids.length) return new Map()

  const requestDb = await withRequest({ idsJson: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(ids) } })
  const result = await requestDb.query(`
    SELECT rb.id AS resource_book_id, rb.image_url AS book_image_url
    FROM dbo.ResourceBooks rb
    INNER JOIN OPENJSON(@idsJson) ids ON ids.value = CONVERT(NVARCHAR(36), rb.id)
    WHERE rb.image_url IS NOT NULL;
  `)
  return new Map(result.recordset.map((row) => [row.resource_book_id, row.book_image_url]))
}

async function getProgressOverviewHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const bindings = {
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    }

    const [
      resourceBooksResult,
      testsResult,
      tasksResult,
      sessionsResult,
      homeworksResult,
      wrongQuestionsResult,
      manualTestCompletionsResult,
    ] = await Promise.all([
      withRequest(bindings).then((requestDb) =>
        requestDb.query(`
          SELECT rb.id, rb.publisher_id, p.name AS publisher_name, rb.subject_id, s.name AS subject_name,
                 rb.name, rb.page_count, rb.resource_type, rb.has_answer_key
          FROM dbo.StudentResourceBooks srb
          INNER JOIN dbo.ResourceBooks rb ON rb.id = srb.resource_book_id
          LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
          LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
          WHERE srb.student_id = @studentId AND rb.is_active = 1
          ORDER BY s.name ASC, rb.name ASC;
        `),
      ),
      withRequest(bindings).then((requestDb) =>
        requestDb.query(`
          SELECT tt.id, rbt.resource_book_id, COALESCE(tt.topic_name, rbt.name) AS topic_name,
                 tt.name, tt.question_count
          FROM dbo.StudentResourceBooks srb
          INNER JOIN dbo.ResourceBookTopics rbt ON rbt.resource_book_id = srb.resource_book_id
          INNER JOIN dbo.ResourceBookTopicTests tt ON tt.topic_id = rbt.id
          WHERE srb.student_id = @studentId
          ORDER BY rbt.created_at ASC, tt.created_at ASC;
        `),
      ),
      withRequest(bindings).then((requestDb) =>
        requestDb.query(`
          SELECT t.id, t.date, t.title, t.task_type, t.homework_id, t.subject, t.topic,
                 t.duration_minutes, t.target_question_count, t.completed_question_count,
                 t.timer_started_at, t.timer_stopped_at, t.timer_elapsed_seconds,
                 t.target_page_count, t.completed_page_count, t.status, t.completed_at,
                 t.correct_count, t.wrong_count, t.blank_count, t.resource_book_id,
                 t.selected_test_ids_json, t.test_results_json, rb.name AS resource_book_name,
                 rb.resource_type, p.name AS publisher_name, rb.subject_id AS resource_subject_id,
                 s.name AS resource_subject_name, t.created_at, t.updated_at
          FROM dbo.Tasks t
          LEFT JOIN dbo.ResourceBooks rb ON rb.id = t.resource_book_id
          LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
          LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
          WHERE t.student_id = @studentId AND t.is_draft = 0
          ORDER BY t.date DESC, t.start_time ASC;
        `),
      ),
      withRequest(bindings).then((requestDb) =>
        requestDb.query(`
          SELECT ss.id, ss.student_id, ss.task_id, ss.started_at, ss.ended_at, ss.duration_minutes,
                 ss.completed_question_count, ss.correct_count, ss.wrong_count, ss.blank_count,
                 ss.difficulty_rating, ss.emotion, ss.note, ss.created_at, t.date AS task_date,
                 t.title AS task_title, t.task_type, t.homework_id, t.duration_minutes AS task_duration_minutes,
                 t.subject, t.topic, t.resource_book_id,
                 t.selected_test_ids_json, t.test_results_json, rb.name AS resource_book_name,
                 rb.resource_type, p.name AS publisher_name, rb.subject_id AS resource_subject_id,
                 s.name AS resource_subject_name
          FROM dbo.StudySessions ss
          LEFT JOIN dbo.Tasks t ON t.id = ss.task_id
          LEFT JOIN dbo.ResourceBooks rb ON rb.id = t.resource_book_id
          LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
          LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
          WHERE ss.student_id = @studentId
          ORDER BY ss.started_at DESC;
        `),
      ),
      withRequest(bindings).then((requestDb) =>
        requestDb.query(`
          SELECT h.id, h.subject_id, s.name AS subject_name, h.resource_book_id,
                 rb.name AS resource_book_name, rb.resource_type, p.name AS publisher_name,
                 h.title, h.description, h.assigned_date, h.due_date,
                 h.total_question_count, h.completed_question_count, h.total_page_count,
                 h.status, h.created_at, h.updated_at
          FROM dbo.Homeworks h
          INNER JOIN dbo.Subjects s ON s.id = h.subject_id
          LEFT JOIN dbo.ResourceBooks rb ON rb.id = h.resource_book_id
          LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
          WHERE h.student_id = @studentId
          ORDER BY h.due_date DESC;
        `),
      ),
      withRequest(bindings).then((requestDb) =>
        requestDb.query(`
          SELECT id, student_id, task_id, subject, topic, question_number, error_type, student_note,
                 review_status, resolved_at, created_at
          FROM dbo.WrongQuestions
          WHERE student_id = @studentId
          ORDER BY created_at DESC;
        `),
      ),
      withRequest(bindings).then((requestDb) =>
        requestDb.query(`
          SELECT smtc.test_id, smtc.correct_count, smtc.wrong_count, smtc.blank_count, smtc.marked_at,
                 tt.name AS test_name, COALESCE(tt.topic_name, rbt.name) AS topic_name, tt.question_count,
                 rb.id AS resource_book_id, rb.name AS resource_book_name, rb.resource_type,
                 p.name AS publisher_name, rb.subject_id, s.name AS subject_name
          FROM dbo.StudentManualTestCompletions smtc
          INNER JOIN dbo.ResourceBookTopicTests tt ON tt.id = smtc.test_id
          INNER JOIN dbo.ResourceBookTopics rbt ON rbt.id = tt.topic_id
          INNER JOIN dbo.ResourceBooks rb ON rb.id = rbt.resource_book_id
          LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
          LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
          WHERE smtc.student_id = @studentId
            AND (smtc.correct_count IS NOT NULL OR smtc.wrong_count IS NOT NULL OR smtc.blank_count IS NOT NULL);
        `),
      ),
    ])

    const resourceBookImages = await fetchResourceBookImagesByIds([
      ...tasksResult.recordset.map((r) => r.resource_book_id),
      ...sessionsResult.recordset.map((r) => r.resource_book_id),
      ...homeworksResult.recordset.map((r) => r.resource_book_id),
      ...manualTestCompletionsResult.recordset.map((r) => r.resource_book_id),
    ])

    return json(200, {
      resourceBooks: resourceBooksResult.recordset.map(sanitizeProgressResourceBook),
      tests: testsResult.recordset.map(sanitizeProgressTest),
      tasks: tasksResult.recordset.map(sanitizeProgressTask),
      sessions: sessionsResult.recordset.map(sanitizeProgressSession),
      homeworks: homeworksResult.recordset.map(sanitizeProgressHomework),
      wrongQuestions: wrongQuestionsResult.recordset.map(sanitizeWrongQuestion),
      manualTestCompletions: manualTestCompletionsResult.recordset.map(sanitizeManualTestCompletion),
      resourceBookImages: Object.fromEntries(resourceBookImages),
    })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('getProgressOverviewHandler failed', error)
    return json(500, { error: 'Gelişim verileri yüklenemedi.' })
  }
}

async function addStudySessionHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentWriteContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

    if (!payload?.startedAt || !payload?.endedAt) {
      return json(400, { error: 'Başlangıç ve bitiş zamanı zorunludur.' })
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      taskId: { type: sql.UniqueIdentifier, value: payload?.taskId || null },
      startedAt: { type: sql.DateTime2, value: payload.startedAt },
      endedAt: { type: sql.DateTime2, value: payload.endedAt },
      durationMinutes: { type: sql.Int, value: Number(payload?.durationMinutes) || 0 },
      completedQuestionCount: { type: sql.Int, value: Number(payload?.completedQuestionCount) || 0 },
      correctCount: { type: sql.Int, value: payload?.correctCount ?? null },
      wrongCount: { type: sql.Int, value: payload?.wrongCount ?? null },
      blankCount: { type: sql.Int, value: payload?.blankCount ?? null },
      difficultyRating: { type: sql.NVarChar(30), value: payload?.difficultyRating || null },
      emotion: { type: sql.NVarChar(30), value: payload?.emotion || null },
      note: { type: sql.NVarChar(1000), value: payload?.note || null },
    })
    const result = await requestDb.query(`
      INSERT INTO dbo.StudySessions (
        student_id, task_id, started_at, ended_at, duration_minutes, completed_question_count,
        correct_count, wrong_count, blank_count, difficulty_rating, emotion, note
      )
      OUTPUT inserted.id, inserted.student_id, inserted.task_id, inserted.started_at, inserted.ended_at,
             inserted.duration_minutes, inserted.completed_question_count, inserted.correct_count, inserted.wrong_count,
             inserted.blank_count, inserted.difficulty_rating, inserted.emotion, inserted.note, inserted.created_at
      VALUES (
        @studentId, @taskId, @startedAt, @endedAt, @durationMinutes, @completedQuestionCount,
        @correctCount, @wrongCount, @blankCount, @difficultyRating, @emotion, @note
      );
    `)

    return json(201, { session: sanitizeStudySession(result.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('addStudySessionHandler failed', error)
    return json(500, { error: 'Çalışma oturumu kaydedilemedi.' })
  }
}

async function getSmallGoalHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: studentId },
    })
    const result = await requestDb.query(`
      SELECT small_goal FROM dbo.Users WHERE id = @id;
    `)

    return json(200, { smallGoal: result.recordset[0]?.small_goal || '' })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('getSmallGoalHandler failed', error)
    return json(500, { error: 'Küçük hedef yüklenemedi.' })
  }
}

async function setSmallGoalHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentWriteContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

    const smallGoal = payload?.smallGoal || null

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: studentId },
      smallGoal: { type: sql.NVarChar(500), value: smallGoal },
    })
    await requestDb.query(`
      UPDATE dbo.Users SET small_goal = @smallGoal WHERE id = @id;
    `)

    return json(200, { smallGoal: smallGoal || '' })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('setSmallGoalHandler failed', error)
    return json(500, { error: 'Hedef kaydedilemedi.' })
  }
}

module.exports = {
  getCheckInHandler,
  saveCheckInHandler,
  listWrongQuestionsHandler,
  fetchWrongQuestionBookImagesByName,
  getWrongQuestionPhotoHandler,
  addWrongQuestionHandler,
  updateWrongQuestionHandler,
  getWrongQuestionTopicStatsHandler,
  computeWrongQuestionTopicStats,
  MISTAKE_REASONS,
  listStudySessionsHandler,
  addStudySessionHandler,
  getProgressOverviewHandler,
  fetchResourceBookImagesByIds,
  getSmallGoalHandler,
  setSmallGoalHandler,
  sanitizeProgressResourceBook,
  sanitizeProgressTest,
  sanitizeProgressTask,
  sanitizeProgressSession,
  sanitizeProgressHomework,
  sanitizeWrongQuestion,
  sanitizeManualTestCompletion,
}
