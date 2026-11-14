const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { clearSessionHeaders, json } = require('./http')
const { isSessionError } = require('./security')
const { requireStudentContext } = require('./studentScope')

// Veli "Çeyrek Dönem Analizi": seçili çocuğun her dersi (aktif öğretmen ilişkisi) için öğretmen,
// hata sayısı ve öğretmenin analiz ettiği hata sayısı. Veli, her dersin öğretmenine kendi
// "Hata Analizi" linkini (/teacher/students/<studentTeacherId>/hata-analizi) buradan paylaşır;
// öğretmen yalnızca kendi dersini görür (bkz. teacher.js getTeacherMistakeAnalysisSessionHandler).
async function listQuarterAnalysisHandler(request) {
  try {
    const { error, studentId, actorRole, actorId } = await requireStudentContext(request)
    if (error) return error
    if (actorRole !== 'ebeveyn') {
      return json(403, { error: 'Bu sayfa yalnızca veli içindir.' })
    }

    // Yönetici, kartlardaki "Öğretmen olarak aç" ile öğretmenin hesabına geçebilir (bkz. admin
    // impersonate); bunun için öğretmenin kullanıcı kimliği yalnızca yöneticiye döner.
    const adminDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: actorId } })
    const isAdmin = Boolean((await adminDb.query(`SELECT is_admin FROM dbo.Users WHERE id = @id;`)).recordset[0]?.is_admin)

    const db = await withRequest({ studentId: { type: sql.UniqueIdentifier, value: studentId } })
    const result = await db.query(`
      SELECT st.id, sub.name AS subject_name, st.teacher_full_name, st.teacher_type,
             st.teacher_user_id, tu.is_active AS teacher_active, tu.last_login_at AS teacher_last_login_at,
             s.full_name AS student_full_name,
             (SELECT COUNT(*) FROM dbo.WrongQuestions wq
               WHERE wq.student_id = st.student_id AND wq.subject = sub.name AND wq.photo_url IS NOT NULL) AS wrong_count,
             (SELECT COUNT(DISTINCT a.wrong_question_id)
               FROM dbo.WrongQuestionAnalyses a
               INNER JOIN dbo.WrongQuestions wq ON wq.id = a.wrong_question_id
               WHERE wq.student_id = st.student_id AND wq.subject = sub.name AND wq.photo_url IS NOT NULL
                 AND a.role = N'ogretmen' AND a.analyzed_by_user_id = st.teacher_user_id) AS analyzed_count
      FROM dbo.StudentTeachers st
      INNER JOIN dbo.Subjects sub ON sub.id = st.subject_id
      INNER JOIN dbo.Users s ON s.id = st.student_id
      LEFT JOIN dbo.Users tu ON tu.id = st.teacher_user_id
      WHERE st.student_id = @studentId AND st.is_active = 1
      ORDER BY sub.name ASC;
    `)

    return json(200, {
      studentFullName: result.recordset[0]?.student_full_name || '',
      subjects: result.recordset.map((row) => ({
        studentTeacherId: row.id,
        subjectName: row.subject_name,
        teacherFullName: row.teacher_full_name || '',
        teacherType: row.teacher_type || null,
        // Panel hesabı olmayan / pasif öğretmene link paylaşmak işe yaramaz.
        canShare: Boolean(row.teacher_user_id) && row.teacher_active !== false,
        teacherLastLoginAt: row.teacher_last_login_at || null,
        ...(isAdmin && row.teacher_user_id ? { teacherUserId: row.teacher_user_id } : {}),
        wrongCount: row.wrong_count || 0,
        analyzedCount: row.analyzed_count || 0,
      })),
    })
  } catch (error) {
    if (isConfigError(error)) return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    if (isSessionError(error)) return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    console.error('listQuarterAnalysisHandler failed', error)
    return json(500, { error: 'Çeyrek dönem analizi yüklenemedi.' })
  }
}

module.exports = { listQuarterAnalysisHandler }
