const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { json } = require('./http')
const { isSessionError } = require('./security')
const { requireParentSession } = require('./students')
const { requireTeacherSession } = require('./teacherScope')
const { teacherTaskScopeSql } = require('./teacher')

// Bildirim listesi YALNIZCA okunmamışları gösterir (zil = "yeni olanlar"): bir
// satır okunduğunda / "Tümünü okundu" ile listeden düşer. dbo.TaskActivityReads
// (activity_id, user_id) = o izleyici için okundu işareti. Geçmişe dönük tam
// aktivite dökümü için Gelişim Analizi / Haftalık Plan var.
//
// Öğrencinin kendi yaptığı, veli/öğretmen için "bildirim değeri" olan işlemler.
// dbo.TaskActivityLogs.action kümesinin bir alt kümesi (bkz. api/src/tasks.js
// buildTaskUpdateActivities). timer_*, progress_updated, answers_saved,
// test_removed, task_rescheduled ve actor_role IN ('ebeveyn','sistem') / auto
// kayıtları bilerek hariç.
const NOTIFY_ACTIONS = ['task_completed', 'task_partially_completed', 'task_started', 'help_requested']

const DEFAULT_LIMIT = 40
const MAX_LIMIT = 100
// Öğretmen akışı student_id filtresi olmadan (ilişki EXISTS'i üzerinden) çalıştığından
// taramayı sınırlamak için son N gün.
const TEACHER_LOOKBACK_DAYS = 45

function toISODate(value) {
  if (!value) return null
  return value instanceof Date ? value.toISOString().slice(0, 10) : value
}

function parseLimit(request) {
  return Math.min(MAX_LIMIT, Math.max(1, Number(request.query.get('limit')) || DEFAULT_LIMIT))
}

function notifyActionsClause(bindings) {
  return NOTIFY_ACTIONS.map((action, index) => {
    bindings[`nact${index}`] = { type: sql.NVarChar(40), value: action }
    return `@nact${index}`
  }).join(', ')
}

function sanitizeNotification(record) {
  return {
    id: record.id,
    action: record.action,
    createdAt: record.created_at,
    isRead: Boolean(record.is_read),
    studentId: record.student_id,
    studentName: record.student_name || undefined,
    taskId: record.task_id || undefined,
    studentTeacherId: record.student_teacher_id || undefined,
    taskTitle: record.task_title || 'Görev',
    taskType: record.task_type || undefined,
    subject: record.subject || undefined,
    taskDate: toISODate(record.task_date),
    startTime: record.start_time || undefined,
    resourceBookName: record.resource_book_name || undefined,
    publisherName: record.publisher_name || undefined,
    targetQuestionCount: record.target_question_count ?? undefined,
    completedQuestionCount: record.completed_question_count ?? undefined,
    correctCount: record.correct_count ?? undefined,
    wrongCount: record.wrong_count ?? undefined,
    blankCount: record.blank_count ?? undefined,
  }
}

const NOTIFICATION_SELECT_COLUMNS = `
  l.id, l.action, l.created_at, l.student_id, l.task_id,
  stu.full_name AS student_name,
  t.title AS task_title, t.task_type, t.subject, t.date AS task_date, t.start_time,
  t.target_question_count, t.completed_question_count,
  t.correct_count, t.wrong_count, t.blank_count,
  rb.name AS resource_book_name, pub.name AS publisher_name
`

const NOTIFICATION_JOINS = `
  INNER JOIN dbo.Tasks t ON t.id = l.task_id
  LEFT JOIN dbo.ResourceBooks rb ON rb.id = t.resource_book_id
  LEFT JOIN dbo.Publishers pub ON pub.id = rb.publisher_id
`

function respondEmptyOnMissingTable(error) {
  return error.number === 208
}

function handleNotificationError(error, label) {
  if (respondEmptyOnMissingTable(error)) {
    return json(200, { notifications: [], unreadCount: 0 })
  }
  if (isConfigError(error)) {
    return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
  }
  if (isSessionError(error)) {
    return json(401, { error: 'Oturum geçersiz.' })
  }
  console.error(`${label} failed`, error)
  return json(500, { error: 'Bildirimler yüklenemedi.' })
}

/* --------------------------------- Veli --------------------------------- */

async function listParentNotificationsHandler(request) {
  try {
    const { error, parentId } = await requireParentSession(request)
    if (error) return error

    const limit = parseLimit(request)
    const bindings = {
      parentId: { type: sql.UniqueIdentifier, value: parentId },
      limit: { type: sql.Int, value: limit },
    }
    const actions = notifyActionsClause(bindings)
    const requestDb = await withRequest(bindings)
    const result = await requestDb.query(`
      SELECT TOP (@limit)
             ${NOTIFICATION_SELECT_COLUMNS},
             NULL AS student_teacher_id,
             CASE WHEN ar.activity_id IS NULL THEN 0 ELSE 1 END AS is_read
      FROM dbo.TaskActivityLogs l
      INNER JOIN dbo.Users stu ON stu.id = l.student_id AND stu.parent_id = @parentId
      ${NOTIFICATION_JOINS}
      LEFT JOIN dbo.TaskActivityReads ar ON ar.activity_id = l.id AND ar.user_id = @parentId
      WHERE l.actor_role = 'ogrenci' AND l.action IN (${actions})
        AND ar.activity_id IS NULL
      ORDER BY l.created_at DESC, l.id DESC;
    `)

    const notifications = result.recordset.map(sanitizeNotification)
    return json(200, { notifications, unreadCount: notifications.length })
  } catch (error) {
    return handleNotificationError(error, 'listParentNotificationsHandler')
  }
}

async function markParentNotificationReadHandler(request) {
  try {
    const { error, parentId } = await requireParentSession(request)
    if (error) return error

    const activityId = request.params.activityId
    const requestDb = await withRequest({
      parentId: { type: sql.UniqueIdentifier, value: parentId },
      activityId: { type: sql.UniqueIdentifier, value: activityId },
    })
    await requestDb.query(`
      INSERT INTO dbo.TaskActivityReads (activity_id, user_id)
      SELECT l.id, @parentId
      FROM dbo.TaskActivityLogs l
      INNER JOIN dbo.Users stu ON stu.id = l.student_id AND stu.parent_id = @parentId
      WHERE l.id = @activityId
        AND NOT EXISTS (
          SELECT 1 FROM dbo.TaskActivityReads ar WHERE ar.activity_id = l.id AND ar.user_id = @parentId
        );
    `)

    return json(200, { success: true })
  } catch (error) {
    if (respondEmptyOnMissingTable(error)) return json(200, { success: true })
    return handleNotificationError(error, 'markParentNotificationReadHandler')
  }
}

async function markAllParentNotificationsReadHandler(request) {
  try {
    const { error, parentId } = await requireParentSession(request)
    if (error) return error

    const bindings = { parentId: { type: sql.UniqueIdentifier, value: parentId } }
    const actions = notifyActionsClause(bindings)
    const requestDb = await withRequest(bindings)
    await requestDb.query(`
      INSERT INTO dbo.TaskActivityReads (activity_id, user_id)
      SELECT l.id, @parentId
      FROM dbo.TaskActivityLogs l
      INNER JOIN dbo.Users stu ON stu.id = l.student_id AND stu.parent_id = @parentId
      WHERE l.actor_role = 'ogrenci' AND l.action IN (${actions})
        AND NOT EXISTS (
          SELECT 1 FROM dbo.TaskActivityReads ar WHERE ar.activity_id = l.id AND ar.user_id = @parentId
        );
    `)

    return json(200, { success: true })
  } catch (error) {
    if (respondEmptyOnMissingTable(error)) return json(200, { success: true })
    return handleNotificationError(error, 'markAllParentNotificationsReadHandler')
  }
}

/* ------------------------------- Öğretmen ------------------------------- */

const TEACHER_REL_CTE = `
  rel AS (
    SELECT st.id AS student_teacher_id, st.student_id, st.subject_id
    FROM dbo.StudentTeachers st
    WHERE st.teacher_user_id = @teacherUserId AND st.is_active = 1
  )
`

// rel CTE'sindeki bir ilişkinin görevi kapsayıp kapsamadığı (kolon referanslı scope).
const TEACHER_REL_SCOPE = teacherTaskScopeSql({
  studentTeacherRef: 'r.student_teacher_id',
  subjectRef: 'r.subject_id',
})

async function listTeacherNotificationsHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) return error

    const limit = parseLimit(request)
    const bindings = {
      teacherUserId: { type: sql.UniqueIdentifier, value: teacherUserId },
      limit: { type: sql.Int, value: limit },
      lookbackDays: { type: sql.Int, value: TEACHER_LOOKBACK_DAYS },
    }
    const actions = notifyActionsClause(bindings)
    const requestDb = await withRequest(bindings)
    const result = await requestDb.query(`
      WITH ${TEACHER_REL_CTE}
      SELECT TOP (@limit)
             ${NOTIFICATION_SELECT_COLUMNS},
             (
               SELECT TOP 1 r.student_teacher_id
               FROM rel r
               WHERE r.student_id = l.student_id AND ${TEACHER_REL_SCOPE}
               ORDER BY CASE WHEN t.student_teacher_id = r.student_teacher_id THEN 0 ELSE 1 END
             ) AS student_teacher_id,
             CASE WHEN ar.activity_id IS NULL THEN 0 ELSE 1 END AS is_read
      FROM dbo.TaskActivityLogs l
      INNER JOIN dbo.Users stu ON stu.id = l.student_id
      ${NOTIFICATION_JOINS}
      LEFT JOIN dbo.TaskActivityReads ar ON ar.activity_id = l.id AND ar.user_id = @teacherUserId
      WHERE l.actor_role = 'ogrenci' AND l.action IN (${actions})
        AND l.created_at >= DATEADD(day, -@lookbackDays, SYSUTCDATETIME())
        AND ar.activity_id IS NULL
        AND EXISTS (
          SELECT 1 FROM rel r
          WHERE r.student_id = l.student_id AND ${TEACHER_REL_SCOPE}
        )
      ORDER BY l.created_at DESC, l.id DESC;
    `)

    const notifications = result.recordset.map(sanitizeNotification)
    return json(200, { notifications, unreadCount: notifications.length })
  } catch (error) {
    return handleNotificationError(error, 'listTeacherNotificationsHandler')
  }
}

async function markTeacherNotificationReadHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) return error

    const activityId = request.params.activityId
    const requestDb = await withRequest({
      teacherUserId: { type: sql.UniqueIdentifier, value: teacherUserId },
      activityId: { type: sql.UniqueIdentifier, value: activityId },
    })
    await requestDb.query(`
      WITH ${TEACHER_REL_CTE}
      INSERT INTO dbo.TaskActivityReads (activity_id, user_id)
      SELECT l.id, @teacherUserId
      FROM dbo.TaskActivityLogs l
      INNER JOIN dbo.Tasks t ON t.id = l.task_id
      WHERE l.id = @activityId AND l.actor_role = 'ogrenci'
        AND EXISTS (
          SELECT 1 FROM rel r WHERE r.student_id = l.student_id AND ${TEACHER_REL_SCOPE}
        )
        AND NOT EXISTS (
          SELECT 1 FROM dbo.TaskActivityReads ar WHERE ar.activity_id = l.id AND ar.user_id = @teacherUserId
        );
    `)

    return json(200, { success: true })
  } catch (error) {
    if (respondEmptyOnMissingTable(error)) return json(200, { success: true })
    return handleNotificationError(error, 'markTeacherNotificationReadHandler')
  }
}

async function markAllTeacherNotificationsReadHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) return error

    const bindings = {
      teacherUserId: { type: sql.UniqueIdentifier, value: teacherUserId },
      lookbackDays: { type: sql.Int, value: TEACHER_LOOKBACK_DAYS },
    }
    const actions = notifyActionsClause(bindings)
    const requestDb = await withRequest(bindings)
    await requestDb.query(`
      WITH ${TEACHER_REL_CTE}
      INSERT INTO dbo.TaskActivityReads (activity_id, user_id)
      SELECT l.id, @teacherUserId
      FROM dbo.TaskActivityLogs l
      INNER JOIN dbo.Tasks t ON t.id = l.task_id
      WHERE l.actor_role = 'ogrenci' AND l.action IN (${actions})
        AND l.created_at >= DATEADD(day, -@lookbackDays, SYSUTCDATETIME())
        AND EXISTS (
          SELECT 1 FROM rel r WHERE r.student_id = l.student_id AND ${TEACHER_REL_SCOPE}
        )
        AND NOT EXISTS (
          SELECT 1 FROM dbo.TaskActivityReads ar WHERE ar.activity_id = l.id AND ar.user_id = @teacherUserId
        );
    `)

    return json(200, { success: true })
  } catch (error) {
    if (respondEmptyOnMissingTable(error)) return json(200, { success: true })
    return handleNotificationError(error, 'markAllTeacherNotificationsReadHandler')
  }
}

module.exports = {
  NOTIFY_ACTIONS,
  listParentNotificationsHandler,
  markParentNotificationReadHandler,
  markAllParentNotificationsReadHandler,
  listTeacherNotificationsHandler,
  markTeacherNotificationReadHandler,
  markAllTeacherNotificationsReadHandler,
}
