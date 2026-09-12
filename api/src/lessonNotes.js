const { sql, withRequest } = require('./db')
const { json, clearSessionHeaders } = require('./http')
const { readSessionToken, verifySessionToken, isSessionError } = require('./security')
const { requireAdmin } = require('./admin')
const { requireStudentContext } = require('./studentScope')
const { requireTeacherSession } = require('./teacherScope')
const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validateNote(p) {
  const date = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v
  if (!p || !/^(?:[1-9]|1[0-2])$/.test(p.grade) || !guid.test(p.subjectId || '')) return 'Geçerli sınıf ve ders seçin.'
  if (typeof p.title !== 'string' || !p.title.trim() || p.title.length > 200) return 'Ana başlık 1–200 karakter olmalı.'
  if (!date(p.weekStart) || !date(p.weekEnd) || p.weekEnd < p.weekStart) return 'Geçerli ders haftası tarihleri girin.'
  if (!Array.isArray(p.topics) || !p.topics.length || p.topics.length > 100 || p.topics.some(t => typeof t !== 'string' || !t.trim() || t.length > 500)) return 'En az bir alt başlık girin (en fazla 100).'
  if (!Array.isArray(p.images) || !p.images.length || p.images.length > 20 || p.images.some(i => typeof i !== 'string' || i.length > 7000000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(i)) || p.images.join('').length > 28000000) return 'PNG, JPG veya WEBP yükleyin; sayfa başına 5 MB, toplam 20 MB sınırı vardır.'
  return null
}
async function scope(request) {
  const token = readSessionToken(request)
  if (!token) return { error: json(401, { error: 'Oturum bulunamadı.' }) }
  const session = verifySessionToken(token)
  if (session.role === 'ogretmen') {
    const auth = await requireTeacherSession(request)
    if (auth.error) return auth
    const db = await withRequest({ id: { type: sql.UniqueIdentifier, value: auth.teacherUserId } })
    const rows = await db.query(`SELECT DISTINCT p.grade, st.subject_id AS subjectId
      FROM dbo.StudentTeachers st JOIN dbo.StudentProfiles p ON p.student_id = st.student_id
      JOIN dbo.Schools s ON s.id = p.school_id JOIN dbo.Users u ON u.id = st.student_id
      WHERE st.teacher_user_id = @id AND st.is_active = 1 AND u.is_active = 1
      AND s.name COLLATE Latin1_General_100_CI_AI LIKE N'%bilfen%'`)
    return { contexts: rows.recordset }
  }
  const auth = await requireStudentContext(request)
  if (auth.error) return auth
  const db = await withRequest({ id: { type: sql.UniqueIdentifier, value: session.role === 'ebeveyn' ? session.sub : auth.studentId } })
  const rows = await db.query(`SELECT p.grade, s.name AS schoolName FROM dbo.StudentProfiles p
    JOIN dbo.Schools s ON s.id = p.school_id JOIN dbo.Users u ON u.id = p.student_id
    WHERE (p.student_id = @id OR u.parent_id = @id) AND u.is_active = 1
    AND s.name COLLATE Latin1_General_100_CI_AI LIKE N'%bilfen%'`)
  return { contexts: rows.recordset }
}
const protect = handler => async request => {
  try { return await handler(request) } catch (error) {
    if (isSessionError(error)) return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    console.error('lessonNotes failed', error)
    return json(500, { error: 'Ders notları işlemi tamamlanamadı.' })
  }
}
const list = admin => protect(async request => {
  const access = admin ? await requireAdmin(request) : await scope(request)
  if (access.error) return access.error
  const db = await withRequest()
  const subjects = (await db.query('SELECT id, name, grades_json FROM dbo.Subjects WHERE is_active = 1 ORDER BY name')).recordset
  const contexts = admin ? Array.from({ length: 12 }, (_, i) => ({ grade: String(i + 1) })) : access.contexts
  const courses = contexts.flatMap(c => subjects.filter(s => (!c.subjectId || s.id === c.subjectId) && (!s.grades_json || JSON.parse(s.grades_json).map(String).includes(String(c.grade)))).map(s => ({ grade: String(c.grade), subjectId: s.id, subjectName: s.name })))
  const unique = [...new Map(courses.map(c => [`${c.grade}:${c.subjectId}`, c])).values()]
  if (request.query.get('access') === '1') return json(200, { enabled: contexts.length > 0 })
  const grade = request.query.get('grade')
  const subjectId = request.query.get('subjectId')
  if (!grade || !subjectId) return json(200, { courses: unique, notes: [] })
  if (!unique.some(c => c.grade === grade && c.subjectId === subjectId)) return json(403, { error: 'Bu sınıf ve derse erişiminiz yok.' })
  const noteDb = await withRequest({ grade: { type: sql.NVarChar(20), value: grade }, subjectId: { type: sql.UniqueIdentifier, value: subjectId } })
  const rows = await noteDb.query(`SELECT id, title, CONVERT(varchar(10), week_start, 23) AS weekStart,
    CONVERT(varchar(10), week_end, 23) AS weekEnd, topics_json, images_json FROM dbo.LessonNotes
    WHERE grade = @grade AND subject_id = @subjectId ORDER BY week_start DESC, title`)
  return json(200, { courses: unique, notes: rows.recordset.map(r => ({ id: r.id, title: r.title, weekStart: r.weekStart, weekEnd: r.weekEnd, topics: JSON.parse(r.topics_json), images: JSON.parse(r.images_json) })) })
})
const save = protect(async request => {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  const p = await request.json().catch(() => null)
  const error = validateNote(p)
  if (error) return json(400, { error })
  if (p.id && !guid.test(p.id)) return json(400, { error: 'Geçersiz kayıt.' })
  const db = await withRequest({ id: { type: sql.UniqueIdentifier, value: p.id || null }, grade: { type: sql.NVarChar(20), value: String(p.grade) }, subjectId: { type: sql.UniqueIdentifier, value: p.subjectId }, title: { type: sql.NVarChar(200), value: p.title.trim() }, start: { type: sql.Date, value: p.weekStart }, end: { type: sql.Date, value: p.weekEnd }, topics: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(p.topics.map(t => t.trim())) }, images: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(p.images) } })
  const result = await db.query(`IF NOT EXISTS (SELECT 1 FROM dbo.Subjects WHERE id = @subjectId AND is_active = 1 AND (grades_json IS NULL OR EXISTS (SELECT 1 FROM OPENJSON(grades_json) WHERE value = @grade)))
    THROW 50001, 'Invalid subject grade', 1;
    IF @id IS NULL
    INSERT dbo.LessonNotes (grade, subject_id, title, week_start, week_end, topics_json, images_json) OUTPUT inserted.id VALUES (@grade, @subjectId, @title, @start, @end, @topics, @images);
    ELSE UPDATE dbo.LessonNotes SET grade=@grade, subject_id=@subjectId, title=@title, week_start=@start, week_end=@end, topics_json=@topics, images_json=@images OUTPUT inserted.id WHERE id=@id;`)
  return result.recordset.length ? json(200, { ok: true }) : json(404, { error: 'Kayıt bulunamadı.' })
})
const remove = protect(async request => {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  if (!guid.test(request.params.id || '')) return json(400, { error: 'Geçersiz kayıt.' })
  const db = await withRequest({ id: { type: sql.UniqueIdentifier, value: request.params.id } })
  await db.query('DELETE FROM dbo.LessonNotes WHERE id = @id')
  return json(200, { ok: true })
})
module.exports = { panelLessonNotes: list(false), adminLessonNotes: list(true), saveLessonNote: save, deleteLessonNote: remove, validateNote }
