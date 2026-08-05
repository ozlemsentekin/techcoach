const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { json } = require('./http')
const { isSessionError } = require('./security')
const { requireStudentContext, requireStudentWriteContext } = require('./studentScope')
const { recordTaskActivities } = require('./taskActivity')
const { sanitizeWrongQuestion } = require('./progress')

// Öğrencinin cevabını bilmediği bir soruyu bilinçli olarak "boş" işaretlemesini temsil eder.
// Cevaplanmamış (key hiç yok) durumdan farklıdır: bu işaret "cevaplandı" sayılır (tamamlama
// sayacına ve testin tam cevaplanma şartına dahil olur) ama notlama sırasında hep boş sayılır.
const BLANK_ANSWER_LABEL = '-'

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
    homeworkId: record.homework_id || undefined,
    subject: record.subject || undefined,
    topic: record.topic || undefined,
    startTime: record.start_time,
    endTime: record.end_time,
    durationMinutes: record.duration_minutes,
    timerStartedAt: record.timer_started_at,
    timerStoppedAt: record.timer_stopped_at,
    timerElapsedSeconds: record.timer_elapsed_seconds ?? undefined,
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
    resourceBookName: record.resource_book_name || undefined,
    resourceType: record.resource_type || undefined,
    hasAnswerKey: record.has_answer_key === null || record.has_answer_key === undefined ? undefined : Boolean(record.has_answer_key),
    publisherName: record.publisher_name || undefined,
    selectedTestIds: record.selected_test_ids_json ? JSON.parse(record.selected_test_ids_json) : undefined,
    answers: record.answers_json ? JSON.parse(record.answers_json) : undefined,
    testResults: record.test_results_json ? JSON.parse(record.test_results_json) : undefined,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

// Ödevden oluşturulmuş bir görevin (bkz. homework.js createTaskForHomework) ilerleme/durumu
// değiştiğinde, aynı bilgiyi bağlı olduğu dbo.Homeworks satırına da yazar; aksi halde Ödevler
// sayfası hep atama anındaki (genelde 0/bekliyor) donuk değerleri gösterir. due_date'i de
// senkronize ediyoruz çünkü RescheduleTaskModal görevi başka bir güne taşıdığında sadece
// dbo.Tasks.date güncelleniyordu; bu da ödevin Ödevlerim'de hâlâ eski günün altında görünüp
// Bugün planındaki yeni günden kopmasına yol açıyordu.
async function syncHomeworkCompletion(taskRecord) {
  if (!taskRecord?.homework_id) return

  const homeworkDb = await withRequest({
    id: { type: sql.UniqueIdentifier, value: taskRecord.homework_id },
    completedQuestionCount: { type: sql.Int, value: taskRecord.completed_question_count ?? 0 },
    status: { type: sql.NVarChar(20), value: taskRecord.status },
    dueDate: { type: sql.Date, value: taskRecord.date },
  })
  await homeworkDb.query(`
    UPDATE dbo.Homeworks
    SET completed_question_count = @completedQuestionCount, status = @status, due_date = @dueDate
    WHERE id = @id;
  `)
}

// Bir görevin soru bankası test seçimi (dolayısıyla target_question_count'u) değiştiğinde,
// bağlı olduğu dbo.Homeworks.total_question_count'u da senkron tutar; aksi halde Ödevlerim
// sayfası testi kaldırılmadan önceki eski soru toplamını göstermeye devam eder.
async function syncHomeworkQuestionTotal(taskRecord) {
  if (!taskRecord?.homework_id) return

  const homeworkDb = await withRequest({
    id: { type: sql.UniqueIdentifier, value: taskRecord.homework_id },
    totalQuestionCount: { type: sql.Int, value: taskRecord.target_question_count ?? 0 },
  })
  await homeworkDb.query(`
    UPDATE dbo.Homeworks
    SET total_question_count = @totalQuestionCount
    WHERE id = @id;
  `)
}

const SELECT_TASK = `
  SELECT t.id, t.student_id, t.is_draft, t.date, t.title, t.task_type, t.homework_id, t.subject, t.topic, t.start_time, t.end_time, t.duration_minutes,
         t.timer_started_at, t.timer_stopped_at, t.timer_elapsed_seconds,
         t.target_question_count, t.completed_question_count, t.target_page_count, t.completed_page_count,
         t.current_page_number, t.priority, t.status, t.description, t.parent_note, t.created_by,
         t.notes, t.completed_at, t.rescheduled_from, t.rescheduled_to, t.reschedule_reason, t.correct_count, t.wrong_count,
         t.blank_count, t.difficulty, t.emotion, t.reflection_answers_json, t.completed_sub_goals_json,
         t.resource_book_id, t.selected_test_ids_json, t.answers_json, t.test_results_json, rb.name AS resource_book_name, rb.resource_type, rb.has_answer_key, p.name AS publisher_name,
         t.created_at, t.updated_at
  FROM dbo.Tasks t
  LEFT JOIN dbo.ResourceBooks rb ON rb.id = t.resource_book_id
  LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
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
  timerStartedAt: (v) => ({ column: 'timer_started_at', type: sql.DateTime2, value: v || null }),
  timerStoppedAt: (v) => ({ column: 'timer_stopped_at', type: sql.DateTime2, value: v || null }),
  timerElapsedSeconds: (v) => ({ column: 'timer_elapsed_seconds', type: sql.Int, value: v === null ? null : Math.max(0, Number(v) || 0) }),
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

const STUDENT_ACTIVITY_ACTOR_ROLE = 'ogrenci'
const SYSTEM_ACTIVITY_ACTOR_ROLE = 'sistem'
const DONE_STATUSES = new Set(['tamamlandi', 'kismen-tamamlandi'])
const BREAK_TASK_TYPES = new Set(['mola', 'dinlenme', 'yemek', 'yemek-dinlenme'])
// Bu proje şimdilik yalnızca TR kullanıcıları için çalışıyor; sunucu (Azure Functions) UTC'de
// koşuyor ama date/start_time/end_time kolonları TR yerel duvar saati olarak saklanıyor.
// TR, 2016'dan beri yaz saati uygulamıyor, bu yüzden sabit +3 saatlik ofset güvenli.
const TR_UTC_OFFSET_MS = 3 * 60 * 60 * 1000

// Süresi (date + end_time) geçmiş ama hâlâ 'bekliyor' durumundaki mola/dinlenme/yemek
// görevlerini otomatik 'tamamlandi' yapar ve bunu 'sistem' aktörüyle loglar; böylece
// "İşlem Logları" panelinde öğrencinin kendisinin mi yoksa sürenin dolmasıyla sistemin mi
// bitirdiği ayırt edilebilir. Öğrencinin "Bitir" butonuyla yaptığı manuel tamamlama zaten
// recordStudentTaskUpdateActivities üzerinden 'ogrenci' aktörüyle loglanıyor.
async function autoCompleteExpiredBreaks({ studentId, date, isDraft }) {
  if (isDraft) return

  const selectDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    date: { type: sql.Date, value: date },
  })
  const pending = await selectDb.query(`
    SELECT id, title, subject, task_type, date, start_time, end_time
    FROM dbo.Tasks
    WHERE student_id = @studentId AND date = @date AND is_draft = 0
      AND task_type IN ('mola', 'dinlenme', 'yemek', 'yemek-dinlenme')
      AND status = 'bekliyor';
  `)

  if (!pending.recordset.length) return

  const nowLocal = new Date(Date.now() + TR_UTC_OFFSET_MS)
  const todayLocalDate = nowLocal.toISOString().slice(0, 10)
  const nowLocalTime = nowLocal.toISOString().slice(11, 16)

  const expired = pending.recordset.filter((row) => {
    if (!BREAK_TASK_TYPES.has(row.task_type)) return false
    const rowDate = toISODate(row.date)
    if (rowDate < todayLocalDate) return true
    if (rowDate === todayLocalDate) return row.end_time <= nowLocalTime
    return false
  })

  if (!expired.length) return

  const completedAt = new Date().toISOString()

  for (const row of expired) {
    const updateDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: row.id },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      completedAt: { type: sql.DateTime2, value: completedAt },
    })
    const updateResult = await updateDb.query(`
      UPDATE dbo.Tasks
      SET status = 'tamamlandi', completed_at = @completedAt
      WHERE id = @id AND student_id = @studentId AND status = 'bekliyor';
    `)

    if (!updateResult.rowsAffected[0]) continue

    await recordTaskActivities({
      studentId,
      taskId: row.id,
      actorRole: SYSTEM_ACTIVITY_ACTOR_ROLE,
      actorUserId: null,
      entries: [{
        action: 'task_completed',
        metadata: {
          taskTitle: row.title || 'Görev',
          taskSummary: row.title || 'Görev',
          taskType: row.task_type,
          subject: row.subject || undefined,
          taskDate: toISODate(row.date),
          startTime: row.start_time,
          previousStatus: 'bekliyor',
          nextStatus: 'tamamlandi',
          auto: true,
        },
      }],
    })
  }
}

function hasPayloadField(payload, key) {
  return Object.prototype.hasOwnProperty.call(payload || {}, key)
}

function getDescriptionLines(task) {
  return (task?.description || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function getTaskSummary(task) {
  return getDescriptionLines(task)[0] || task?.title || 'Görev'
}

function valuesDiffer(previousValue, nextValue) {
  if (previousValue instanceof Date || nextValue instanceof Date) {
    const previousTime = previousValue ? new Date(previousValue).getTime() : null
    const nextTime = nextValue ? new Date(nextValue).getTime() : null
    return previousTime !== nextTime
  }

  return previousValue !== nextValue
}

function taskActivityMetadata(task, previousTask, extra = {}) {
  return {
    taskTitle: task.title || 'Görev',
    taskSummary: getTaskSummary(task),
    taskDate: task.date,
    startTime: task.startTime,
    taskType: task.taskType,
    subject: task.subject,
    previousStatus: previousTask?.status,
    nextStatus: task.status,
    ...extra,
  }
}

function buildProgressDetail(task) {
  if (task.completedQuestionCount !== undefined) {
    const target = task.targetQuestionCount ? ` / ${task.targetQuestionCount}` : ''
    return `${task.completedQuestionCount}${target} soru`
  }

  if (task.completedPageCount !== undefined) {
    const target = task.targetPageCount ? ` / ${task.targetPageCount}` : ''
    return `${task.completedPageCount}${target} sayfa`
  }

  return ''
}

function buildTaskUpdateActivities(previousTask, nextTask, payload) {
  const entries = []
  const timerStarted = hasPayloadField(payload, 'timerStartedAt') && nextTask.timerStartedAt && valuesDiffer(previousTask.timerStartedAt, nextTask.timerStartedAt)
  const timerStopped = hasPayloadField(payload, 'timerStoppedAt') && nextTask.timerStoppedAt && valuesDiffer(previousTask.timerStoppedAt, nextTask.timerStoppedAt)
  const statusChanged = previousTask.status !== nextTask.status
  const completedNow = DONE_STATUSES.has(nextTask.status) && (statusChanged || (!previousTask.completedAt && nextTask.completedAt))

  if (timerStarted) {
    entries.push({
      action: 'timer_started',
      metadata: taskActivityMetadata(nextTask, previousTask),
    })
  }

  if (statusChanged && nextTask.status === 'devam-ediyor' && !timerStarted) {
    entries.push({
      action: 'task_started',
      metadata: taskActivityMetadata(nextTask, previousTask),
    })
  }

  if (completedNow) {
    entries.push({
      action: nextTask.status === 'kismen-tamamlandi' ? 'task_partially_completed' : 'task_completed',
      metadata: taskActivityMetadata(nextTask, previousTask, {
        detail: buildProgressDetail(nextTask),
        completedQuestionCount: nextTask.completedQuestionCount,
        completedPageCount: nextTask.completedPageCount,
        elapsedSeconds: nextTask.timerElapsedSeconds,
      }),
    })
  }

  if (timerStopped) {
    entries.push({
      action: 'timer_stopped',
      metadata: taskActivityMetadata(nextTask, previousTask, {
        elapsedSeconds: nextTask.timerElapsedSeconds,
      }),
    })
  }

  if (statusChanged && nextTask.status === 'bekliyor' && DONE_STATUSES.has(previousTask.status)) {
    entries.push({
      action: 'task_reopened',
      metadata: taskActivityMetadata(nextTask, previousTask),
    })
  }

  if (statusChanged && nextTask.status === 'yardim-bekliyor') {
    entries.push({
      action: 'help_requested',
      metadata: taskActivityMetadata(nextTask, previousTask),
    })
  }

  if (statusChanged && nextTask.status === 'yeniden-planlandi') {
    entries.push({
      action: 'task_rescheduled',
      metadata: taskActivityMetadata(nextTask, previousTask, {
        detail: nextTask.rescheduledTo ? `${nextTask.rescheduledTo} zamanına taşındı` : '',
      }),
    })
  }

  const questionProgressChanged =
    hasPayloadField(payload, 'completedQuestionCount') &&
    valuesDiffer(previousTask.completedQuestionCount, nextTask.completedQuestionCount)
  const pageProgressChanged =
    hasPayloadField(payload, 'completedPageCount') &&
    valuesDiffer(previousTask.completedPageCount, nextTask.completedPageCount)

  if (!completedNow && (questionProgressChanged || pageProgressChanged)) {
    entries.push({
      action: 'progress_updated',
      metadata: taskActivityMetadata(nextTask, previousTask, {
        detail: buildProgressDetail(nextTask),
        completedQuestionCount: nextTask.completedQuestionCount,
        completedPageCount: nextTask.completedPageCount,
      }),
    })
  }

  return entries
}

async function recordStudentTaskUpdateActivities({ previousRecord, nextRecord, payload, actorRole, actorId }) {
  if (actorRole !== STUDENT_ACTIVITY_ACTOR_ROLE || !previousRecord || !nextRecord) return

  const previousTask = sanitizeTask(previousRecord)
  const nextTask = sanitizeTask(nextRecord)
  const entries = buildTaskUpdateActivities(previousTask, nextTask, payload)

  await recordTaskActivities({
    studentId: nextTask.studentId,
    taskId: nextTask.id,
    actorRole,
    actorUserId: actorId,
    entries,
  })
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

    await autoCompleteExpiredBreaks({ studentId, date, isDraft })

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

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('listTasksHandler failed', error)
    return json(500, { error: 'Görevler yüklenemedi.' })
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

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('getTaskHandler failed', error)
    return json(500, { error: 'Görev yüklenemedi.' })
  }
}

async function createTaskHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentWriteContext(request, { studentId: payload?.studentId })
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
    const { error, studentId, actorRole, actorId } = await requireStudentWriteContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

    const previousDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: taskId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const previousResult = await previousDb.query(`
      ${SELECT_TASK}
      WHERE t.id = @id AND t.student_id = @studentId;
    `)
    const previousRecord = previousResult.recordset[0]
    if (!previousRecord) {
      return json(404, { error: 'Görev bulunamadı.' })
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
    await syncHomeworkCompletion(fetchResult.recordset[0])
    await recordStudentTaskUpdateActivities({
      previousRecord,
      nextRecord: fetchResult.recordset[0],
      payload,
      actorRole,
      actorId,
    })

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
    const { error, studentId } = await requireStudentWriteContext(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: taskId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const result = await requestDb.query(`
      DELETE FROM dbo.Tasks
      OUTPUT deleted.homework_id
      WHERE id = @id AND student_id = @studentId;
    `)

    if (!result.recordset.length) {
      return json(404, { error: 'Görev bulunamadı.' })
    }

    // Görev bir ödeve bağlıysa (homework_id dolu), arkasında kalan dbo.Homeworks satırı
    // görünmeden dururdu ve aynı kaynak/test/tarih için yeni ödev eklemeyi "zaten eklenmiş"
    // diyerek engellerdi (bkz. homework.js createHomeworkHandler'daki tekrar kontrolü).
    // Bu yüzden bağlı ödev kaydını da burada temizliyoruz.
    const homeworkId = result.recordset[0].homework_id
    if (homeworkId) {
      const homeworkDb = await withRequest({
        id: { type: sql.UniqueIdentifier, value: homeworkId },
        studentId: { type: sql.UniqueIdentifier, value: studentId },
      })
      await homeworkDb.query(`
        DELETE FROM dbo.Homeworks WHERE id = @id AND student_id = @studentId;
      `)
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
// getTaskAnswerSheetHandler (öğrenci) ve panel-teacher'daki salt okunur öğretmen görünümü
// aynı sorgu mantığını paylaşır; auth/scope kontrolü çağıran handler'a ait olduğundan burada
// sadece taskId + studentId ile veri çekilir.
async function fetchTaskAnswerSheetData(taskId, studentId) {
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
    return null
  }

  const testIds = taskRecord.selected_test_ids_json ? JSON.parse(taskRecord.selected_test_ids_json) : []
  if (!testIds.length) {
    return { tests: [], photos: {} }
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

  const photosDb = await withRequest({ taskId: { type: sql.UniqueIdentifier, value: taskId } })
  const photosResult = await photosDb.query(`
    SELECT test_id, question_number, photo_url FROM dbo.WrongQuestions
    WHERE task_id = @taskId AND photo_url IS NOT NULL;
  `)
  const photos = {}
  photosResult.recordset.forEach((row) => {
    if (!row.test_id) return
    photos[row.test_id] = photos[row.test_id] || {}
    photos[row.test_id][row.question_number] = row.photo_url
  })

  return { tests, photos }
}

async function getTaskAnswerSheetHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const taskId = request.params.taskId
    const data = await fetchTaskAnswerSheetData(taskId, studentId)
    if (!data) {
      return json(404, { error: 'Görev bulunamadı.' })
    }

    return json(200, data)
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('getTaskAnswerSheetHandler failed', error)
    return json(500, { error: 'Cevap kağıdı yüklenemedi.' })
  }
}

const MAX_MISTAKE_PHOTO_LENGTH = 350000
const MISTAKE_PHOTO_DATA_URL_PATTERN = /^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=\s]+$/i

function sanitizeMistakePhoto(value) {
  const photo = typeof value === 'string' ? value.trim() : ''
  if (!photo) return { error: 'Fotoğraf zorunludur.' }
  if (photo.length > MAX_MISTAKE_PHOTO_LENGTH) {
    return { error: 'Fotoğraf çok büyük. Daha küçük bir görsel seçin.' }
  }
  if (!MISTAKE_PHOTO_DATA_URL_PATTERN.test(photo)) {
    return { error: 'Geçerli bir JPG/PNG/WEBP fotoğrafı yükleyin.' }
  }
  return { value: photo }
}

const WRONG_QUESTION_OUTPUT_COLUMNS = `
  inserted.id, inserted.student_id, inserted.task_id, inserted.test_id, inserted.subject, inserted.topic,
  inserted.test_name, inserted.book_name, inserted.publisher_name, inserted.question_number,
  inserted.error_type, inserted.student_note, inserted.review_status, inserted.resolved_at,
  inserted.photo_url, inserted.created_at
`

// Cevap kağıdında yanlış işaretlenmiş bir soruya öğrencinin galeriden seçtiği ya da kamerayla
// çektiği fotoğrafı kaydeder. testId üzerinden yayın evi/kitap/konu/test adını server tarafında
// çözer (client'a güvenmiyoruz) ve dbo.WrongQuestions'a upsert eder; Hata Defterim bu tabloyu okur.
async function saveWrongQuestionPhotoHandler(request) {
  try {
    const taskId = request.params.taskId
    const testId = request.params.testId
    const orderNo = request.params.orderNo
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentWriteContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

    const photoCheck = sanitizeMistakePhoto(payload?.photo)
    if (photoCheck.error) {
      return json(400, { error: photoCheck.error })
    }

    const taskDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: taskId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const taskResult = await taskDb.query(`
      SELECT subject, selected_test_ids_json, test_results_json, answers_json
      FROM dbo.Tasks WHERE id = @id AND student_id = @studentId;
    `)
    const taskRecord = taskResult.recordset[0]
    if (!taskRecord) {
      return json(404, { error: 'Görev bulunamadı.' })
    }

    const selectedTestIds = taskRecord.selected_test_ids_json ? JSON.parse(taskRecord.selected_test_ids_json) : []
    if (!selectedTestIds.includes(testId)) {
      return json(400, { error: 'Bu test bu göreve ait değil.' })
    }

    const results = taskRecord.test_results_json ? JSON.parse(taskRecord.test_results_json) : {}
    const answers = taskRecord.answers_json ? JSON.parse(taskRecord.answers_json) : {}
    const testResult = results[testId]
    const correctLabel = testResult?.correctLabels?.[orderNo]
    const studentAnswer = answers[testId]?.[orderNo]
    const isActuallyWrong =
      Boolean(testResult) &&
      Boolean(correctLabel) &&
      Boolean(studentAnswer) &&
      studentAnswer !== BLANK_ANSWER_LABEL &&
      studentAnswer !== correctLabel
    if (!isActuallyWrong) {
      return json(400, { error: 'Bu soru yanlış işaretlenmemiş.' })
    }

    const testInfoDb = await withRequest({ testId: { type: sql.UniqueIdentifier, value: testId } })
    const testInfoResult = await testInfoDb.query(`
      SELECT t.name AS test_name, tp.name AS topic_name, rb.name AS book_name, pub.name AS publisher_name
      FROM dbo.ResourceBookTopicTests t
      JOIN dbo.ResourceBookTopics tp ON tp.id = t.topic_id
      JOIN dbo.ResourceBooks rb ON rb.id = tp.resource_book_id
      JOIN dbo.Publishers pub ON pub.id = rb.publisher_id
      WHERE t.id = @testId;
    `)
    const testInfo = testInfoResult.recordset[0]
    if (!testInfo) {
      return json(404, { error: 'Test bulunamadı.' })
    }

    const bindings = {
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      taskId: { type: sql.UniqueIdentifier, value: taskId },
      testId: { type: sql.UniqueIdentifier, value: testId },
      questionNumber: { type: sql.NVarChar(20), value: orderNo },
      subject: { type: sql.NVarChar(100), value: taskRecord.subject || 'Genel' },
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
      WHERE student_id = @studentId AND task_id = @taskId AND test_id = @testId AND question_number = @questionNumber;
    `)

    let wrongQuestionRecord = updateResult.recordset[0]
    if (!wrongQuestionRecord) {
      const insertDb = await withRequest(bindings)
      const insertResult = await insertDb.query(`
        INSERT INTO dbo.WrongQuestions (student_id, task_id, test_id, subject, topic, test_name, book_name, publisher_name, question_number, error_type, photo_url)
        OUTPUT ${WRONG_QUESTION_OUTPUT_COLUMNS}
        VALUES (@studentId, @taskId, @testId, @subject, @topic, @testName, @bookName, @publisherName, @questionNumber, @errorType, @photoUrl);
      `)
      wrongQuestionRecord = insertResult.recordset[0]
    }

    return json(200, { wrongQuestion: sanitizeWrongQuestion(wrongQuestionRecord) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('saveWrongQuestionPhotoHandler failed', error)
    return json(500, { error: 'Fotoğraf kaydedilemedi.' })
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
    const { error, studentId, actorRole, actorId } = await requireStudentWriteContext(request, { studentId: payload?.studentId })
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
      SELECT selected_test_ids_json, answers_json, test_results_json, status, completed_at
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
      if (results[testId]) return // Değerlendirilmiş test: cevaplar kilitli, üzerine yazılamaz.

      const sanitizedAnswers = {}
      Object.entries(entry?.answers || {}).forEach(([orderNo, label]) => {
        const normalizedLabel = typeof label === 'string' ? label.trim().toUpperCase() : ''
        if (['A', 'B', 'C', 'D', BLANK_ANSWER_LABEL].includes(normalizedLabel)) {
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
          const correctLabels = {}
          keyResult.recordset.forEach((row) => {
            const correctLabel = row.correct_label.trim()
            correctLabels[String(row.order_no)] = correctLabel
            const studentLabel = testAnswers[String(row.order_no)]
            if (!studentLabel || studentLabel === BLANK_ANSWER_LABEL) return
            if (studentLabel === correctLabel) correct += 1
            else wrong += 1
          })
          const blank = questionCount - correct - wrong
          results[testId] = { correct, wrong, blank, gradedAt: new Date().toISOString(), correctLabels }
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
    await syncHomeworkCompletion(fetchResult.recordset[0])
    const finalTask = sanitizeTask(fetchResult.recordset[0])

    if (actorRole === STUDENT_ACTIVITY_ACTOR_ROLE) {
      const completedNow = allGraded && !DONE_STATUSES.has(taskRecord.status) && !taskRecord.completed_at
      await recordTaskActivities({
        studentId: finalTask.studentId,
        taskId: finalTask.id,
        actorRole,
        actorUserId: actorId,
        entries: [
          {
            action: completedNow ? 'task_completed' : 'answers_saved',
            metadata: taskActivityMetadata(finalTask, null, {
              detail: buildProgressDetail(finalTask),
              completedQuestionCount: finalTask.completedQuestionCount,
            }),
          },
        ],
      })
    }

    return json(200, { task: finalTask })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('saveTaskAnswersHandler failed', error)
    return json(500, { error: 'Cevaplar kaydedilemedi.' })
  }
}

// Öğrenilmediği anlaşılan tek bir testi (cevapları ve sonucuyla) görevden çıkarır. Test kaynağı
// (dbo.ResourceBookTopicTests) silinmez, sadece bu görevin seçim/cevap/sonuç JSON'larından düşülür;
// böylece kütüphanede kalır ve öğrenciye daha sonra ayrı bir görev olarak yeniden atanabilir.
async function removeTaskTestHandler(request) {
  try {
    const taskId = request.params.taskId
    const testId = request.params.testId
    const payload = await request.json().catch(() => null)
    const { error, studentId, actorRole, actorId } = await requireStudentWriteContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

    const taskDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: taskId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const taskResult = await taskDb.query(`
      SELECT selected_test_ids_json, answers_json, test_results_json, status, completed_at
      FROM dbo.Tasks WHERE id = @id AND student_id = @studentId;
    `)
    const taskRecord = taskResult.recordset[0]
    if (!taskRecord) {
      return json(404, { error: 'Görev bulunamadı.' })
    }

    const selectedTestIds = taskRecord.selected_test_ids_json ? JSON.parse(taskRecord.selected_test_ids_json) : []
    if (!selectedTestIds.includes(testId)) {
      return json(404, { error: 'Test bu göreve bağlı değil.' })
    }

    const answers = taskRecord.answers_json ? JSON.parse(taskRecord.answers_json) : {}
    const results = taskRecord.test_results_json ? JSON.parse(taskRecord.test_results_json) : {}
    const remainingTestIds = selectedTestIds.filter((id) => id !== testId)
    delete answers[testId]
    delete results[testId]

    let questionCountByTestId = new Map()
    if (remainingTestIds.length) {
      const testBindings = {}
      const testPlaceholders = remainingTestIds.map((id, index) => {
        testBindings[`test${index}`] = { type: sql.UniqueIdentifier, value: id }
        return `@test${index}`
      })
      const testsDb = await withRequest(testBindings)
      const testsResult = await testsDb.query(`
        SELECT id, question_count FROM dbo.ResourceBookTopicTests WHERE id IN (${testPlaceholders.join(', ')});
      `)
      questionCountByTestId = new Map(testsResult.recordset.map((row) => [row.id, row.question_count]))
    }

    let totalCompleted = 0
    let totalCorrect = 0
    let totalWrong = 0
    let totalBlank = 0
    let allGraded = remainingTestIds.length > 0

    remainingTestIds.forEach((id) => {
      const questionCount = questionCountByTestId.get(id) || 0
      const answeredCount = Object.keys(answers[id] || {}).length
      totalCompleted += Math.min(answeredCount, questionCount)

      const result = results[id]
      if (result) {
        totalCorrect += Number(result.correct) || 0
        totalWrong += Number(result.wrong) || 0
        totalBlank += Number(result.blank) || 0
      } else {
        allGraded = false
      }
    })

    const targetQuestionCount = remainingTestIds.reduce((sum, id) => sum + (questionCountByTestId.get(id) || 0), 0)
    const nextStatus = remainingTestIds.length === 0 ? 'bekliyor' : allGraded ? 'tamamlandi' : totalCompleted > 0 ? 'devam-ediyor' : 'bekliyor'

    const updateDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: taskId },
      selectedTestIdsJson: { type: sql.NVarChar(sql.MAX), value: remainingTestIds.length ? JSON.stringify(remainingTestIds) : null },
      answersJson: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(answers) },
      testResultsJson: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(results) },
      targetQuestionCount: { type: sql.Int, value: targetQuestionCount },
      completedQuestionCount: { type: sql.Int, value: totalCompleted },
      correctCount: { type: sql.Int, value: totalCorrect },
      wrongCount: { type: sql.Int, value: totalWrong },
      blankCount: { type: sql.Int, value: totalBlank },
      status: { type: sql.NVarChar(30), value: nextStatus },
      completedAt: { type: sql.DateTime2, value: nextStatus === 'tamamlandi' ? taskRecord.completed_at || new Date() : null },
    })
    await updateDb.query(`
      UPDATE dbo.Tasks
      SET selected_test_ids_json = @selectedTestIdsJson,
          answers_json = @answersJson,
          test_results_json = @testResultsJson,
          target_question_count = @targetQuestionCount,
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
    await syncHomeworkCompletion(fetchResult.recordset[0])
    await syncHomeworkQuestionTotal(fetchResult.recordset[0])
    const finalTask = sanitizeTask(fetchResult.recordset[0])

    await recordTaskActivities({
      studentId: finalTask.studentId,
      taskId: finalTask.id,
      actorRole,
      actorUserId: actorId,
      entries: [
        {
          action: 'test_removed',
          metadata: taskActivityMetadata(finalTask, null, {
            detail: buildProgressDetail(finalTask),
          }),
        },
      ],
    })

    return json(200, { task: finalTask })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('removeTaskTestHandler failed', error)
    return json(500, { error: 'Test görevden kaldırılamadı.' })
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

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('getWeeklyPlanStatusHandler failed', error)
    return json(500, { error: 'Haftalık plan durumu yüklenemedi.' })
  }
}

async function setWeeklyPlanStatusHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentWriteContext(request, { studentId: payload?.studentId })
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
  saveWrongQuestionPhotoHandler,
  removeTaskTestHandler,
  getWeeklyPlanStatusHandler,
  setWeeklyPlanStatusHandler,
  fetchTaskAnswerSheetData,
  SELECT_TASK,
  sanitizeTask,
}
