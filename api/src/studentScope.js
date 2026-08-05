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
 *
 * Also resolves `restricted`: true when the target student was added through a teacher's
 * panel quota (funded_by_teacher_id set) rather than the parent's own plan — in that case
 * the parent may only view data, not create new tasks/homeworks/plans (see requireStudentWriteContext).
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
    return { studentId: record.id, restricted: Boolean(record.funded_by_teacher_id), ...actor }
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
    return { studentId: requestedStudentId, restricted: Boolean(ownedStudent.funded_by_teacher_id), ...actor }
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

  return { studentId: firstStudent.id, restricted: Boolean(firstStudent.funded_by_teacher_id), ...actor }
}

/**
 * Same as requireStudentContext, but rejects write attempts (POST/PUT/PATCH/DELETE) made by
 * a parent on a `restricted` student — one added through a teacher's panel quota, where the
 * parent may only view the tasks/homeworks/plans that teacher defined, not create their own.
 * The student's own session is never restricted by this check.
 */
async function requireStudentWriteContext(request, options = {}) {
  const result = await requireStudentContext(request, options)
  if (result.error) {
    return result
  }

  if (result.restricted && result.actorRole === 'ebeveyn') {
    return {
      error: json(403, {
        error: 'Bu öğrenci için görev/ödev/plan eklemeye yetkiniz yok.',
        code: 'RESTRICTED_STUDENT',
      }),
    }
  }

  return result
}

module.exports = { requireStudentContext, requireStudentWriteContext }
