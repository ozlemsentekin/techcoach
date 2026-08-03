const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { json } = require('./http')
const { isSessionError } = require('./security')
const { requireStudentContext } = require('./studentScope')

function toISODate(value) {
  if (!value) return null
  return value instanceof Date ? value.toISOString().slice(0, 10) : value
}

function parseMetadata(value) {
  if (!value) return {}

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function sanitizeTaskActivity(record) {
  const metadata = parseMetadata(record.metadata_json)

  return {
    id: record.id,
    studentId: record.student_id,
    taskId: record.task_id || undefined,
    action: record.action,
    actorRole: record.actor_role,
    actorUserId: record.actor_user_id || undefined,
    taskTitle: record.task_title || metadata.taskTitle || record.title || 'Görev',
    taskSummary: metadata.taskSummary || metadata.taskTitle || record.title || 'Görev',
    taskType: record.task_type || metadata.taskType || undefined,
    subject: record.subject || metadata.subject || undefined,
    taskDate: toISODate(record.task_date || metadata.taskDate || record.date),
    startTime: record.start_time || metadata.startTime || undefined,
    detail: metadata.detail || '',
    elapsedSeconds: metadata.elapsedSeconds ?? undefined,
    completedQuestionCount: metadata.completedQuestionCount ?? undefined,
    completedPageCount: metadata.completedPageCount ?? undefined,
    previousStatus: metadata.previousStatus || undefined,
    nextStatus: metadata.nextStatus || undefined,
    metadata,
    createdAt: record.created_at,
  }
}

async function recordTaskActivities({ studentId, taskId, actorRole, actorUserId, entries }) {
  const activityEntries = (entries || []).filter((entry) => entry?.action)
  if (!activityEntries.length) return

  const baseTime = Date.now()

  for (const [index, entry] of activityEntries.entries()) {
    try {
      const requestDb = await withRequest({
        studentId: { type: sql.UniqueIdentifier, value: studentId },
        taskId: { type: sql.UniqueIdentifier, value: taskId },
        action: { type: sql.NVarChar(40), value: entry.action },
        actorRole: { type: sql.NVarChar(20), value: actorRole || 'ogrenci' },
        actorUserId: { type: sql.UniqueIdentifier, value: actorUserId || null },
        metadataJson: { type: sql.NVarChar(sql.MAX), value: entry.metadata ? JSON.stringify(entry.metadata) : null },
        createdAt: { type: sql.DateTime2, value: new Date(baseTime + index) },
      })

      await requestDb.query(`
        INSERT INTO dbo.TaskActivityLogs (student_id, task_id, action, actor_role, actor_user_id, metadata_json, created_at)
        VALUES (@studentId, @taskId, @action, @actorRole, @actorUserId, @metadataJson, @createdAt);
      `)
    } catch (error) {
      if (error.number !== 208) {
        console.warn('recordTaskActivities skipped', error)
      }
      return
    }
  }
}

async function listTaskActivityLogsHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const date = request.query.get('date')
    if (!date) {
      return json(400, { error: 'Tarih zorunludur.' })
    }

    const limit = Math.min(100, Math.max(1, Number(request.query.get('limit')) || 50))
    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      date: { type: sql.Date, value: date },
      limit: { type: sql.Int, value: limit },
    })
    const result = await requestDb.query(`
      SELECT TOP (@limit)
             l.id, l.student_id, l.task_id, l.action, l.actor_role, l.actor_user_id, l.metadata_json, l.created_at,
             t.title, t.task_type, t.subject, t.date, t.start_time
      FROM dbo.TaskActivityLogs l
      LEFT JOIN dbo.Tasks t ON t.id = l.task_id
      WHERE l.student_id = @studentId
        AND (
          t.date = @date
          OR (t.id IS NULL AND TRY_CONVERT(date, JSON_VALUE(l.metadata_json, '$.taskDate')) = @date)
        )
      ORDER BY l.created_at DESC, l.id DESC;
    `)

    return json(200, { logs: result.recordset.map(sanitizeTaskActivity) })
  } catch (error) {
    if (error.number === 208) {
      return json(200, { logs: [] })
    }

    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('listTaskActivityLogsHandler failed', error)
    return json(500, { error: 'İşlem logları yüklenemedi.' })
  }
}

module.exports = {
  listTaskActivityLogsHandler,
  recordTaskActivities,
}
