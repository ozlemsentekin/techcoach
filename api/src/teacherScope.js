const { sql, withRequest } = require('./db')
const { json } = require('./http')
const { readSessionToken, verifySessionToken } = require('./security')

/**
 * Öğretmenin genel (öğrenciden bağımsız) oturumunu doğrular. Öğrencilerim,
 * Velilerim, Ders Planım gibi listeleme uçlarında kullanılır.
 */
async function requireTeacherSession(request) {
  const token = readSessionToken(request)
  if (!token) {
    return { error: json(401, { error: 'Oturum bulunamadı.' }) }
  }

  const session = verifySessionToken(token)
  const requestDb = await withRequest({
    id: { type: sql.UniqueIdentifier, value: session.sub },
  })
  const result = await requestDb.query(`
    SELECT TOP 1 id, role, full_name, phone_number, is_admin FROM dbo.Users WHERE id = @id;
  `)
  const record = result.recordset[0]
  if (!record) {
    return { error: json(401, { error: 'Oturum geçersiz.' }) }
  }
  if (record.role !== 'ogretmen') {
    return { error: json(403, { error: 'Bu alana erişim yetkiniz yok.' }) }
  }

  return {
    teacherUserId: record.id,
    teacherFullName: record.full_name,
    teacherPhone: record.phone_number,
    isAdmin: Boolean(record.is_admin),
  }
}

/**
 * Öğretmenin belirli bir (öğrenci, ders) ilişkisine erişimini doğrular.
 * studentTeacherId = dbo.StudentTeachers.id — bu satırın teacher_user_id'si
 * oturum sahibi öğretmene ait olmalı. Dönen subjectId, çağıran handler'ların
 * SQL'de öğretmenin sadece kendi dersine ait veriyi görmesini/yönetmesini
 * garanti etmek için kullanılır.
 */
async function requireTeacherStudentContext(request, { studentTeacherId: bodyId, includeInactive = false } = {}) {
  const token = readSessionToken(request)
  if (!token) {
    return { error: json(401, { error: 'Oturum bulunamadı.' }) }
  }

  const session = verifySessionToken(token)
  const studentTeacherId = bodyId || request.params.studentTeacherId || request.query.get('studentTeacherId')
  if (!studentTeacherId) {
    return { error: json(400, { error: 'Öğrenci bağlantısı belirtilmeli.' }) }
  }

  const requestDb = await withRequest({
    id: { type: sql.UniqueIdentifier, value: studentTeacherId },
    teacherUserId: { type: sql.UniqueIdentifier, value: session.sub },
  })
  const result = await requestDb.query(`
    SELECT st.id, st.student_id, st.subject_id, st.teacher_type, st.is_active, u.full_name AS student_full_name
    FROM dbo.StudentTeachers st
    INNER JOIN dbo.Users u ON u.id = st.student_id
    WHERE st.id = @id AND st.teacher_user_id = @teacherUserId
      ${includeInactive ? '' : 'AND st.is_active = 1'};
  `)
  const record = result.recordset[0]
  if (!record) {
    return { error: json(404, { error: 'Öğrenci bulunamadı.' }) }
  }

  return {
    studentId: record.student_id,
    subjectId: record.subject_id,
    studentTeacherId: record.id,
    studentFullName: record.student_full_name,
    teacherType: record.teacher_type,
    isActive: Boolean(record.is_active),
    actorId: session.sub,
    actorRole: 'ogretmen',
  }
}

module.exports = { requireTeacherSession, requireTeacherStudentContext }
