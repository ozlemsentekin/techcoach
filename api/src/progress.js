const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { json } = require('./http')
const { isSessionError } = require('./security')
const { requireStudentContext } = require('./studentScope')

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
    subject: record.subject,
    topic: record.topic || undefined,
    questionNumber: record.question_number || undefined,
    errorType: record.error_type,
    studentNote: record.student_note || undefined,
    reviewStatus: record.review_status,
    resolvedAt: record.resolved_at,
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
    subject: record.subject || undefined,
    topic: record.topic || undefined,
    resourceBookId: record.resource_book_id || undefined,
    resourceBookName: record.resource_book_name || undefined,
    resourceType: record.resource_type || undefined,
    publisherName: record.publisher_name || undefined,
    subjectId: record.resource_subject_id || undefined,
    subjectName: record.resource_subject_name || undefined,
    selectedTestIds: parseJson(record.selected_test_ids_json, []),
    testResults: parseJson(record.test_results_json, {}),
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
    const { error, studentId } = await requireStudentContext(request, { studentId: payload?.studentId })
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

async function listWrongQuestionsHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const result = await requestDb.query(`
      SELECT id, student_id, task_id, subject, topic, question_number, error_type, student_note, review_status, resolved_at, created_at
      FROM dbo.WrongQuestions
      WHERE student_id = @studentId
      ORDER BY created_at DESC;
    `)

    return json(200, { wrongQuestions: result.recordset.map(sanitizeWrongQuestion) })
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

async function addWrongQuestionHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentContext(request, { studentId: payload?.studentId })
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
    const { error, studentId } = await requireStudentContext(request, { studentId: payload?.studentId })
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
      SELECT id, student_id, task_id, subject, topic, question_number, error_type, student_note, review_status, resolved_at, created_at
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
                 t.title AS task_title, t.task_type, t.homework_id, t.subject, t.topic, t.resource_book_id,
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
    ])

    return json(200, {
      resourceBooks: resourceBooksResult.recordset.map(sanitizeProgressResourceBook),
      tests: testsResult.recordset.map(sanitizeProgressTest),
      tasks: tasksResult.recordset.map(sanitizeProgressTask),
      sessions: sessionsResult.recordset.map(sanitizeProgressSession),
      homeworks: homeworksResult.recordset.map(sanitizeProgressHomework),
      wrongQuestions: wrongQuestionsResult.recordset.map(sanitizeWrongQuestion),
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
    const { error, studentId } = await requireStudentContext(request, { studentId: payload?.studentId })
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
    const { error, studentId } = await requireStudentContext(request, { studentId: payload?.studentId })
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
  addWrongQuestionHandler,
  updateWrongQuestionHandler,
  listStudySessionsHandler,
  addStudySessionHandler,
  getProgressOverviewHandler,
  getSmallGoalHandler,
  setSmallGoalHandler,
}
