const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { json } = require('./http')
const { isSessionError } = require('./security')
const { requireStudentContext } = require('./studentScope')

function toISODate(value) {
  if (!value) return null
  return value instanceof Date ? value.toISOString().slice(0, 10) : value
}

function sanitizeParentMessage(record) {
  return {
    id: record.id,
    studentId: record.student_id,
    title: record.title || '',
    body: record.body,
    displayDate: toISODate(record.display_date),
    expiresAt: record.expires_at,
    linkedTaskId: record.linked_task_id,
    priority: record.priority,
    isActive: Boolean(record.is_active),
    createdAt: record.created_at,
    readAt: record.read_at,
  }
}

function sanitizeDailySelection(record) {
  if (!record) return null
  return {
    date: toISODate(record.date),
    messageId: record.message_id,
    category: record.category,
    source: record.source,
    switchCount: record.switch_count,
  }
}

async function listParentMessagesHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const result = await requestDb.query(`
      SELECT id, student_id, title, body, display_date, expires_at, linked_task_id, priority, is_active, created_at, read_at
      FROM dbo.ParentMotivationMessages
      WHERE student_id = @studentId
      ORDER BY created_at ASC;
    `)

    return json(200, { messages: result.recordset.map(sanitizeParentMessage) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('listParentMessagesHandler failed', error)
    return json(500, { error: 'Ebeveyn mesajları yüklenemedi.' })
  }
}

async function createParentMessageHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

    const body = payload?.body?.trim()
    const displayDate = payload?.displayDate
    if (!body) {
      return json(400, { error: 'Mesaj metni boş olamaz.' })
    }
    if (!displayDate) {
      return json(400, { error: 'Görüntülenme tarihi zorunludur.' })
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      title: { type: sql.NVarChar(200), value: payload?.title || null },
      body: { type: sql.NVarChar(1000), value: body },
      displayDate: { type: sql.Date, value: displayDate },
      expiresAt: { type: sql.DateTime2, value: payload?.expiresAt || null },
      linkedTaskId: { type: sql.UniqueIdentifier, value: payload?.linkedTaskId || null },
      priority: { type: sql.NVarChar(20), value: payload?.priority || 'normal' },
    })
    const result = await requestDb.query(`
      INSERT INTO dbo.ParentMotivationMessages (student_id, title, body, display_date, expires_at, linked_task_id, priority)
      OUTPUT inserted.id, inserted.student_id, inserted.title, inserted.body, inserted.display_date, inserted.expires_at,
             inserted.linked_task_id, inserted.priority, inserted.is_active, inserted.created_at, inserted.read_at
      VALUES (@studentId, @title, @body, @displayDate, @expiresAt, @linkedTaskId, @priority);
    `)

    return json(201, { message: sanitizeParentMessage(result.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('createParentMessageHandler failed', error)
    return json(500, { error: 'Mesaj oluşturulamadı.' })
  }
}

async function updateParentMessageHandler(request) {
  try {
    const messageId = request.params.messageId
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

    const setClauses = []
    const bindings = {
      id: { type: sql.UniqueIdentifier, value: messageId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    }

    if (payload?.isActive !== undefined) {
      setClauses.push('is_active = @isActive')
      bindings.isActive = { type: sql.Bit, value: Boolean(payload.isActive) }
    }
    if (payload?.readAt !== undefined) {
      setClauses.push('read_at = @readAt')
      bindings.readAt = { type: sql.DateTime2, value: payload.readAt }
    }

    if (setClauses.length === 0) {
      return json(400, { error: 'Güncellenecek alan bulunamadı.' })
    }

    const requestDb = await withRequest(bindings)
    const result = await requestDb.query(`
      UPDATE dbo.ParentMotivationMessages SET ${setClauses.join(', ')} WHERE id = @id AND student_id = @studentId;
    `)

    if (!result.rowsAffected[0]) {
      return json(404, { error: 'Mesaj bulunamadı.' })
    }

    const fetchDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: messageId } })
    const fetchResult = await fetchDb.query(`
      SELECT id, student_id, title, body, display_date, expires_at, linked_task_id, priority, is_active, created_at, read_at
      FROM dbo.ParentMotivationMessages WHERE id = @id;
    `)

    return json(200, { message: sanitizeParentMessage(fetchResult.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('updateParentMessageHandler failed', error)
    return json(500, { error: 'Mesaj güncellenemedi.' })
  }
}

async function addMotivationFeedbackHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

    const messageId = payload?.messageId
    const reaction = payload?.reaction
    if (!messageId || !reaction) {
      return json(400, { error: 'messageId ve reaction zorunludur.' })
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      messageId: { type: sql.NVarChar(100), value: messageId },
      reaction: { type: sql.NVarChar(30), value: reaction },
    })
    await requestDb.query(`
      INSERT INTO dbo.MotivationFeedback (student_id, message_id, reaction)
      VALUES (@studentId, @messageId, @reaction);
    `)

    return json(201, { success: true })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('addMotivationFeedbackHandler failed', error)
    return json(500, { error: 'Geri bildirim kaydedilemedi.' })
  }
}

async function getDailySelectionHandler(request) {
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
      SELECT date, message_id, category, source, switch_count
      FROM dbo.MotivationDailySelections WHERE student_id = @studentId AND date = @date;
    `)

    return json(200, { selection: sanitizeDailySelection(result.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('getDailySelectionHandler failed', error)
    return json(500, { error: 'Günlük seçim yüklenemedi.' })
  }
}

async function setDailySelectionHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

    const date = payload?.date
    if (!date) {
      return json(400, { error: 'Tarih zorunludur.' })
    }

    const updateDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      date: { type: sql.Date, value: date },
      messageId: { type: sql.NVarChar(100), value: payload?.messageId || null },
      category: { type: sql.NVarChar(50), value: payload?.category || null },
      source: { type: sql.NVarChar(20), value: payload?.source || null },
    })
    const updateResult = await updateDb.query(`
      UPDATE dbo.MotivationDailySelections
      SET message_id = @messageId, category = @category, source = @source
      WHERE student_id = @studentId AND date = @date;
    `)

    if (!updateResult.rowsAffected[0]) {
      const insertDb = await withRequest({
        studentId: { type: sql.UniqueIdentifier, value: studentId },
        date: { type: sql.Date, value: date },
        messageId: { type: sql.NVarChar(100), value: payload?.messageId || null },
        category: { type: sql.NVarChar(50), value: payload?.category || null },
        source: { type: sql.NVarChar(20), value: payload?.source || null },
      })
      await insertDb.query(`
        INSERT INTO dbo.MotivationDailySelections (student_id, date, message_id, category, source)
        VALUES (@studentId, @date, @messageId, @category, @source);
      `)
    }

    const fetchDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      date: { type: sql.Date, value: date },
    })
    const fetchResult = await fetchDb.query(`
      SELECT date, message_id, category, source, switch_count
      FROM dbo.MotivationDailySelections WHERE student_id = @studentId AND date = @date;
    `)

    return json(200, { selection: sanitizeDailySelection(fetchResult.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('setDailySelectionHandler failed', error)
    return json(500, { error: 'Seçim kaydedilemedi.' })
  }
}

async function incrementSwitchCountHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

    const date = payload?.date
    if (!date) {
      return json(400, { error: 'Tarih zorunludur.' })
    }

    const updateDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      date: { type: sql.Date, value: date },
    })
    const updateResult = await updateDb.query(`
      UPDATE dbo.MotivationDailySelections SET switch_count = switch_count + 1
      WHERE student_id = @studentId AND date = @date;
    `)

    if (!updateResult.rowsAffected[0]) {
      const insertDb = await withRequest({
        studentId: { type: sql.UniqueIdentifier, value: studentId },
        date: { type: sql.Date, value: date },
      })
      await insertDb.query(`
        INSERT INTO dbo.MotivationDailySelections (student_id, date, switch_count) VALUES (@studentId, @date, 1);
      `)
    }

    const fetchDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      date: { type: sql.Date, value: date },
    })
    const fetchResult = await fetchDb.query(`
      SELECT date, message_id, category, source, switch_count
      FROM dbo.MotivationDailySelections WHERE student_id = @studentId AND date = @date;
    `)

    return json(200, { selection: sanitizeDailySelection(fetchResult.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('incrementSwitchCountHandler failed', error)
    return json(500, { error: 'Güncellenemedi.' })
  }
}

module.exports = {
  listParentMessagesHandler,
  createParentMessageHandler,
  updateParentMessageHandler,
  addMotivationFeedbackHandler,
  getDailySelectionHandler,
  setDailySelectionHandler,
  incrementSwitchCountHandler,
}
