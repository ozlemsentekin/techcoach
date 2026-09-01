const { sql, withRequest } = require('./db')
const { clearSessionHeaders, json } = require('./http')
const { readSessionToken, verifySessionToken } = require('./security')

const CONSENT_REQUIRED_ERROR = {
  error: 'Devam etmek için KVKK ve aydınlatma metnini onaylamalısınız.',
  code: 'CONSENT_REQUIRED',
}

/**
 * Kitaplık (özel kaynak rafı) aktörünü doğrular. Veli, öğretmen ve öğrenci hesapları
 * kullanabilir; admin her özel kaynağı görür/siler. Dönen `manageableStudentIds`,
 * aktörün "üçgeninde" olduğu — yani veli olarak yönettiği / öğretmen olarak ders verdiği /
 * öğrenci olarak kendisi olan — öğrencilerin kümesidir. Görünürlük ve atama yetkisi bu
 * kümeye dayanır.
 */
async function requireBookshelfActor(request) {
  const token = readSessionToken(request)
  if (!token) {
    return { error: json(401, { error: 'Oturum bulunamadı.' }) }
  }

  const session = verifySessionToken(token)
  const actorId = session.actingParentId || session.sub
  // Veli, bir çocuğunun "öğrenci görünümüne" geçtiğinde (actingParentId dolu) Kitaplık'ı
  // yalnızca o öğrencinin üçgeni kadar görür: velinin admin denetim yetkisi ya da başka
  // çocukları/kendi eklediği kaynaklar bu bağlama sızmaz.
  const isActingAsStudent = Boolean(session.actingParentId)
  const viewedStudentId = isActingAsStudent ? session.sub : null

  const requestDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: actorId } })
  const result = await requestDb.query(`
    SELECT TOP 1 id, role, is_admin, aydinlatma_accepted_at, kvkk_accepted_at
    FROM dbo.Users WHERE id = @id;
  `)
  const record = result.recordset[0]
  if (!record) {
    return { error: json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders()) }
  }

  const role = session.actingParentId ? 'ebeveyn' : record.role
  if (!['ebeveyn', 'ogretmen', 'ogrenci'].includes(role)) {
    return { error: json(403, { error: 'Bu alana erişim yetkiniz yok.' }) }
  }
  if (!record.aydinlatma_accepted_at || !record.kvkk_accepted_at) {
    return { error: json(403, CONSENT_REQUIRED_ERROR) }
  }

  const isAdmin = Boolean(record.is_admin) && !isActingAsStudent
  const manageableStudentIds = isActingAsStudent
    ? new Set([String(viewedStudentId).toLowerCase()])
    : await fetchManageableStudentIds(actorId, role)

  return { session, actorId, role, isAdmin, isActingAsStudent, manageableStudentIds }
}

async function fetchManageableStudentIds(actorId, role) {
  if (role === 'ogrenci') {
    return new Set([String(actorId).toLowerCase()])
  }

  const db = await withRequest({ actorId: { type: sql.UniqueIdentifier, value: actorId } })
  const query =
    role === 'ogretmen'
      ? `SELECT DISTINCT student_id AS id FROM dbo.StudentTeachers
         WHERE teacher_user_id = @actorId AND is_active = 1`
      : `SELECT id FROM dbo.Users WHERE parent_id = @actorId`
  const result = await db.query(query)
  return new Set(result.recordset.map((row) => String(row.id).toLowerCase()))
}

/**
 * Bir öğretmenin belirli bir öğrenci için StudentTeachers satır id'sini döndürür
 * (StudentTeacherResourceBooks FK'si için gerekli). Öğretmenin o öğrenciyle birden
 * fazla aktif ders ilişkisi varsa ilki alınır.
 */
async function fetchStudentTeacherId(teacherUserId, studentId) {
  const db = await withRequest({
    teacherUserId: { type: sql.UniqueIdentifier, value: teacherUserId },
    studentId: { type: sql.UniqueIdentifier, value: studentId },
  })
  const result = await db.query(`
    SELECT TOP 1 id FROM dbo.StudentTeachers
    WHERE teacher_user_id = @teacherUserId AND student_id = @studentId AND is_active = 1
    ORDER BY created_at ASC;
  `)
  return result.recordset[0]?.id || null
}

module.exports = { requireBookshelfActor, fetchManageableStudentIds, fetchStudentTeacherId }
