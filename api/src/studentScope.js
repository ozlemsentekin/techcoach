const { sql, withRequest } = require('./db')
const { accountDisabledResponse, json } = require('./http')
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
  const requestedStudentId = bodyStudentId || request.query.get('studentId')

  // Tek round-trip: kullanıcı kaydı + (veli & studentId verilmişse) sahiplik denetimi +
  // (veli & studentId yoksa) ilk çocuk — hepsi tek sorguda. Eskiden veli yolu 2 ayrı
  // sorgu atıyordu; her panel isteği auth için o kadar Azure SQL gidiş-dönüşü yapıyordu
  // ve "Bugün"/"Haftalık Plan" gibi paralel çok istekli ekranlarda bu gecikme birikiyordu.
  const requestDb = await withRequest({
    id: { type: sql.UniqueIdentifier, value: session.sub },
    requestedStudentId: { type: sql.UniqueIdentifier, value: requestedStudentId || null },
  })
  const result = await requestDb.query(`
    SELECT TOP 1
      u.id, u.role, u.parent_id, u.is_active, u.aydinlatma_accepted_at, u.kvkk_accepted_at,
      owned.id AS owned_student_id,
      first_child.id AS first_child_id
    FROM dbo.Users u
    OUTER APPLY (
      SELECT TOP 1 s.id
      FROM dbo.Users s
      WHERE @requestedStudentId IS NOT NULL AND s.id = @requestedStudentId AND s.parent_id = u.id
    ) owned
    OUTER APPLY (
      SELECT TOP 1 s.id
      FROM dbo.Users s
      WHERE @requestedStudentId IS NULL AND s.parent_id = u.id
      ORDER BY s.created_at ASC
    ) first_child
    WHERE u.id = @id;
  `)
  const record = result.recordset[0]
  if (!record) {
    return { error: json(401, { error: 'Oturum geçersiz.' }) }
  }
  if (record.is_active === false) {
    return { error: accountDisabledResponse() }
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

  if (requestedStudentId) {
    if (!record.owned_student_id) {
      return { error: json(404, { error: 'Öğrenci bulunamadı.' }) }
    }
    return { studentId: requestedStudentId, ...actor }
  }

  if (!record.first_child_id) {
    return { error: json(404, { error: 'Bağlı öğrenci bulunamadı.' }) }
  }

  return { studentId: record.first_child_id, ...actor }
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
