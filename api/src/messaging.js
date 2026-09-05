const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { json } = require('./http')
const { isSessionError } = require('./security')
const { requireStudentContext } = require('./studentScope')

function toISODate(value) {
  if (!value) return null
  return value instanceof Date ? value.toISOString().slice(0, 10) : value
}

function sanitizeCoachNote(record) {
  return {
    id: record.id,
    studentId: record.student_id,
    text: record.text,
    createdAt: record.created_at,
  }
}

function sanitizeStudentRequest(record) {
  return {
    id: record.id,
    studentId: record.student_id,
    type: record.type,
    message: record.message,
    proposedDate: toISODate(record.proposed_date),
    proposedTime: record.proposed_time,
    status: record.status,
    createdAt: record.created_at,
  }
}

async function listCoachNotesHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const result = await requestDb.query(`
      SELECT id, student_id, text, created_at
      FROM (
        SELECT TOP (200) id, student_id, text, created_at
        FROM dbo.CoachNotes
        WHERE student_id = @studentId
        ORDER BY created_at DESC
      ) recent
      ORDER BY created_at ASC;
    `)

    return json(200, { notes: result.recordset.map(sanitizeCoachNote) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('listCoachNotesHandler failed', error)
    return json(500, { error: 'Öğretmen notları yüklenemedi.' })
  }
}

async function addCoachNoteHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

    const text = payload?.text?.trim()
    if (!text) {
      return json(400, { error: 'Not metni boş olamaz.' })
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      text: { type: sql.NVarChar(1000), value: text },
    })
    const result = await requestDb.query(`
      INSERT INTO dbo.CoachNotes (student_id, text)
      OUTPUT inserted.id, inserted.student_id, inserted.text, inserted.created_at
      VALUES (@studentId, @text);
    `)

    return json(201, { note: sanitizeCoachNote(result.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('addCoachNoteHandler failed', error)
    return json(500, { error: 'Not eklenemedi.' })
  }
}

async function listStudentRequestsHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const result = await requestDb.query(`
      SELECT id, student_id, type, message, proposed_date, proposed_time, status, created_at
      FROM dbo.StudentRequests
      WHERE student_id = @studentId
      ORDER BY created_at DESC;
    `)

    return json(200, { requests: result.recordset.map(sanitizeStudentRequest) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('listStudentRequestsHandler failed', error)
    return json(500, { error: 'Öğrenci talepleri yüklenemedi.' })
  }
}

async function updateStudentRequestHandler(request) {
  try {
    const requestId = request.params.requestId
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

    const status = payload?.status
    if (!status) {
      return json(400, { error: 'Durum zorunludur.' })
    }

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: requestId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      status: { type: sql.NVarChar(20), value: status },
    })
    const result = await requestDb.query(`
      UPDATE dbo.StudentRequests SET status = @status WHERE id = @id AND student_id = @studentId;
    `)

    if (!result.rowsAffected[0]) {
      return json(404, { error: 'İstek bulunamadı.' })
    }

    const fetchDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: requestId } })
    const fetchResult = await fetchDb.query(`
      SELECT id, student_id, type, message, proposed_date, proposed_time, status, created_at
      FROM dbo.StudentRequests WHERE id = @id;
    `)

    return json(200, { request: sanitizeStudentRequest(fetchResult.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('updateStudentRequestHandler failed', error)
    return json(500, { error: 'İstek güncellenemedi.' })
  }
}

module.exports = {
  listCoachNotesHandler,
  addCoachNoteHandler,
  listStudentRequestsHandler,
  updateStudentRequestHandler,
}
