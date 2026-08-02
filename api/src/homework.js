const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { json } = require('./http')
const { isSessionError } = require('./security')
const { requireStudentContext } = require('./studentScope')

function toISODate(value) {
  if (!value) return null
  return value instanceof Date ? value.toISOString().slice(0, 10) : value
}

function sanitizeHomework(record) {
  return {
    id: record.id,
    studentId: record.student_id,
    subjectId: record.subject_id,
    subject: record.subject_name,
    resourceBookId: record.resource_book_id,
    resourceBookName: record.resource_book_name || null,
    resourceType: record.resource_book_type || null,
    publisherName: record.publisher_name || null,
    title: record.title,
    description: record.description || '',
    assignedDate: toISODate(record.assigned_date),
    dueDate: toISODate(record.due_date),
    totalQuestionCount: record.total_question_count,
    completedQuestionCount: record.completed_question_count,
    totalPageCount: record.total_page_count,
    priority: record.priority,
    status: record.status,
    isSplit: Boolean(record.is_split),
    dayPlans: record.day_plans_json ? JSON.parse(record.day_plans_json) : [],
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

// Parent bir tarih seçtiyse, öğrencinin o güne ait canlı plan görev listesinde de görünmesi için
// dbo.Homeworks satırına eşlik eden bir dbo.Tasks satırı oluşturur (taslak değil, canlı).
// resourceBookId + testIds burada aktarılır ki soru bankası görevlerinde dijital cevap kağıdı
// (bkz. tasks.js getTaskAnswerSheetHandler) gerçek test/soru sayısına ve cevap anahtarına erişebilsin.
async function createTaskForHomework(studentId, homework, taskDate, resourceBookId, testIds) {
  try {
    const durationMinutes = Math.min(60, Math.max(20, homework.totalQuestionCount || 20))
    const startMinutes = 16 * 60
    const endMinutes = startMinutes + durationMinutes
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`
    const sanitizedTestIds = Array.isArray(testIds) ? testIds.filter((id) => typeof id === 'string' && id) : []

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      date: { type: sql.Date, value: taskDate },
      title: { type: sql.NVarChar(200), value: `${homework.subject} Ödevi` },
      description: { type: sql.NVarChar(1000), value: homework.title },
      subject: { type: sql.NVarChar(100), value: homework.subject },
      taskType: { type: sql.NVarChar(40), value: 'odev' },
      startTime: { type: sql.Char(5), value: '16:00' },
      endTime: { type: sql.Char(5), value: endTime },
      durationMinutes: { type: sql.Int, value: durationMinutes },
      targetQuestionCount: { type: sql.Int, value: homework.totalQuestionCount || null },
      resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId || null },
      selectedTestIdsJson: { type: sql.NVarChar(sql.MAX), value: sanitizedTestIds.length ? JSON.stringify(sanitizedTestIds) : null },
      targetPageCount: { type: sql.Int, value: homework.resourceType === 'okuma_kitabi' ? homework.totalPageCount || null : null },
      homeworkId: { type: sql.UniqueIdentifier, value: homework.id },
    })

    await requestDb.query(`
      INSERT INTO dbo.Tasks (
        student_id, date, title, description, subject, task_type, start_time, end_time,
        duration_minutes, target_question_count, completed_question_count, is_draft,
        resource_book_id, selected_test_ids_json, target_page_count, completed_page_count, homework_id
      )
      VALUES (
        @studentId, @date, @title, @description, @subject, @taskType, @startTime, @endTime,
        @durationMinutes, @targetQuestionCount, 0, 0,
        @resourceBookId, @selectedTestIdsJson, @targetPageCount, 0, @homeworkId
      );
    `)
  } catch (error) {
    console.error('createTaskForHomework failed', error)
  }
}

const SELECT_HOMEWORK = `
  SELECT h.id, h.student_id, h.subject_id, s.name AS subject_name, h.resource_book_id, rb.name AS resource_book_name,
         rb.resource_type AS resource_book_type, p.name AS publisher_name,
         h.title, h.description, h.assigned_date, h.due_date, h.total_question_count, h.completed_question_count,
         h.total_page_count,
         h.priority, h.status, h.is_split, h.day_plans_json, h.created_at, h.updated_at
  FROM dbo.Homeworks h
  INNER JOIN dbo.Subjects s ON s.id = h.subject_id
  LEFT JOIN dbo.ResourceBooks rb ON rb.id = h.resource_book_id
  LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
`

async function listHomeworksHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const result = await requestDb.query(`
      ${SELECT_HOMEWORK}
      WHERE h.student_id = @studentId
      ORDER BY h.due_date ASC;
    `)

    return json(200, { homeworks: result.recordset.map(sanitizeHomework) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('listHomeworksHandler failed', error)
    return json(500, { error: 'Ödevler yüklenemedi.' })
  }
}

async function createHomeworkHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

    const subjectId = payload?.subjectId
    const resourceBookId = payload?.resourceBookId || null
    const testIds = Array.isArray(payload?.testIds) ? payload.testIds : []
    const title = payload?.title?.trim()
    const description = payload?.description?.trim() || null
    const assignedDate = payload?.assignedDate
    const dueDate = payload?.dueDate
    const totalQuestionCount = Number(payload?.totalQuestionCount) || 0
    const totalPageCount = payload?.totalPageCount != null ? Number(payload.totalPageCount) || 0 : null
    const priority = payload?.priority || 'orta'
    const dayPlans = Array.isArray(payload?.dayPlans) ? payload.dayPlans : []
    const taskDate = payload?.taskDate || null

    if (!subjectId) {
      return json(400, { error: 'Ders seçilmeli.' })
    }
    if (!title || title.length < 2) {
      return json(400, { error: 'Ödev başlığı en az 2 karakter olmalı.' })
    }
    if (!assignedDate || !dueDate) {
      return json(400, { error: 'Tarih bilgileri zorunludur.' })
    }

    const duplicateCheckDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      subjectId: { type: sql.UniqueIdentifier, value: subjectId },
      resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId },
      description: { type: sql.NVarChar(1000), value: description },
    })
    const duplicateResult = await duplicateCheckDb.query(`
      SELECT TOP 1 h.id
      FROM dbo.Homeworks h
      WHERE h.student_id = @studentId
        AND h.subject_id = @subjectId
        AND (
          (h.resource_book_id = @resourceBookId)
          OR (h.resource_book_id IS NULL AND @resourceBookId IS NULL)
        )
        AND h.description = @description;
    `)
    if (duplicateResult.recordset.length) {
      return json(409, { error: 'Bu kaynak ve test için zaten bir ödev eklenmiş.' })
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      subjectId: { type: sql.UniqueIdentifier, value: subjectId },
      resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId },
      title: { type: sql.NVarChar(200), value: title },
      description: { type: sql.NVarChar(1000), value: description },
      assignedDate: { type: sql.Date, value: assignedDate },
      dueDate: { type: sql.Date, value: dueDate },
      totalQuestionCount: { type: sql.Int, value: totalQuestionCount },
      totalPageCount: { type: sql.Int, value: totalPageCount },
      priority: { type: sql.NVarChar(20), value: priority },
      isSplit: { type: sql.Bit, value: dayPlans.length > 1 },
      dayPlansJson: { type: sql.NVarChar(sql.MAX), value: dayPlans.length ? JSON.stringify(dayPlans) : null },
    })

    const result = await requestDb.query(`
      INSERT INTO dbo.Homeworks (
        student_id, subject_id, resource_book_id, title, description, assigned_date, due_date,
        total_question_count, total_page_count, priority, is_split, day_plans_json
      )
      OUTPUT inserted.id
      VALUES (
        @studentId, @subjectId, @resourceBookId, @title, @description, @assignedDate, @dueDate,
        @totalQuestionCount, @totalPageCount, @priority, @isSplit, @dayPlansJson
      );
    `)

    const insertedId = result.recordset[0].id

    const fetchDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: insertedId },
    })
    const fetchResult = await fetchDb.query(`
      ${SELECT_HOMEWORK}
      WHERE h.id = @id;
    `)

    const homework = sanitizeHomework(fetchResult.recordset[0])
    if (taskDate) {
      await createTaskForHomework(studentId, homework, taskDate, resourceBookId, testIds)
    }

    return json(201, { homework })
  } catch (error) {
    if (error.number === 547) {
      return json(400, { error: 'Seçilen ders veya kaynak bulunamadı.' })
    }

    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('createHomeworkHandler failed', error)
    return json(500, { error: 'Ödev oluşturulamadı.' })
  }
}

async function updateHomeworkHandler(request) {
  try {
    const homeworkId = request.params.homeworkId
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

    const updates = []
    const bindings = {
      id: { type: sql.UniqueIdentifier, value: homeworkId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    }

    if (payload?.completedQuestionCount !== undefined) {
      updates.push('completed_question_count = @completedQuestionCount')
      bindings.completedQuestionCount = { type: sql.Int, value: Number(payload.completedQuestionCount) || 0 }
    }
    if (payload?.status !== undefined) {
      updates.push('status = @status')
      bindings.status = { type: sql.NVarChar(20), value: payload.status }
    }
    if (payload?.title !== undefined) {
      updates.push('title = @title')
      bindings.title = { type: sql.NVarChar(200), value: payload.title.trim() }
    }
    if (payload?.dueDate !== undefined) {
      updates.push('due_date = @dueDate')
      bindings.dueDate = { type: sql.Date, value: payload.dueDate }
    }

    if (updates.length === 0) {
      return json(400, { error: 'Güncellenecek alan bulunamadı.' })
    }

    const requestDb = await withRequest(bindings)
    const result = await requestDb.query(`
      UPDATE dbo.Homeworks
      SET ${updates.join(', ')}
      WHERE id = @id AND student_id = @studentId;
    `)

    if (!result.rowsAffected[0]) {
      return json(404, { error: 'Ödev bulunamadı.' })
    }

    const fetchDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: homeworkId },
    })
    const fetchResult = await fetchDb.query(`
      ${SELECT_HOMEWORK}
      WHERE h.id = @id;
    `)

    return json(200, { homework: sanitizeHomework(fetchResult.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('updateHomeworkHandler failed', error)
    return json(500, { error: 'Ödev güncellenemedi.' })
  }
}

async function deleteHomeworkHandler(request) {
  try {
    const homeworkId = request.params.homeworkId
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: homeworkId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const result = await requestDb.query(`
      DELETE FROM dbo.Homeworks WHERE id = @id AND student_id = @studentId;
    `)

    if (!result.rowsAffected[0]) {
      return json(404, { error: 'Ödev bulunamadı.' })
    }

    return json(200, { success: true })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('deleteHomeworkHandler failed', error)
    return json(500, { error: 'Ödev silinemedi.' })
  }
}

module.exports = {
  listHomeworksHandler,
  createHomeworkHandler,
  updateHomeworkHandler,
  deleteHomeworkHandler,
}
