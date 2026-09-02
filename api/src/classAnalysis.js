const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { clearSessionHeaders, json } = require('./http')
const { isSessionError } = require('./security')
const { requireTeacherSession } = require('./teacherScope')
const { loadStudentProgressOverview } = require('./teacher')

// Sınıfsız öğrenciler için sekme/sorgu sentineli (frontend ile ortak).
const UNSPECIFIED_GRADE = '__none__'

// DB bağlantı havuzunu zorlamamak için öğrenci gelişim yüklemelerini bu kadarlık
// parçalar halinde paralel çalıştırır.
const CHUNK_SIZE = 4

function handleError(error, label, fallback) {
  if (isConfigError(error)) {
    return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
  }
  if (isSessionError(error)) {
    return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
  }
  console.error(`${label} failed`, error)
  return json(500, { error: fallback })
}

async function inChunks(items, size, worker) {
  const results = []
  for (let index = 0; index < items.length; index += size) {
    const slice = items.slice(index, index + size)
    results.push(...(await Promise.all(slice.map(worker))))
  }
  return results
}

/**
 * Sınıf Analizi: öğretmenin seçili sınıftaki (StudentProfiles.grade) tüm aktif
 * öğrencileri için tek-öğrenci analiz sayfasıyla aynı ham gelişim verisini döner.
 * Frontend (ClassAnalysisPage) bu ham veriyi progressAnalytics yardımcılarıyla
 * öğrenci ve sınıf düzeyinde toplar.
 */
async function getTeacherClassAnalysisHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) return error

    const grade = (request.query.get('grade') || '').trim()
    if (!grade) {
      return json(400, { error: 'Sınıf belirtilmeli.' })
    }

    const isUnspecified = grade === UNSPECIFIED_GRADE
    const bindings = { teacherUserId: { type: sql.UniqueIdentifier, value: teacherUserId } }
    if (!isUnspecified) bindings.grade = { type: sql.NVarChar(20), value: grade }

    const gradeWhere = isUnspecified
      ? "(sp.grade IS NULL OR LTRIM(RTRIM(sp.grade)) = '')"
      : 'LTRIM(RTRIM(sp.grade)) = @grade'

    const requestDb = await withRequest(bindings)
    const result = await requestDb.query(`
      SELECT st.id AS student_teacher_id, st.student_id, st.subject_id,
             u.full_name AS student_full_name, s.name AS subject_name,
             sp.photo_url AS student_photo_url
      FROM dbo.StudentTeachers st
      INNER JOIN dbo.Users u ON u.id = st.student_id
      LEFT JOIN dbo.Subjects s ON s.id = st.subject_id
      LEFT JOIN dbo.StudentProfiles sp ON sp.student_id = st.student_id
      WHERE st.teacher_user_id = @teacherUserId AND st.is_active = 1 AND ${gradeWhere}
      ORDER BY u.full_name ASC;
    `)

    // Aynı öğrencinin birden çok branşı olabilir; öğrenci başına tek kayıt bırak
    // (loadStudentProgressOverview zaten o öğrencinin tüm aktif branşlarını birleştiriyor).
    const seen = new Set()
    const roster = result.recordset.filter((row) => {
      if (seen.has(row.student_id)) return false
      seen.add(row.student_id)
      return true
    })

    const students = await inChunks(roster, CHUNK_SIZE, async (row) => ({
      studentTeacherId: row.student_teacher_id,
      studentFullName: row.student_full_name,
      studentPhotoUrl: row.student_photo_url || null,
      subjectName: row.subject_name || null,
      overview: await loadStudentProgressOverview({
        studentId: row.student_id,
        subjectId: row.subject_id,
        studentTeacherId: row.student_teacher_id,
        teacherUserId,
      }),
    }))

    return json(200, { grade, students })
  } catch (error) {
    return handleError(error, 'getTeacherClassAnalysisHandler', 'Sınıf analizi yüklenemedi.')
  }
}

module.exports = { getTeacherClassAnalysisHandler, UNSPECIFIED_GRADE }
