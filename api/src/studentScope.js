const { sql, withRequest } = require('./db')
const { json } = require('./http')
const { readSessionToken, verifySessionToken } = require('./security')

const CONSENT_REQUIRED_ERROR = {
  error: 'Devam etmek için KVKK ve aydınlatma metnini onaylamalısınız.',
  code: 'CONSENT_REQUIRED',
}

/**
 * Resolves which student's data a request may act on.
 * - A student session (own or entered-via-parent) is scoped to itself.
 * - A parent session must specify studentId (query or body) and own that student;
 *   omitting it defaults to the parent's first student (by created_at ASC).
 */
async function requireStudentContext(request, { studentId: bodyStudentId } = {}) {
  const token = readSessionToken(request)
  if (!token) {
    return { error: json(401, { error: 'Oturum bulunamadı.' }) }
  }

  const session = verifySessionToken(token)

  const requestDb = await withRequest({
    id: { type: sql.UniqueIdentifier, value: session.sub },
  })
  const result = await requestDb.query(`
    SELECT TOP 1 id, role, parent_id, funded_by_teacher_id, aydinlatma_accepted_at, kvkk_accepted_at
    FROM dbo.Users WHERE id = @id;
  `)
  const record = result.recordset[0]
  if (!record) {
    return { error: json(401, { error: 'Oturum geçersiz.' }) }
  }

  const actor = {
    actorId: session.actingParentId || record.id,
    actorRole: session.actingParentId ? 'ebeveyn' : record.role,
  }

  if (record.role === 'ogrenci') {
    if (!record.aydinlatma_accepted_at || !record.kvkk_accepted_at) {
      return { error: json(403, CONSENT_REQUIRED_ERROR) }
    }
    return { studentId: record.id, ...actor }
  }

  if (record.role !== 'ebeveyn') {
    return { error: json(403, { error: 'Bu alana erişim yetkiniz yok.' }) }
  }

  if (!record.aydinlatma_accepted_at || !record.kvkk_accepted_at) {
    return { error: json(403, CONSENT_REQUIRED_ERROR) }
  }

  const requestedStudentId = bodyStudentId || request.query.get('studentId')

  if (requestedStudentId) {
    const ownershipDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: requestedStudentId },
      parentId: { type: sql.UniqueIdentifier, value: session.sub },
    })
    const ownershipResult = await ownershipDb.query(`
      SELECT TOP 1 id, funded_by_teacher_id FROM dbo.Users WHERE id = @studentId AND parent_id = @parentId;
    `)
    const ownedStudent = ownershipResult.recordset[0]
    if (!ownedStudent) {
      return { error: json(404, { error: 'Öğrenci bulunamadı.' }) }
    }
    return { studentId: requestedStudentId, ...actor }
  }

  const firstStudentDb = await withRequest({
    parentId: { type: sql.UniqueIdentifier, value: session.sub },
  })
  const firstStudentResult = await firstStudentDb.query(`
    SELECT TOP 1 id, funded_by_teacher_id FROM dbo.Users WHERE parent_id = @parentId ORDER BY created_at ASC;
  `)
  const firstStudent = firstStudentResult.recordset[0]
  if (!firstStudent) {
    return { error: json(404, { error: 'Bağlı öğrenci bulunamadı.' }) }
  }

  return { studentId: firstStudent.id, ...actor }
}

/**
 * Historically this rejected parent write attempts on a teacher-funded ("restricted") student.
 * That restriction was removed: a parent added by a teacher now has full rights over that child,
 * exactly like a parent who bought their own plan. Kept as a thin alias so existing write-path
 * callers keep a distinct, self-documenting entry point.
 */
async function requireStudentWriteContext(request, options = {}) {
  return requireStudentContext(request, options)
}

module.exports = { requireStudentContext, requireStudentWriteContext }
