const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { json } = require('./http')
const { isSessionError } = require('./security')
const { requireStudentContext, requireStudentWriteContext } = require('./studentScope')
const { sanitizeMistakePhoto, WRONG_QUESTION_OUTPUT_COLUMNS } = require('./mistakePhoto')

const MISTAKE_REASONS = ['dikkat-hatasi', 'bilgi-eksikligi', 'soruyu-anlamadim']

// Hata Defteri analiz akışı: her yanlış soruya öğrenci, veli ve öğretmen istediği kadar yorum
// bırakabilir (append-only thread — bkz. dbo.WrongQuestionAnalyses /
// wrong-question-analyses-thread-schema.sql). 'ebeveyn' studentScope.actorRole ile aynı
// yazımdır (veli); 'koc' ayrı bir rol olarak ele alınmaz.
const ANALYSIS_ROLES = ['ogrenci', 'ebeveyn', 'ogretmen']

function mapAnalysisRows(rows) {
  const map = new Map()
  rows.forEach((row) => {
    if (!ANALYSIS_ROLES.includes(row.role)) return
    const list = map.get(row.wrong_question_id) || []
    list.push({
      id: row.id,
      role: row.role,
      mistakeReason: row.mistake_reason || undefined,
      note: row.note || undefined,
      analyzedByName: row.analyzed_by_name || undefined,
      createdAt: row.created_at,
    })
    map.set(row.wrong_question_id, list)
  })
  return map
}

// Verilen öğrencinin tüm yanlış sorularına ait analiz yorumlarını tek sorguda çekip
// wrong_question_id -> [{ id, role, mistakeReason, note, analyzedByName, createdAt }, ...]
// haritasına dönüştürür (eskiden en yeniye). subject verilirse (öğretmen ucu) sadece o derse ait
// yanlışların yorumları döner.
async function fetchWrongQuestionAnalyses(studentId, { subject } = {}) {
  const requestDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    ...(subject ? { subject: { type: sql.NVarChar(100), value: subject } } : {}),
  })
  const result = await requestDb.query(`
    SELECT a.id, a.wrong_question_id, a.role, a.mistake_reason, a.note, a.created_at,
           u.full_name AS analyzed_by_name
    FROM dbo.WrongQuestionAnalyses a
    LEFT JOIN dbo.Users u ON u.id = a.analyzed_by_user_id
    WHERE a.wrong_question_id IN (
      SELECT id FROM dbo.WrongQuestions
      WHERE student_id = @studentId ${subject ? 'AND subject = @subject' : ''}
    )
    ORDER BY a.created_at ASC;
  `)
  return mapAnalysisRows(result.recordset)
}

// Öğretmenin çapraz-öğrenci listelerinde (bkz. teacher.js listTeacherWrongQuestionAnalysisPhotosHandler)
// tek bir studentId'ye bağlı kalamadığımız için, verilen wrong_question_id kümesine ait tüm analiz
// yorumlarını tek sorguda çeker. IN listesi güvenli şekilde parametreleştirilir.
async function fetchAnalysesByQuestionIds(wrongQuestionIds) {
  if (!wrongQuestionIds.length) return new Map()
  const bindings = {}
  const placeholders = wrongQuestionIds.map((id, index) => {
    const key = `qid${index}`
    bindings[key] = { type: sql.UniqueIdentifier, value: id }
    return `@${key}`
  })
  const requestDb = await withRequest(bindings)
  const result = await requestDb.query(`
    SELECT a.id, a.wrong_question_id, a.role, a.mistake_reason, a.note, a.created_at,
           u.full_name AS analyzed_by_name
    FROM dbo.WrongQuestionAnalyses a
    LEFT JOIN dbo.Users u ON u.id = a.analyzed_by_user_id
    WHERE a.wrong_question_id IN (${placeholders.join(', ')})
    ORDER BY a.created_at ASC;
  `)
  return mapAnalysisRows(result.recordset)
}

// Bir yanlış soruya YENİ bir analiz yorumu ekler (artık rol başına tek satır değil — her çağrı bir
// satır ekler, bkz. yukarıdaki dosya başı yorumu). mistakeReason verilmişse çağıran katman
// MISTAKE_REASONS ile doğrulamalıdır. Eklenen yorumu (analyzedByName dahil) döner.
async function addWrongQuestionAnalysisComment(wrongQuestionId, role, { mistakeReason, note }, analyzedByUserId) {
  const requestDb = await withRequest({
    wrongQuestionId: { type: sql.UniqueIdentifier, value: wrongQuestionId },
    role: { type: sql.NVarChar(20), value: role },
    mistakeReason: { type: sql.NVarChar(30), value: mistakeReason || null },
    note: { type: sql.NVarChar(1000), value: note || null },
    analyzedByUserId: { type: sql.UniqueIdentifier, value: analyzedByUserId || null },
  })
  const result = await requestDb.query(`
    INSERT INTO dbo.WrongQuestionAnalyses (wrong_question_id, role, mistake_reason, note, analyzed_by_user_id)
    OUTPUT inserted.id, inserted.role, inserted.mistake_reason, inserted.note, inserted.created_at
    VALUES (@wrongQuestionId, @role, @mistakeReason, @note, @analyzedByUserId);
  `)
  const inserted = result.recordset[0]

  let authorName
  if (analyzedByUserId) {
    const userDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: analyzedByUserId } })
    const userResult = await userDb.query(`SELECT full_name FROM dbo.Users WHERE id = @id;`)
    authorName = userResult.recordset[0]?.full_name || undefined
  }

  return {
    id: inserted.id,
    role: inserted.role,
    mistakeReason: inserted.mistake_reason || undefined,
    note: inserted.note || undefined,
    analyzedByName: authorName,
    createdAt: inserted.created_at,
  }
}

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
    resourceBookId: record.resource_book_id || undefined,
    subject: record.subject,
    topic: record.topic || undefined,
    topicName: record.topic_name || undefined,
    testName: record.test_name || undefined,
    correctAnswer: record.correct_answer ? String(record.correct_answer).trim() : undefined,
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
    // "Hata Analiz" görselleri (yalnızca veli ekler/kaldırır, herkes görüntüler; birden fazla
    // olabilir) — aynı tembel çekim deseni: liste uçları sadece sayı/bayrak taşır, görsellerin
    // kendisi listWrongQuestionAnalysisPhotoRecordsHandler'dan gelir (bkz. yukarısındaki
    // hasPhoto/photoUrl yorumu).
    hasAnalysisPhoto: Boolean(record.analysis_photo_count),
    analysisPhotoCount: record.analysis_photo_count ?? undefined,
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

const PROGRESS_HOMEWORK_TASK_TYPES = new Set(['odev', 'soru-bankasi-odevi', 'okul-odevi', 'etkinlik-odevi'])

function sanitizeProgressTask(record) {
  return {
    id: record.id,
    date: toISODate(record.date),
    title: record.title,
    taskType: record.task_type,
    // Ödev/görev tekilleştirme: ödev-tipi görev kendi başına bir "ödev"; bağlı eski Homeworks
    // satırı olmasa da homeworkId = görevin id'si (StudentProgressView dedup'u için).
    homeworkId: PROGRESS_HOMEWORK_TASK_TYPES.has(record.task_type)
      ? record.id
      : record.homework_id || undefined,
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
    homeworkId: PROGRESS_HOMEWORK_TASK_TYPES.has(record.task_type)
      ? record.task_id || undefined
      : record.homework_id || undefined,
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
    const [result, bookImageByName, analysesMap] = await Promise.all([
      requestDb.query(`
        SELECT wq.id, wq.student_id, wq.task_id, wq.test_id, wq.subject, wq.test_name,
               wq.question_number, wq.error_type,
               wq.review_status, wq.resolved_at,
               CAST(1 AS bit) AS has_photo, wq.created_at,
               ISNULL(ap.photo_count, 0) AS analysis_photo_count,
               COALESCE(tp.name, wq.topic) AS topic,
               COALESCE(rb.name, rb2.name, wq.book_name) AS book_name,
               COALESCE(pub.name, pub2.name, wq.publisher_name) AS publisher_name,
               wq.resource_book_id,
               t.topic_name, t.page_start, t.page_end,
               tak.correct_label AS correct_answer
        FROM dbo.WrongQuestions wq
        LEFT JOIN dbo.ResourceBookTopicTests t ON t.id = wq.test_id
        LEFT JOIN dbo.ResourceBookTopics tp ON tp.id = t.topic_id
        LEFT JOIN dbo.ResourceBooks rb ON rb.id = tp.resource_book_id
        LEFT JOIN dbo.Publishers pub ON pub.id = rb.publisher_id
        LEFT JOIN dbo.ResourceBooks rb2 ON rb2.id = wq.resource_book_id
        LEFT JOIN dbo.Publishers pub2 ON pub2.id = rb2.publisher_id
        LEFT JOIN dbo.TestAnswerKeys tak ON tak.test_id = wq.test_id AND tak.order_no = wq.question_number
        LEFT JOIN (
          SELECT wrong_question_id, COUNT(*) AS photo_count
          FROM dbo.WrongQuestionAnalysisPhotos
          GROUP BY wrong_question_id
        ) ap ON ap.wrong_question_id = wq.id
        WHERE wq.student_id = @studentId
          AND (wq.test_id IS NOT NULL OR wq.mock_exam_subject_id IS NOT NULL
               OR wq.resource_book_id IS NOT NULL OR wq.error_type = 'serbest')
        ${resourceBookId ? 'AND (tp.resource_book_id = @resourceBookId OR wq.resource_book_id = @resourceBookId)' : ''}
        ORDER BY wq.created_at DESC;
      `),
      fetchWrongQuestionBookImagesByName(studentId, { resourceBookId }),
      fetchWrongQuestionAnalyses(studentId),
    ])

    // bookImageUrl'i her satırda tekrar tekrar döndürmek yerine (bkz. yukarıdaki
    // fetchWrongQuestionBookImagesByName yorumu) ayrı, kitap başına tek girişli bir harita
    // olarak gönderiyoruz; istemci bunu book_name ile eşleyip sadece görüntülerken kullanır.
    return json(200, {
      wrongQuestions: result.recordset.map((row) => ({
        ...sanitizeWrongQuestion(row),
        analysisComments: analysesMap.get(row.id) || [],
      })),
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

// Hata Defterim'de yanlış çekilmiş / okunmayan bir fotoğrafı yenisiyle değiştirir. Yeni fotoğraf
// dışında hiçbir alanı etkilemez (konu, hata nedeni, inceleme durumu vb. korunur). Cevap kağıdı
// akışındaki saveWrongQuestionPhotoHandler'ın (tasks.js) Hata Defteri'nden erişilebilen muadili.
async function updateWrongQuestionPhotoHandler(request) {
  try {
    const wrongQuestionId = request.params.wrongQuestionId
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentWriteContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

    const photoCheck = sanitizeMistakePhoto(payload?.photo)
    if (photoCheck.error) {
      return json(400, { error: photoCheck.error })
    }

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: wrongQuestionId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      photoUrl: { type: sql.NVarChar(sql.MAX), value: photoCheck.value },
    })
    const result = await requestDb.query(`
      UPDATE dbo.WrongQuestions SET photo_url = @photoUrl
      OUTPUT ${WRONG_QUESTION_OUTPUT_COLUMNS}
      WHERE id = @id AND student_id = @studentId;
    `)

    if (!result.recordset[0]) {
      return json(404, { error: 'Kayıt bulunamadı.' })
    }

    return json(200, { wrongQuestion: sanitizeWrongQuestion(result.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('updateWrongQuestionPhotoHandler failed', error)
    return json(500, { error: 'Fotoğraf güncellenemedi.' })
  }
}

// Bir sorunun TÜM Hata Analiz görsellerini döner (slayt gibi gezinme + yazdırma için, bkz.
// AnalysisPhotoViewer.jsx). Diğer tembel-çekim uçlarından farklı olarak burada hepsi tek seferde
// gelir — bu uç zaten kullanıcının "Analizi Göster" tıklamasıyla tetiklenen tekil bir aksiyon,
// soru başına görsel sayısı da az olduğundan (genelde 1-5) ayrı ayrı çekmeye gerek yok.
// Hem öğrenci hem veli kendi Hata Defteri'nden görüntüleyebilir; ekleme/silme veliye özeldir.
async function listWrongQuestionAnalysisPhotoRecordsHandler(request) {
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
      SELECT p.id, p.photo_url, p.created_at
      FROM dbo.WrongQuestionAnalysisPhotos p
      INNER JOIN dbo.WrongQuestions wq ON wq.id = p.wrong_question_id
      WHERE p.wrong_question_id = @id AND wq.student_id = @studentId
      ORDER BY p.created_at ASC;
    `)

    return json(200, {
      photos: result.recordset.map((row) => ({
        id: row.id,
        photoUrl: row.photo_url,
        createdAt: row.created_at,
      })),
    })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('listWrongQuestionAnalysisPhotoRecordsHandler failed', error)
    return json(500, { error: 'Hata analiz görselleri yüklenemedi.' })
  }
}

// Bir soruya yeni bir Hata Analiz görseli ekler (mevcutları değiştirmez — birden fazla görsel
// desteklenir). Sadece veli ekleyebilir; metin yorumları (dbo.WrongQuestionAnalyses) üç rolden de
// gelebilir ama görsel eklemek veliye özel kaldı (bkz. addWrongQuestionAnalysisComment).
async function addWrongQuestionAnalysisPhotoHandler(request) {
  try {
    const wrongQuestionId = request.params.wrongQuestionId
    const payload = await request.json().catch(() => null)
    const { error, studentId, actorRole, actorId } = await requireStudentWriteContext(request, {
      studentId: payload?.studentId,
    })
    if (error) {
      return error
    }
    if (actorRole !== 'ebeveyn') {
      return json(403, { error: 'Hata analiz görseli sadece veli tarafından eklenebilir.' })
    }

    const photoCheck = sanitizeMistakePhoto(payload?.photo)
    if (photoCheck.error) {
      return json(400, { error: photoCheck.error })
    }

    const ownerDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: wrongQuestionId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const ownerResult = await ownerDb.query(
      `SELECT 1 AS ok FROM dbo.WrongQuestions WHERE id = @id AND student_id = @studentId;`,
    )
    if (!ownerResult.recordset.length) {
      return json(404, { error: 'Kayıt bulunamadı.' })
    }

    const requestDb = await withRequest({
      wrongQuestionId: { type: sql.UniqueIdentifier, value: wrongQuestionId },
      photoUrl: { type: sql.NVarChar(sql.MAX), value: photoCheck.value },
      addedBy: { type: sql.UniqueIdentifier, value: actorId },
    })
    const result = await requestDb.query(`
      INSERT INTO dbo.WrongQuestionAnalysisPhotos (wrong_question_id, photo_url, added_by_user_id)
      OUTPUT inserted.id, inserted.photo_url, inserted.created_at
      VALUES (@wrongQuestionId, @photoUrl, @addedBy);
    `)

    const row = result.recordset[0]
    return json(201, { photo: { id: row.id, photoUrl: row.photo_url, createdAt: row.created_at } })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('addWrongQuestionAnalysisPhotoHandler failed', error)
    return json(500, { error: 'Hata analiz görseli kaydedilemedi.' })
  }
}

// Bir Hata Analiz görselini kaldırır. Sadece veli.
async function deleteWrongQuestionAnalysisPhotoHandler(request) {
  try {
    const wrongQuestionId = request.params.wrongQuestionId
    const photoId = request.params.photoId
    const payload = await request.json().catch(() => null)
    const { error, studentId, actorRole } = await requireStudentWriteContext(request, {
      studentId: payload?.studentId,
    })
    if (error) {
      return error
    }
    if (actorRole !== 'ebeveyn') {
      return json(403, { error: 'Hata analiz görseli sadece veli tarafından kaldırılabilir.' })
    }

    const requestDb = await withRequest({
      photoId: { type: sql.UniqueIdentifier, value: photoId },
      wrongQuestionId: { type: sql.UniqueIdentifier, value: wrongQuestionId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const result = await requestDb.query(`
      DELETE p
      OUTPUT deleted.id
      FROM dbo.WrongQuestionAnalysisPhotos p
      INNER JOIN dbo.WrongQuestions wq ON wq.id = p.wrong_question_id
      WHERE p.id = @photoId AND p.wrong_question_id = @wrongQuestionId AND wq.student_id = @studentId;
    `)

    if (!result.recordset[0]) {
      return json(404, { error: 'Kayıt bulunamadı.' })
    }

    return json(200, { ok: true })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('deleteWrongQuestionAnalysisPhotoHandler failed', error)
    return json(500, { error: 'Hata analiz görseli kaldırılamadı.' })
  }
}

// "Hata Analizlerim" menüsü: bu öğrencinin (veli seçtiği çocuk ya da öğrencinin kendisi) üzerinde
// EN AZ BİRİ dolu olan tüm sorularını listeler — öğrenci/veli/öğretmenden en az bir analiz yorumu
// (dbo.WrongQuestionAnalyses, artık rol başına N yorum) veya veli tarafından eklenmiş bir Hata
// Analiz görseli. Görsellerin/yorumların kendisini taşımaz, sadece özet (bkz.
// listWrongQuestionAnalysisPhotoRecordsHandler + fetchWrongQuestionAnalyses); filtreleme/sıralama
// (en az biri dolu mu, en son ne zaman güncellendi) JS tarafında yapılır — SQL'de N-yorum modelini
// tek satıra sığdırmaya çalışmak (JOIN + agregasyon) gereksiz karmaşıklık katardı.
async function listWrongQuestionAnalysisPhotosHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const [result, analysesMap] = await Promise.all([
      requestDb.query(`
        SELECT wq.id, wq.subject, wq.question_number,
               photos.photo_count, photos.last_added_at,
               COALESCE(tp.name, wq.topic) AS topic,
               COALESCE(rb.name, rb2.name, wq.book_name) AS book_name,
               COALESCE(pub.name, pub2.name, wq.publisher_name) AS publisher_name,
               t.topic_name, wq.test_name
        FROM dbo.WrongQuestions wq
        LEFT JOIN (
          SELECT wrong_question_id, COUNT(*) AS photo_count, MAX(created_at) AS last_added_at
          FROM dbo.WrongQuestionAnalysisPhotos
          GROUP BY wrong_question_id
        ) photos ON photos.wrong_question_id = wq.id
        LEFT JOIN dbo.ResourceBookTopicTests t ON t.id = wq.test_id
        LEFT JOIN dbo.ResourceBookTopics tp ON tp.id = t.topic_id
        LEFT JOIN dbo.ResourceBooks rb ON rb.id = tp.resource_book_id
        LEFT JOIN dbo.Publishers pub ON pub.id = rb.publisher_id
        LEFT JOIN dbo.ResourceBooks rb2 ON rb2.id = wq.resource_book_id
        LEFT JOIN dbo.Publishers pub2 ON pub2.id = rb2.publisher_id
        WHERE wq.student_id = @studentId;
      `),
      fetchWrongQuestionAnalyses(studentId),
    ])

    const items = result.recordset
      .map((row) => {
        const analysisComments = analysesMap.get(row.id) || []
        const activityDates = [row.last_added_at, ...analysisComments.map((comment) => comment.createdAt)].filter(
          Boolean,
        )
        if (!row.photo_count && analysisComments.length === 0) return null
        return {
          id: row.id,
          subject: row.subject,
          topic: row.topic || undefined,
          topicName: row.topic_name || undefined,
          testName: row.test_name || undefined,
          bookName: row.book_name || undefined,
          publisherName: row.publisher_name || undefined,
          questionNumber: row.question_number || undefined,
          analysisPhotoCount: row.photo_count || 0,
          analysisComments,
          lastActivityAt: activityDates.length
            ? new Date(Math.max(...activityDates.map((date) => new Date(date).getTime())))
            : undefined,
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt))

    return json(200, { items })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('listWrongQuestionAnalysisPhotosHandler failed', error)
    return json(500, { error: 'Hata analizleri yüklenemedi.' })
  }
}

// Hata Defteri'nin serbest "+ Hata Ekle" akışı: bir görevden/testten bağımsız olarak, sadece ders
// zorunlu tutularak yeni bir hata kaydı açar. Ya gerçek bir kitap seçilir (resourceBookId — ad/yayın
// evi sunucu tarafında çözülür, client'tan gelen metne güvenilmez) ya da kitap serbestçe yazılır
// (freeBookName). error_type her zaman 'serbest' sabitlenir (mock-exam/basit-kitap kayıtlarıyla
// aynı desen: test_id yok, book_name/topic serbest metin) — bkz. listWrongQuestionsHandler filtresi.
async function addWrongQuestionHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentWriteContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

    const subject = payload?.subject?.trim()
    const resourceBookId = payload?.resourceBookId || null
    const freeBookName = payload?.freeBookName?.trim() || null

    if (!subject) {
      return json(400, { error: 'Ders zorunludur.' })
    }
    if (!resourceBookId && !freeBookName) {
      return json(400, { error: 'Bir kitap seçin veya kitap adını yazın.' })
    }

    let bookName = freeBookName
    let publisherName = null
    if (resourceBookId) {
      const bookDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: resourceBookId } })
      const bookResult = await bookDb.query(`
        SELECT rb.name AS book_name, pub.name AS publisher_name
        FROM dbo.ResourceBooks rb
        LEFT JOIN dbo.Publishers pub ON pub.id = rb.publisher_id
        WHERE rb.id = @id;
      `)
      const bookRow = bookResult.recordset[0]
      if (!bookRow) {
        return json(404, { error: 'Seçilen kitap bulunamadı.' })
      }
      bookName = bookRow.book_name
      publisherName = bookRow.publisher_name || null
    }

    const photoCheck = payload?.photo ? sanitizeMistakePhoto(payload.photo) : { value: null }
    if (photoCheck.error) {
      return json(400, { error: photoCheck.error })
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      taskId: { type: sql.UniqueIdentifier, value: payload?.taskId || null },
      resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId },
      subject: { type: sql.NVarChar(100), value: subject },
      topic: { type: sql.NVarChar(200), value: payload?.topic || null },
      bookName: { type: sql.NVarChar(200), value: bookName },
      publisherName: { type: sql.NVarChar(200), value: publisherName },
      errorType: { type: sql.NVarChar(50), value: 'serbest' },
      studentNote: { type: sql.NVarChar(1000), value: payload?.studentNote || null },
      photoUrl: { type: sql.NVarChar(sql.MAX), value: photoCheck.value },
    })
    const result = await requestDb.query(`
      INSERT INTO dbo.WrongQuestions
        (student_id, task_id, resource_book_id, subject, topic, book_name, publisher_name, error_type, student_note, photo_url)
      OUTPUT ${WRONG_QUESTION_OUTPUT_COLUMNS}
      VALUES (@studentId, @taskId, @resourceBookId, @subject, @topic, @bookName, @publisherName, @errorType, @studentNote, @photoUrl);
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
    const { error, studentId, actorRole, actorId } = await requireStudentWriteContext(request, {
      studentId: payload?.studentId,
    })
    if (error) {
      return error
    }

    // Analiz kulvarı çağıranın rolünden belirlenir (client'tan alınmaz): veli 'ebeveyn',
    // diğer her durum (öğrencinin kendisi) 'ogrenci'.
    const analysisRole = actorRole === 'ebeveyn' ? 'ebeveyn' : 'ogrenci'
    const analysis = payload?.analysis
    if (analysis && analysis.mistakeReason !== undefined && analysis.mistakeReason !== null) {
      if (!MISTAKE_REASONS.includes(analysis.mistakeReason)) {
        return json(400, { error: 'Geçersiz hata nedeni.' })
      }
    }
    if (analysis && !analysis.mistakeReason && !analysis.note?.trim()) {
      return json(400, { error: 'Yorum boş olamaz.' })
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
    if (payload?.topic !== undefined) {
      setClauses.push('topic = @topic')
      bindings.topic = { type: sql.NVarChar(200), value: payload.topic || null }
    }

    if (setClauses.length === 0 && !analysis) {
      return json(400, { error: 'Güncellenecek alan bulunamadı.' })
    }

    // Analiz-tek güncellemede WrongQuestions UPDATE'i çalışmadığından sahiplik ayrı doğrulanır.
    const ownerDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: wrongQuestionId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const ownerResult = await ownerDb.query(
      `SELECT 1 AS ok FROM dbo.WrongQuestions WHERE id = @id AND student_id = @studentId;`,
    )
    if (!ownerResult.recordset.length) {
      return json(404, { error: 'Kayıt bulunamadı.' })
    }

    if (setClauses.length > 0) {
      const requestDb = await withRequest(bindings)
      await requestDb.query(`
        UPDATE dbo.WrongQuestions SET ${setClauses.join(', ')} WHERE id = @id AND student_id = @studentId;
      `)
    }

    if (analysis) {
      await addWrongQuestionAnalysisComment(
        wrongQuestionId,
        analysisRole,
        { mistakeReason: analysis.mistakeReason, note: analysis.note },
        actorId,
      )
    }

    const [fetchResult, analysesMap] = await Promise.all([
      withRequest({ id: { type: sql.UniqueIdentifier, value: wrongQuestionId } }).then((db) =>
        db.query(`
          SELECT id, student_id, task_id, subject, topic, question_number, error_type,
                 review_status, resolved_at, created_at
          FROM dbo.WrongQuestions WHERE id = @id;
        `),
      ),
      fetchWrongQuestionAnalyses(studentId),
    ])

    return json(200, {
      wrongQuestion: {
        ...sanitizeWrongQuestion(fetchResult.recordset[0]),
        analysisComments: analysesMap.get(wrongQuestionId) || [],
      },
    })
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

  // computeWrongQuestionSourceBookStats yalnızca normalizedTopicKeys/studentId/teacherId'e bağlı,
  // aşağıdaki statsResult'a değil — bu yüzden sırayla değil paralel çalıştırılabilir. Hata
  // Defteri'nin istatistik ucu (getWrongQuestionTopicStatsHandler) bunları önceden art arda
  // bekliyordu, her round-trip Azure SQL'e ayrı bir gidiş-dönüş demekti ve sayfanın "yükleniyor"da
  // takılmasının başlıca nedeniydi (bkz. fetchResourceBookStatsForStudent'taki aynı düzeltme).
  const statsDbPromise = withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    topicKeysJson: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(normalizedTopicKeys) },
    ...(teacherId ? { teacherId: { type: sql.UniqueIdentifier, value: teacherId } } : {}),
  }).then((statsDb) => statsDb.query(`
    WITH WantedTopics AS (
      SELECT DISTINCT
             LTRIM(RTRIM(COALESCE(JSON_VALUE([value], '$.subject'), N''))) AS subject_name,
             LTRIM(RTRIM(COALESCE(JSON_VALUE([value], '$.topic'), N''))) AS topic_name
      FROM OPENJSON(@topicKeysJson)
    ),
    WantedTests AS (
      -- Konu adı eşleşmesi rbt.name (içerik/ünite adı) üzerinden yapılır, tt.topic_name üzerinden
      -- DEĞİL: WrongQuestions.topic her zaman ResourceBookTopics.name ile yazılıyor (bkz. tasks.js /
      -- catalog.js / teacher.js'deki "tp.name AS topic_name") ve listWrongQuestionsHandler de aynı
      -- COALESCE(tp.name, wq.topic) adını gösteriyor. Bazı kaynaklarda (ör. Ankara "Güçlendiren
      -- Dilbilgisi 8") her testin kendi tt.topic_name'i üniteden farklı bir alt başlık; buna göre
      -- eşleştirseydik bu kaynaklarda çözülen soru / başarı istatistiği hiç eşleşmez.
      SELECT DISTINCT tt.id AS test_id,
             LTRIM(RTRIM(COALESCE(s.name, N''))) AS subject_name,
             LTRIM(RTRIM(COALESCE(rbt.name, N''))) AS topic_name,
             rb.name AS book_name
      FROM dbo.ResourceBookTopicTests tt
      INNER JOIN dbo.ResourceBookTopics rbt ON rbt.id = tt.topic_id
      INNER JOIN dbo.ResourceBooks rb ON rb.id = rbt.resource_book_id
      INNER JOIN dbo.StudentResourceBooks srb ON srb.resource_book_id = rb.id AND srb.student_id = @studentId
      LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
      ${teacherId ? 'INNER JOIN dbo.StudentTeacherResourceBooks strb ON strb.teacher_id = @teacherId AND strb.resource_book_id = rb.id' : ''}
      INNER JOIN WantedTopics wt
        ON wt.subject_name = LTRIM(RTRIM(COALESCE(s.name, N'')))
       AND wt.topic_name = LTRIM(RTRIM(COALESCE(rbt.name, N'')))
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
  `))

  const [statsResult, sourceBookStats] = await Promise.all([
    statsDbPromise,
    computeWrongQuestionSourceBookStats(studentId, normalizedTopicKeys, { teacherId }),
  ])

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
      // Cevap kağıdından hesaplanan gerçek yanlış sayısı — Hata Defteri kartlarındaki "X yanlış"
      // rozeti artık bunu kullanır, dbo.WrongQuestions'daki FOTOĞRAFLANMIŞ satır sayısını değil
      // (bkz. WrongQuestionsView.jsx). İkisi aynı şey gibi görünse de bağımsız kaynaklardır: bir
      // soru fotoğraflanmadan da yanlış sayılabilir, ya da düzeltilip artık doğru olan bir sorunun
      // eski fotoğraf kaydı silinmemiş olabilir. Test sonucu her zaman otoriter kaynaktır.
      wrongCount: wrong,
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
      wrongCount: entry ? entry.wrong : 0,
      successRate: entry && totalAnswered > 0 ? entry.correct / totalAnswered : null,
    }
  })

  // "Kaynağa Göre" kartlarında kitabın genel tamamlanma oranını (çözülen test / kitaptaki
  // toplam test) göstermek için, yanlışı olan konuların ait olduğu kitapları bulup
  // catalog.js'deki aynı toplu istatistik hesabını kullanırız — böylece bu oran Kitaplık
  // donut'larıyla birebir aynıdır. catalog.js progress.js'i require ettiği için döngüsel
  // bağımlılığı önlemek adına burada tembel require ediyoruz. (Sorgusu yukarıda statsResult ile
  // paralel çalıştırıldı.)

  return { topicStats, sourceTopicStats, sourceBookStats }
}

// computeWrongQuestionTopicStats için yardımcı: fotoğraflı yanlışı olan konuların ait olduğu
// (öğrenciye atanmış, aktif) kaynak kitapları bulur ve her biri için kitap düzeyinde tamamlanma
// oranını hesaplar. teacherId verildiğinde kitaplar ayrıca o öğretmene atanmışlarla sınırlanır.
async function computeWrongQuestionSourceBookStats(studentId, normalizedTopicKeys, { teacherId } = {}) {
  if (!normalizedTopicKeys.length) return []

  const booksDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    topicKeysJson: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(normalizedTopicKeys) },
    ...(teacherId ? { teacherId: { type: sql.UniqueIdentifier, value: teacherId } } : {}),
  })
  const booksResult = await booksDb.query(`
    WITH WantedTopics AS (
      SELECT DISTINCT
             LTRIM(RTRIM(COALESCE(JSON_VALUE([value], '$.subject'), N''))) AS subject_name,
             LTRIM(RTRIM(COALESCE(JSON_VALUE([value], '$.topic'), N''))) AS topic_name
      FROM OPENJSON(@topicKeysJson)
    )
    SELECT DISTINCT rb.id AS book_id,
           rb.name AS book_name,
           LTRIM(RTRIM(COALESCE(s.name, N''))) AS subject_name
    FROM dbo.ResourceBooks rb
    INNER JOIN dbo.StudentResourceBooks srb ON srb.resource_book_id = rb.id AND srb.student_id = @studentId
    INNER JOIN dbo.ResourceBookTopics rbt ON rbt.resource_book_id = rb.id
    LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
    ${teacherId ? 'INNER JOIN dbo.StudentTeacherResourceBooks strb ON strb.teacher_id = @teacherId AND strb.resource_book_id = rb.id' : ''}
    INNER JOIN WantedTopics wt
      ON wt.subject_name = LTRIM(RTRIM(COALESCE(s.name, N'')))
     AND wt.topic_name = LTRIM(RTRIM(COALESCE(rbt.name, N'')))
    WHERE rb.is_active = 1;
  `)

  if (!booksResult.recordset.length) return []

  const { fetchResourceBookStatsForStudent } = require('./catalog')
  const bookIds = booksResult.recordset.map((row) => row.book_id)
  const bookStatsById = await fetchResourceBookStatsForStudent(studentId, bookIds)

  return booksResult.recordset.map((row) => {
    const entry = bookStatsById.get(row.book_id)
    return {
      subject: row.subject_name,
      bookName: row.book_name || null,
      completionRate: entry ? entry.completionRate : null,
    }
  })
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

    const { topicStats, sourceTopicStats, sourceBookStats } = await computeWrongQuestionTopicStats(
      studentId,
      result.recordset,
    )
    return json(200, { topicStats, sourceTopicStats, sourceBookStats })
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

// "Çalışma Geçmişi" (veli + öğrenci): öğrencinin çözüp sonucu kaydedilmiş her testi/ödevi tek bir
// tarih-saat sıralı listede döner. Üç kaynak birleştirilir:
//  1) Soru bankası görevlerinde optik formla değerlendirilmiş testler
//     (dbo.Tasks.test_results_json — testId -> { correct, wrong, blank, gradedAt }): test başına satır.
//  2) Kitaplık / Kaynaklar ekranından elle optik sonucu girilen testler
//     (dbo.StudentManualTestCompletions): test başına satır.
//  3) Tamamlanmış ödev görevleri (okul ödevi dahil) — teste bağlı optik sonucu YOKKEN öğrencinin
//     görev kapatırken girdiği doğru/yanlış/boş sayıları (dbo.Tasks.correct_count vb.): görev başına
//     tek toplu satır. Okul ödevleri bir ResourceBook/testine bağlı olmadığından cevap kağıdı yok.
// Aynı testId hem bir görevde hem de manuel tamamlamada varsa (manuel optik, bağlı görevi
// otomatik tamamladığından çift sayım olur) görev satırı tutulur, manuel satır atlanır.
async function listStudyHistoryHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const bindings = { studentId: { type: sql.UniqueIdentifier, value: studentId } }

    const [tasksResult, manualResult, mistakePhotoResult] = await Promise.all([
      withRequest(bindings).then((requestDb) =>
        requestDb.query(`
          SELECT t.id AS task_id, t.title AS task_title, t.subject, t.task_type, t.status,
                 t.date AS task_date, t.completed_at, t.updated_at, t.test_results_json,
                 t.selected_test_ids_json, t.correct_count, t.wrong_count, t.blank_count,
                 t.target_question_count, t.resource_book_id, t.school_resource_id,
                 rb.name AS resource_book_name, rb.resource_type,
                 scr.name AS school_resource_name,
                 p.name AS publisher_name,
                 COALESCE(s.name, ts.name) AS subject_name
          FROM dbo.Tasks t
          LEFT JOIN dbo.ResourceBooks rb ON rb.id = t.resource_book_id
          LEFT JOIN dbo.SchoolClassResources scr ON scr.id = t.school_resource_id
          LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
          LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
          LEFT JOIN dbo.Subjects ts ON ts.id = t.subject_id
          WHERE t.student_id = @studentId AND t.is_draft = 0
            AND (
              (t.test_results_json IS NOT NULL AND t.test_results_json <> '{}')
              OR (
                t.status = 'tamamlandi' AND t.correct_count IS NOT NULL
                AND t.task_type IN ('odev', 'soru-bankasi-odevi', 'okul-odevi', 'etkinlik-odevi')
              )
            );
        `),
      ),
      withRequest(bindings).then((requestDb) =>
        requestDb.query(`
          SELECT smtc.test_id, smtc.correct_count, smtc.wrong_count, smtc.blank_count,
                 smtc.marked_at, smtc.answers_json,
                 tt.name AS test_name, COALESCE(tt.topic_name, rbt.name) AS topic_name,
                 tt.page_start, tt.page_end, tt.question_count,
                 rb.id AS resource_book_id, rb.name AS resource_book_name, rb.resource_type,
                 p.name AS publisher_name, s.name AS subject_name
          FROM dbo.StudentManualTestCompletions smtc
          INNER JOIN dbo.ResourceBookTopicTests tt ON tt.id = smtc.test_id
          INNER JOIN dbo.ResourceBookTopics rbt ON rbt.id = tt.topic_id
          INNER JOIN dbo.ResourceBooks rb ON rb.id = rbt.resource_book_id
          LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
          LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
          WHERE smtc.student_id = @studentId
            AND (smtc.correct_count IS NOT NULL OR smtc.wrong_count IS NOT NULL OR smtc.blank_count IS NOT NULL);
        `),
      ),
      // Uyarı bandı + "eksik görsel" filtresi soru bazında saymaz; bir çalışmada (görev+test ya da
      // test) EN AZ BİR hata görseli var mı yok mu — sadece bu "var/yok" ilişkisi gerekir. Tek
      // gruplu sorgu, öğrenci başına küçük sonuç kümesi (N+1 yok).
      withRequest(bindings).then((requestDb) =>
        requestDb.query(`
          SELECT DISTINCT task_id, test_id
          FROM dbo.WrongQuestions
          WHERE student_id = @studentId AND photo_url IS NOT NULL AND test_id IS NOT NULL;
        `),
      ),
    ])

    // Görev satırlarında geçen testleri, adı / sayfası / soru sayısı için tek sorguda çöz.
    const taskEntries = []
    for (const row of tasksResult.recordset) {
      const results = parseJson(row.test_results_json, {})
      for (const [testId, result] of Object.entries(results || {})) {
        if (!testId || !result) continue
        taskEntries.push({ row, testId, result })
      }
    }

    const testIds = Array.from(new Set(taskEntries.map((entry) => entry.testId)))
    let testsById = new Map()
    if (testIds.length) {
      const testBindings = {}
      const placeholders = testIds.map((id, index) => {
        testBindings[`t${index}`] = { type: sql.UniqueIdentifier, value: id }
        return `@t${index}`
      })
      const testsDb = await withRequest(testBindings)
      const testsResult = await testsDb.query(`
        SELECT id, name, topic_name, page_start, page_end, question_count
        FROM dbo.ResourceBookTopicTests
        WHERE id IN (${placeholders.join(', ')});
      `)
      testsById = new Map(testsResult.recordset.map((r) => [r.id, r]))
    }

    const toInt = (value) => (value === null || value === undefined ? 0 : Number(value) || 0)
    const successRate = (correct, questionCount) =>
      questionCount > 0 ? Math.round((correct / questionCount) * 100) : 0

    const items = []
    const seenTaskTestIds = new Set()
    const producedTaskIds = new Set()

    for (const { row, testId, result } of taskEntries) {
      const test = testsById.get(testId)
      if (!test) continue
      seenTaskTestIds.add(testId)
      producedTaskIds.add(row.task_id)
      const correct = toInt(result.correct)
      const wrong = toInt(result.wrong)
      const questionCount = toInt(test.question_count)
      const blank = result.blank === undefined ? Math.max(0, questionCount - correct - wrong) : toInt(result.blank)
      items.push({
        key: `task:${row.task_id}:${testId}`,
        source: 'task',
        occurredAt: result.gradedAt || row.completed_at || row.task_date || null,
        completedAt: row.completed_at || null,
        taskId: row.task_id,
        taskTitle: row.task_title || undefined,
        taskType: row.task_type || undefined,
        testId,
        resourceBookId: row.resource_book_id || undefined,
        publisherName: row.publisher_name || undefined,
        resourceBookName: row.resource_book_name || undefined,
        resourceType: row.resource_type || undefined,
        subjectName: row.subject_name || row.subject || undefined,
        testName: test.name,
        topicName: test.topic_name || undefined,
        pageStart: test.page_start ?? undefined,
        pageEnd: test.page_end ?? undefined,
        questionCount,
        correct,
        wrong,
        blank,
        successRate: successRate(correct, questionCount),
        canViewAnswers: true,
      })
    }

    for (const row of manualResult.recordset) {
      if (seenTaskTestIds.has(row.test_id)) continue
      const correct = toInt(row.correct_count)
      const wrong = toInt(row.wrong_count)
      const questionCount = toInt(row.question_count)
      const blank =
        row.blank_count === null || row.blank_count === undefined
          ? Math.max(0, questionCount - correct - wrong)
          : toInt(row.blank_count)
      const hasAnswers = Boolean(row.answers_json)
      items.push({
        key: `manual:${row.test_id}`,
        source: 'manual',
        occurredAt: row.marked_at || null,
        taskId: null,
        testId: row.test_id,
        resourceBookId: row.resource_book_id || undefined,
        publisherName: row.publisher_name || undefined,
        resourceBookName: row.resource_book_name || undefined,
        resourceType: row.resource_type || undefined,
        subjectName: row.subject_name || undefined,
        testName: row.test_name,
        topicName: row.topic_name || undefined,
        pageStart: row.page_start ?? undefined,
        pageEnd: row.page_end ?? undefined,
        questionCount,
        correct,
        wrong,
        blank,
        successRate: successRate(correct, questionCount),
        canViewAnswers: hasAnswers,
        manualAnswers: hasAnswers ? parseJson(row.answers_json, {}) : undefined,
      })
    }

    // 3) Teste bağlı optik sonucu üretmeyen ama tamamlanırken doğru/yanlış/boş sayısı girilmiş
    // ödev görevleri (özellikle okul ödevleri) — görev başına tek toplu satır.
    for (const row of tasksResult.recordset) {
      if (producedTaskIds.has(row.task_id)) continue
      if (row.status !== 'tamamlandi' || row.correct_count === null || row.correct_count === undefined) continue
      const correct = toInt(row.correct_count)
      const wrong = toInt(row.wrong_count)
      const blank = toInt(row.blank_count)
      const answered = correct + wrong + blank
      const questionCount = answered > 0 ? answered : toInt(row.target_question_count)
      const selectedTestIds = parseJson(row.selected_test_ids_json, [])
      items.push({
        key: `task-agg:${row.task_id}`,
        source: 'task',
        occurredAt: row.completed_at || row.updated_at || row.task_date || null,
        completedAt: row.completed_at || null,
        taskId: row.task_id,
        taskTitle: row.task_title || undefined,
        taskType: row.task_type || undefined,
        testId: null,
        resourceBookId: row.resource_book_id || undefined,
        publisherName: row.publisher_name || undefined,
        resourceBookName: row.resource_book_name || row.school_resource_name || undefined,
        resourceType: row.resource_type || undefined,
        subjectName: row.subject_name || row.subject || undefined,
        testName: row.task_title || row.resource_book_name || row.school_resource_name || 'Ödev',
        topicName: undefined,
        pageStart: undefined,
        pageEnd: undefined,
        questionCount,
        correct,
        wrong,
        blank,
        successRate: successRate(correct, questionCount),
        // Teste bağlı görevde cevap kağıdı açılabilir; okul ödevinde soru bazlı veri yok.
        canViewAnswers: Array.isArray(selectedTestIds) && selectedTestIds.length > 0,
      })
    }

    // Hangi (görev,test) / (test) için en az bir hata görseli yüklenmiş — bkz. yukarıdaki sorgu.
    const photoTaskTestKeys = new Set()
    const photoTestIds = new Set()
    for (const row of mistakePhotoResult.recordset) {
      photoTestIds.add(row.test_id)
      if (row.task_id) photoTaskTestKeys.add(`${row.task_id}:${row.test_id}`)
    }

    // Teste bağlı, yanlış veya boş sorusu olan çalışmalarda hata görseli durumu:
    //   'uploaded' → en az bir görsel var, 'missing' → hiç yok, null → uygun değil
    //   (hata yok ya da teste bağlı değil, ikon gösterilmez).
    // Görev kaynaklı satırda görsel o göreve, elle (Kitaplık) satırda teste bağlı aranır.
    for (const item of items) {
      const hasMistakes = (item.wrong || 0) + (item.blank || 0) > 0
      if (!item.testId || !hasMistakes) {
        item.mistakePhotoStatus = null
        continue
      }
      const hasPhoto = item.taskId
        ? photoTaskTestKeys.has(`${item.taskId}:${item.testId}`)
        : photoTestIds.has(item.testId)
      item.mistakePhotoStatus = hasPhoto ? 'uploaded' : 'missing'
    }

    items.sort((a, b) => {
      const at = a.occurredAt ? new Date(a.occurredAt).getTime() : 0
      const bt = b.occurredAt ? new Date(b.occurredAt).getTime() : 0
      return bt - at
    })

    return json(200, {
      items,
      hasMissingMistakePhotos: items.some((item) => item.mistakePhotoStatus === 'missing'),
    })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('listStudyHistoryHandler failed', error)
    return json(500, { error: 'Çalışma geçmişi yüklenemedi.' })
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
                 rb.name, rb.resource_type, rb.has_answer_key
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
          WHERE t.student_id = @studentId AND t.is_draft = 0 AND t.is_unscheduled = 0
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
                 COALESCE(NULLIF(h.description, ''), h.title) AS title, h.description,
                 h.assigned_date, h.date AS due_date,
                 h.target_question_count AS total_question_count, h.completed_question_count,
                 h.target_page_count AS total_page_count,
                 h.status, h.created_at, h.updated_at
          FROM dbo.Tasks h
          LEFT JOIN dbo.Subjects s ON s.id = h.subject_id
          LEFT JOIN dbo.ResourceBooks rb ON rb.id = h.resource_book_id
          LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
          WHERE h.student_id = @studentId AND h.is_draft = 0
            AND h.task_type IN ('odev', 'soru-bankasi-odevi', 'okul-odevi', 'etkinlik-odevi')
          ORDER BY h.date DESC;
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
  updateWrongQuestionPhotoHandler,
  listWrongQuestionAnalysisPhotoRecordsHandler,
  addWrongQuestionAnalysisPhotoHandler,
  deleteWrongQuestionAnalysisPhotoHandler,
  listWrongQuestionAnalysisPhotosHandler,
  addWrongQuestionHandler,
  updateWrongQuestionHandler,
  getWrongQuestionTopicStatsHandler,
  computeWrongQuestionTopicStats,
  fetchWrongQuestionAnalyses,
  fetchAnalysesByQuestionIds,
  addWrongQuestionAnalysisComment,
  MISTAKE_REASONS,
  ANALYSIS_ROLES,
  listStudySessionsHandler,
  addStudySessionHandler,
  listStudyHistoryHandler,
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
