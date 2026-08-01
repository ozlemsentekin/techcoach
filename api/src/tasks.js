const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { json } = require('./http')
const { requireStudentContext } = require('./studentScope')

function toISODate(value) {
  if (!value) return null
  return value instanceof Date ? value.toISOString().slice(0, 10) : value
}

function sanitizeTask(record) {
  return {
    id: record.id,
    studentId: record.student_id,
    isDraft: Boolean(record.is_draft),
    date: toISODate(record.date),
    title: record.title,
    taskType: record.task_type,
    subject: record.subject || undefined,
    topic: record.topic || undefined,
    startTime: record.start_time,
    endTime: record.end_time,
    durationMinutes: record.duration_minutes,
    targetQuestionCount: record.target_question_count ?? undefined,
    completedQuestionCount: record.completed_question_count ?? undefined,
    targetPageCount: record.target_page_count ?? undefined,
    completedPageCount: record.completed_page_count ?? undefined,
    currentPageNumber: record.current_page_number ?? undefined,
    priority: record.priority,
    status: record.status,
    description: record.description || undefined,
    parentNote: record.parent_note || undefined,
    createdBy: record.created_by,
    notes: record.notes || undefined,
    completedAt: record.completed_at,
    rescheduledFrom: record.rescheduled_from,
    rescheduledTo: record.rescheduled_to,
    rescheduleReason: record.reschedule_reason,
    correctCount: record.correct_count ?? undefined,
    wrongCount: record.wrong_count ?? undefined,
    blankCount: record.blank_count ?? undefined,
    difficulty: record.difficulty || undefined,
    emotion: record.emotion || undefined,
    reflectionAnswers: record.reflection_answers_json ? JSON.parse(record.reflection_answers_json) : undefined,
    completedSubGoals: record.completed_sub_goals_json ? JSON.parse(record.completed_sub_goals_json) : [],
    resourceBookId: record.resource_book_id || undefined,
    resourceType: record.resource_type || undefined,
    selectedTestIds: record.selected_test_ids_json ? JSON.parse(record.selected_test_ids_json) : undefined,
    answers: record.answers_json ? JSON.parse(record.answers_json) : undefined,
    testResults: record.test_results_json ? JSON.parse(record.test_results_json) : undefined,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

const SELECT_TASK = `
  SELECT t.id, t.student_id, t.is_draft, t.date, t.title, t.task_type, t.subject, t.topic, t.start_time, t.end_time, t.duration_minutes,
         t.target_question_count, t.completed_question_count, t.target_page_count, t.completed_page_count,
         t.current_page_number, t.priority, t.status, t.description, t.parent_note, t.created_by,
         t.notes, t.completed_at, t.rescheduled_from, t.rescheduled_to, t.reschedule_reason, t.correct_count, t.wrong_count,
         t.blank_count, t.difficulty, t.emotion, t.reflection_answers_json, t.completed_sub_goals_json,
         t.resource_book_id, t.selected_test_ids_json, t.answers_json, t.test_results_json, rb.resource_type,
         t.created_at, t.updated_at
  FROM dbo.Tasks t
  LEFT JOIN dbo.ResourceBooks rb ON rb.id = t.resource_book_id
`

// Maps camelCase payload keys to { column, bind(requestDb, key, value) } for generic insert/update.
const FIELD_MAP = {
  title: (v) => ({ column: 'title', type: sql.NVarChar(200), value: v }),
  taskType: (v) => ({ column: 'task_type', type: sql.NVarChar(40), value: v }),
  subject: (v) => ({ column: 'subject', type: sql.NVarChar(100), value: v || null }),
  topic: (v) => ({ column: 'topic', type: sql.NVarChar(200), value: v || null }),
  date: (v) => ({ column: 'date', type: sql.Date, value: v }),
  startTime: (v) => ({ column: 'start_time', type: sql.Char(5), value: v }),
  endTime: (v) => ({ column: 'end_time', type: sql.Char(5), value: v }),
  durationMinutes: (v) => ({ column: 'duration_minutes', type: sql.Int, value: Number(v) || 0 }),
  targetQuestionCount: (v) => ({ column: 'target_question_count', type: sql.Int, value: v === null ? null : Number(v) }),
  completedQuestionCount: (v) => ({ column: 'completed_question_count', type: sql.Int, value: v === null ? null : Number(v) }),
  targetPageCount: (v) => ({ column: 'target_page_count', type: sql.Int, value: v === null ? null : Number(v) }),
  completedPageCount: (v) => ({ column: 'completed_page_count', type: sql.Int, value: v === null ? null : Number(v) }),
  currentPageNumber: (v) => ({ column: 'current_page_number', type: sql.Int, value: v === null ? null : Number(v) }),
  priority: (v) => ({ column: 'priority', type: sql.NVarChar(20), value: v }),
  status: (v) => ({ column: 'status', type: sql.NVarChar(30), value: v }),
  description: (v) => ({ column: 'description', type: sql.NVarChar(1000), value: v || null }),
  parentNote: (v) => ({ column: 'parent_note', type: sql.NVarChar(1000), value: v || null }),
  createdBy: (v) => ({ column: 'created_by', type: sql.NVarChar(20), value: v }),
  notes: (v) => ({ column: 'notes', type: sql.NVarChar(1000), value: v || null }),
  completedAt: (v) => ({ column: 'completed_at', type: sql.DateTime2, value: v || null }),
  rescheduledFrom: (v) => ({ column: 'rescheduled_from', type: sql.NVarChar(50), value: v || null }),
  rescheduledTo: (v) => ({ column: 'rescheduled_to', type: sql.NVarChar(50), value: v || null }),
  rescheduleReason: (v) => ({ column: 'reschedule_reason', type: sql.NVarChar(500), value: v || null }),
  correctCount: (v) => ({ column: 'correct_count', type: sql.Int, value: v === null ? null : Number(v) }),
  wrongCount: (v) => ({ column: 'wrong_count', type: sql.Int, value: v === null ? null : Number(v) }),
  blankCount: (v) => ({ column: 'blank_count', type: sql.Int, value: v === null ? null : Number(v) }),
  difficulty: (v) => ({ column: 'difficulty', type: sql.NVarChar(30), value: v || null }),
  emotion: (v) => ({ column: 'emotion', type: sql.NVarChar(30), value: v || null }),
  reflectionAnswers: (v) => ({ column: 'reflection_answers_json', type: sql.NVarChar(sql.MAX), value: v ? JSON.stringify(v) : null }),
  completedSubGoals: (v) => ({ column: 'completed_sub_goals_json', type: sql.NVarChar(sql.MAX), value: v ? JSON.stringify(v) : null }),
  isDraft: (v) => ({ column: 'is_draft', type: sql.Bit, value: Boolean(v) }),
  resourceBookId: (v) => ({ column: 'resource_book_id', type: sql.UniqueIdentifier, value: v || null }),
  selectedTestIds: (v) => ({ column: 'selected_test_ids_json', type: sql.NVarChar(sql.MAX), value: v && v.length ? JSON.stringify(v) : null }),
  answers: (v) => ({ column: 'answers_json', type: sql.NVarChar(sql.MAX), value: v ? JSON.stringify(v) : null }),
  testResults: (v) => ({ column: 'test_results_json', type: sql.NVarChar(sql.MAX), value: v ? JSON.stringify(v) : null }),
}

async function listTasksHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const date = request.query.get('date')
    const isDraft = request.query.get('isDraft') === 'true'

    if (!date) {
      return json(400, { error: 'Tarih zorunludur.' })
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      date: { type: sql.Date, value: date },
      isDraft: { type: sql.Bit, value: isDraft },
    })
    const result = await requestDb.query(`
      ${SELECT_TASK}
      WHERE student_id = @studentId AND date = @date AND is_draft = @isDraft
      ORDER BY start_time ASC;
    `)

    return json(200, { tasks: result.recordset.map(sanitizeTask) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('listTasksHandler failed', error)
    return json(401, { error: 'Oturum geçersiz.' })
  }
}

async function getTaskHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const taskId = request.params.taskId
    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: taskId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const result = await requestDb.query(`
      ${SELECT_TASK}
      WHERE t.id = @id AND t.student_id = @studentId;
    `)

    if (!result.recordset[0]) {
      return json(404, { error: 'Görev bulunamadı.' })
    }

    return json(200, { task: sanitizeTask(result.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('getTaskHandler failed', error)
    return json(401, { error: 'Oturum geçersiz.' })
  }
}

async function createTaskHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

    if (!payload?.date || !payload?.title || !payload?.taskType || !payload?.startTime || !payload?.endTime) {
      return json(400, { error: 'Tarih, başlık, görev türü ve saat bilgileri zorunludur.' })
    }

    const columns = ['student_id']
    const valuePlaceholders = ['@studentId']
    const bindings = {
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    }

    Object.entries(payload).forEach(([key, value]) => {
      if (key === 'studentId' || value === undefined || !FIELD_MAP[key]) return
      const { column, type, value: boundValue } = FIELD_MAP[key](value)
      columns.push(column)
      valuePlaceholders.push(`@${key}`)
      bindings[key] = { type, value: boundValue }
    })

    const requestDb = await withRequest(bindings)
    const result = await requestDb.query(`
      INSERT INTO dbo.Tasks (${columns.join(', ')})
      OUTPUT inserted.id
      VALUES (${valuePlaceholders.join(', ')});
    `)

    const insertedId = result.recordset[0].id
    const fetchDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: insertedId } })
    const fetchResult = await fetchDb.query(`${SELECT_TASK} WHERE t.id = @id;`)

    return json(201, { task: sanitizeTask(fetchResult.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('createTaskHandler failed', error)
    return json(500, { error: 'Görev oluşturulamadı.' })
  }
}

async function updateTaskHandler(request) {
  try {
    const taskId = request.params.taskId
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

    const setClauses = []
    const bindings = {
      id: { type: sql.UniqueIdentifier, value: taskId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    }

    Object.entries(payload || {}).forEach(([key, value]) => {
      if (key === 'studentId' || value === undefined || !FIELD_MAP[key]) return
      const { column, type, value: boundValue } = FIELD_MAP[key](value)
      setClauses.push(`${column} = @${key}`)
      bindings[key] = { type, value: boundValue }
    })

    if (setClauses.length === 0) {
      return json(400, { error: 'Güncellenecek alan bulunamadı.' })
    }

    const requestDb = await withRequest(bindings)
    const result = await requestDb.query(`
      UPDATE dbo.Tasks
      SET ${setClauses.join(', ')}
      WHERE id = @id AND student_id = @studentId;
    `)

    if (!result.rowsAffected[0]) {
      return json(404, { error: 'Görev bulunamadı.' })
    }

    const fetchDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: taskId } })
    const fetchResult = await fetchDb.query(`${SELECT_TASK} WHERE t.id = @id;`)

    return json(200, { task: sanitizeTask(fetchResult.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('updateTaskHandler failed', error)
    return json(500, { error: 'Görev güncellenemedi.' })
  }
}

async function deleteTaskHandler(request) {
  try {
    const taskId = request.params.taskId
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: taskId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const result = await requestDb.query(`
      DELETE FROM dbo.Tasks WHERE id = @id AND student_id = @studentId;
    `)

    if (!result.rowsAffected[0]) {
      return json(404, { error: 'Görev bulunamadı.' })
    }

    return json(200, { success: true })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('deleteTaskHandler failed', error)
    return json(500, { error: 'Görev silinemedi.' })
  }
}

// Soru bankası görevi için dijital optik cevap kağıdı: görevin bağlı olduğu testleri
// (isim, konu, soru sayısı) + o testler için öğrencinin daha önce kaydettiği cevapları/sonuçları döner.
async function getTaskAnswerSheetHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const taskId = request.params.taskId
    const taskDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: taskId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const taskResult = await taskDb.query(`
      SELECT selected_test_ids_json, answers_json, test_results_json
      FROM dbo.Tasks WHERE id = @id AND student_id = @studentId;
    `)

    const taskRecord = taskResult.recordset[0]
    if (!taskRecord) {
      return json(404, { error: 'Görev bulunamadı.' })
    }

    const testIds = taskRecord.selected_test_ids_json ? JSON.parse(taskRecord.selected_test_ids_json) : []
    if (!testIds.length) {
      return json(200, { tests: [] })
    }

    const answers = taskRecord.answers_json ? JSON.parse(taskRecord.answers_json) : {}
    const results = taskRecord.test_results_json ? JSON.parse(taskRecord.test_results_json) : {}

    const bindings = {}
    const placeholders = testIds.map((id, index) => {
      bindings[`test${index}`] = { type: sql.UniqueIdentifier, value: id }
      return `@test${index}`
    })
    const testsDb = await withRequest(bindings)
    const testsResult = await testsDb.query(`
      SELECT id, topic_name, name, question_count
      FROM dbo.ResourceBookTopicTests
      WHERE id IN (${placeholders.join(', ')});
    `)

    const testsById = new Map(testsResult.recordset.map((row) => [row.id, row]))
    const tests = testIds
      .map((id) => testsById.get(id))
      .filter(Boolean)
      .map((row) => ({
        id: row.id,
        name: row.name,
        topicName: row.topic_name || undefined,
        questionCount: row.question_count,
        answers: answers[row.id] || {},
        result: results[row.id] || null,
      }))

    return json(200, { tests })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('getTaskAnswerSheetHandler failed', error)
    return json(401, { error: 'Oturum geçersiz.' })
  }
}

// Popup'taki tek "Kaydet" butonu tüm testlerin o anki cevaplarını tek istekte gönderir.
// Her test için: sorular tam cevaplanmışsa dbo.TestAnswerKeys ile karşılaştırılıp doğru/yanlış/boş
// hesaplanır (cevap anahtarı eksikse test grade edilmeden atlanır); tamamlanmamış testler sadece
// ilerleme sayacına katkı sağlar. Görev seviyesinde toplamlar ve status buna göre güncellenir.
async function saveTaskAnswersHandler(request) {
  try {
    const taskId = request.params.taskId
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

    const submittedTests = Array.isArray(payload?.tests) ? payload.tests : []
    if (!submittedTests.length) {
      return json(400, { error: 'Kaydedilecek cevap bulunamadı.' })
    }

    const taskDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: taskId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const taskResult = await taskDb.query(`
      SELECT selected_test_ids_json, answers_json, test_results_json
      FROM dbo.Tasks WHERE id = @id AND student_id = @studentId;
    `)
    const taskRecord = taskResult.recordset[0]
    if (!taskRecord) {
      return json(404, { error: 'Görev bulunamadı.' })
    }

    const selectedTestIds = taskRecord.selected_test_ids_json ? JSON.parse(taskRecord.selected_test_ids_json) : []
    if (!selectedTestIds.length) {
      return json(400, { error: 'Bu görev bir soru bankası testine bağlı değil.' })
    }

    const answers = taskRecord.answers_json ? JSON.parse(taskRecord.answers_json) : {}
    const results = taskRecord.test_results_json ? JSON.parse(taskRecord.test_results_json) : {}

    submittedTests.forEach((entry) => {
      const testId = entry?.testId
      if (!testId || !selectedTestIds.includes(testId)) return

      const sanitizedAnswers = {}
      Object.entries(entry?.answers || {}).forEach(([orderNo, label]) => {
        const normalizedLabel = typeof label === 'string' ? label.trim().toUpperCase() : ''
        if (['A', 'B', 'C', 'D', 'E'].includes(normalizedLabel)) {
          sanitizedAnswers[orderNo] = normalizedLabel
        }
      })
      answers[testId] = sanitizedAnswers
    })

    const testBindings = {}
    const testPlaceholders = selectedTestIds.map((id, index) => {
      testBindings[`test${index}`] = { type: sql.UniqueIdentifier, value: id }
      return `@test${index}`
    })
    const testsDb = await withRequest(testBindings)
    const testsResult = await testsDb.query(`
      SELECT id, question_count FROM dbo.ResourceBookTopicTests WHERE id IN (${testPlaceholders.join(', ')});
    `)
    const questionCountByTestId = new Map(testsResult.recordset.map((row) => [row.id, row.question_count]))

    let totalCompleted = 0
    let totalCorrect = 0
    let totalWrong = 0
    let totalBlank = 0
    let allGraded = true

    for (const testId of selectedTestIds) {
      const questionCount = questionCountByTestId.get(testId) || 0
      const testAnswers = answers[testId] || {}
      const answeredCount = Object.keys(testAnswers).length
      totalCompleted += Math.min(answeredCount, questionCount)

      if (questionCount > 0 && answeredCount >= questionCount) {
        const keyDb = await withRequest({ testId: { type: sql.UniqueIdentifier, value: testId } })
        const keyResult = await keyDb.query(`
          SELECT order_no, correct_label FROM dbo.TestAnswerKeys WHERE test_id = @testId ORDER BY order_no ASC;
        `)

        if (keyResult.recordset.length === questionCount) {
          let correct = 0
          let wrong = 0
          keyResult.recordset.forEach((row) => {
            const studentLabel = testAnswers[String(row.order_no)]
            if (!studentLabel) return
            if (studentLabel === row.correct_label.trim()) correct += 1
            else wrong += 1
          })
          const blank = questionCount - correct - wrong
          results[testId] = { correct, wrong, blank, gradedAt: new Date().toISOString() }
          totalCorrect += correct
          totalWrong += wrong
          totalBlank += blank
          continue
        }
      }

      delete results[testId]
      allGraded = false
    }

    const nextStatus = allGraded ? 'tamamlandi' : totalCompleted > 0 ? 'devam-ediyor' : 'bekliyor'

    const updateDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: taskId },
      answersJson: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(answers) },
      testResultsJson: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(results) },
      completedQuestionCount: { type: sql.Int, value: totalCompleted },
      correctCount: { type: sql.Int, value: totalCorrect },
      wrongCount: { type: sql.Int, value: totalWrong },
      blankCount: { type: sql.Int, value: totalBlank },
      status: { type: sql.NVarChar(30), value: nextStatus },
      completedAt: { type: sql.DateTime2, value: allGraded ? new Date() : null },
    })
    await updateDb.query(`
      UPDATE dbo.Tasks
      SET answers_json = @answersJson,
          test_results_json = @testResultsJson,
          completed_question_count = @completedQuestionCount,
          correct_count = @correctCount,
          wrong_count = @wrongCount,
          blank_count = @blankCount,
          status = @status,
          completed_at = @completedAt
      WHERE id = @id;
    `)

    const fetchDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: taskId } })
    const fetchResult = await fetchDb.query(`${SELECT_TASK} WHERE t.id = @id;`)

    return json(200, { task: sanitizeTask(fetchResult.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('saveTaskAnswersHandler failed', error)
    return json(500, { error: 'Cevaplar kaydedilemedi.' })
  }
}

async function getWeeklyPlanStatusHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const weekStart = request.query.get('weekStart')
    if (!weekStart) {
      return json(400, { error: 'weekStart zorunludur.' })
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      weekStart: { type: sql.Date, value: weekStart },
    })
    const result = await requestDb.query(`
      SELECT TOP 1 status FROM dbo.WeeklyPlanStatuses WHERE student_id = @studentId AND week_start_date = @weekStart;
    `)

    if (result.recordset[0]) {
      return json(200, { status: result.recordset[0].status })
    }

    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)

    const liveDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      weekStart: { type: sql.Date, value: weekStart },
      weekEnd: { type: sql.Date, value: weekEnd.toISOString().slice(0, 10) },
    })
    const liveResult = await liveDb.query(`
      SELECT TOP 1 id FROM dbo.Tasks
      WHERE student_id = @studentId AND is_draft = 0 AND date BETWEEN @weekStart AND @weekEnd;
    `)

    return json(200, { status: liveResult.recordset[0] ? 'yayinlandi' : 'taslak' })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('getWeeklyPlanStatusHandler failed', error)
    return json(401, { error: 'Oturum geçersiz.' })
  }
}

async function setWeeklyPlanStatusHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

    const weekStart = payload?.weekStart
    const status = payload?.status
    if (!weekStart || !status) {
      return json(400, { error: 'weekStart ve status zorunludur.' })
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      weekStart: { type: sql.Date, value: weekStart },
      status: { type: sql.NVarChar(20), value: status },
    })
    const updateResult = await requestDb.query(`
      UPDATE dbo.WeeklyPlanStatuses SET status = @status
      WHERE student_id = @studentId AND week_start_date = @weekStart;
    `)

    if (!updateResult.rowsAffected[0]) {
      const insertDb = await withRequest({
        studentId: { type: sql.UniqueIdentifier, value: studentId },
        weekStart: { type: sql.Date, value: weekStart },
        status: { type: sql.NVarChar(20), value: status },
      })
      await insertDb.query(`
        INSERT INTO dbo.WeeklyPlanStatuses (student_id, week_start_date, status)
        VALUES (@studentId, @weekStart, @status);
      `)
    }

    return json(200, { status })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('setWeeklyPlanStatusHandler failed', error)
    return json(500, { error: 'Plan durumu güncellenemedi.' })
  }
}

module.exports = {
  listTasksHandler,
  getTaskHandler,
  createTaskHandler,
  updateTaskHandler,
  deleteTaskHandler,
  getTaskAnswerSheetHandler,
  saveTaskAnswersHandler,
  getWeeklyPlanStatusHandler,
  setWeeklyPlanStatusHandler,
}
