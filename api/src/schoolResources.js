const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { clearSessionHeaders, json } = require('./http')
const { isSessionError } = require('./security')
const { requireAdmin } = require('./admin')
const { requireStudentContext } = require('./studentScope')
const { requireTeacherStudentContext } = require('./teacherScope')

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const GRADE_OPTIONS = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'])
const MAX_RESOURCE_NAME_LENGTH = 200
const MAX_RESOURCE_IMAGE_LENGTH = 350000
const RESOURCE_IMAGE_DATA_URL_PATTERN = /^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=\s]+$/i

function isGuid(value) {
  return typeof value === 'string' && GUID_PATTERN.test(value.trim())
}

// dbo.ResourceBooks.image_url ile aynı kural: https URL veya data:image base64 (bkz. catalog.js).
function sanitizeImageUrl(value) {
  const imageUrl = typeof value === 'string' ? value.trim() : ''
  if (!imageUrl) return { value: null }
  if (imageUrl.length > MAX_RESOURCE_IMAGE_LENGTH) {
    return { error: 'Görsel dosyası çok büyük. Daha küçük bir görsel yükleyin.' }
  }
  if (
    imageUrl.startsWith('https://') ||
    imageUrl.startsWith('http://') ||
    RESOURCE_IMAGE_DATA_URL_PATTERN.test(imageUrl)
  ) {
    return { value: imageUrl }
  }
  return { error: 'Görsel için geçerli bir URL veya JPG/PNG/WEBP dosyası kullanılmalı.' }
}

function sanitizeResource(record) {
  return {
    id: record.id,
    schoolId: record.school_id,
    grade: record.grade,
    subjectId: record.subject_id,
    subjectName: record.subject_name || null,
    name: record.name,
    imageUrl: record.image_url || null,
    isActive: Boolean(record.is_active),
  }
}

async function listSchoolResourcesHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const schoolId = request.params.schoolId
    const grade = request.query.get('grade')
    const subjectId = request.query.get('subjectId')
    if (!isGuid(schoolId)) {
      return json(400, { error: 'Geçerli bir okul seçin.' })
    }
    if (grade && !GRADE_OPTIONS.has(grade)) {
      return json(400, { error: 'Geçerli bir sınıf seçin.' })
    }
    if (subjectId && !isGuid(subjectId)) {
      return json(400, { error: 'Geçerli bir ders seçin.' })
    }

    const requestDb = await withRequest({
      schoolId: { type: sql.UniqueIdentifier, value: schoolId },
      grade: { type: sql.NVarChar(20), value: grade || null },
      subjectId: { type: sql.UniqueIdentifier, value: subjectId || null },
    })
    const result = await requestDb.query(`
      SELECT scr.id, scr.school_id, scr.grade, scr.subject_id, s.name AS subject_name,
             scr.name, scr.image_url, scr.is_active
      FROM dbo.SchoolClassResources scr
      JOIN dbo.Subjects s ON s.id = scr.subject_id
      WHERE scr.school_id = @schoolId
        AND (@grade IS NULL OR scr.grade = @grade)
        AND (@subjectId IS NULL OR scr.subject_id = @subjectId)
      ORDER BY scr.grade ASC, s.name ASC, scr.name ASC;
    `)

    return json(200, { resources: result.recordset.map(sanitizeResource) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }
    console.error('listSchoolResourcesHandler failed', error)
    return json(500, { error: 'Okul kaynakları yüklenemedi.' })
  }
}

async function createSchoolResourceHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const schoolId = request.params.schoolId
    if (!isGuid(schoolId)) {
      return json(400, { error: 'Geçerli bir okul seçin.' })
    }

    const payload = await request.json().catch(() => null)
    const grade = payload?.grade
    const subjectId = payload?.subjectId
    const name = typeof payload?.name === 'string' ? payload.name.trim() : ''
    if (!GRADE_OPTIONS.has(grade)) {
      return json(400, { error: 'Geçerli bir sınıf seçin.' })
    }
    if (!isGuid(subjectId)) {
      return json(400, { error: 'Geçerli bir ders seçin.' })
    }
    if (name.length < 2 || name.length > MAX_RESOURCE_NAME_LENGTH) {
      return json(400, { error: `Kaynak adı 2-${MAX_RESOURCE_NAME_LENGTH} karakter olmalı.` })
    }
    const imageResult = sanitizeImageUrl(payload?.imageUrl)
    if (imageResult.error) {
      return json(400, { error: imageResult.error })
    }

    const requestDb = await withRequest({
      schoolId: { type: sql.UniqueIdentifier, value: schoolId },
      grade: { type: sql.NVarChar(20), value: grade },
      subjectId: { type: sql.UniqueIdentifier, value: subjectId },
      name: { type: sql.NVarChar(MAX_RESOURCE_NAME_LENGTH), value: name },
      imageUrl: { type: sql.NVarChar(sql.MAX), value: imageResult.value },
    })
    const result = await requestDb.query(`
      INSERT INTO dbo.SchoolClassResources (school_id, grade, subject_id, name, image_url)
      OUTPUT inserted.id, inserted.school_id, inserted.grade, inserted.subject_id, inserted.name,
             inserted.image_url, inserted.is_active
      VALUES (@schoolId, @grade, @subjectId, @name, @imageUrl);
    `)
    const created = result.recordset[0]

    const withSubject = await (
      await withRequest({ id: { type: sql.UniqueIdentifier, value: created.id } })
    ).query(`
      SELECT scr.id, scr.school_id, scr.grade, scr.subject_id, s.name AS subject_name,
             scr.name, scr.image_url, scr.is_active
      FROM dbo.SchoolClassResources scr
      JOIN dbo.Subjects s ON s.id = scr.subject_id
      WHERE scr.id = @id;
    `)

    return json(201, { resource: sanitizeResource(withSubject.recordset[0] || created) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }
    console.error('createSchoolResourceHandler failed', error)
    return json(500, { error: 'Okul kaynağı eklenemedi.' })
  }
}

async function updateSchoolResourceHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const { schoolId, resourceId } = request.params
    if (!isGuid(schoolId) || !isGuid(resourceId)) {
      return json(400, { error: 'Geçerli bir kaynak seçin.' })
    }

    const payload = await request.json().catch(() => null)
    const name = typeof payload?.name === 'string' ? payload.name.trim() : ''
    if (name.length < 2 || name.length > MAX_RESOURCE_NAME_LENGTH) {
      return json(400, { error: `Kaynak adı 2-${MAX_RESOURCE_NAME_LENGTH} karakter olmalı.` })
    }
    const imageResult = sanitizeImageUrl(payload?.imageUrl)
    if (imageResult.error) {
      return json(400, { error: imageResult.error })
    }
    const isActive = payload?.isActive === undefined ? true : Boolean(payload.isActive)

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: resourceId },
      schoolId: { type: sql.UniqueIdentifier, value: schoolId },
      name: { type: sql.NVarChar(MAX_RESOURCE_NAME_LENGTH), value: name },
      imageUrl: { type: sql.NVarChar(sql.MAX), value: imageResult.value },
      isActive: { type: sql.Bit, value: isActive },
    })
    const result = await requestDb.query(`
      UPDATE dbo.SchoolClassResources
      SET name = @name, image_url = @imageUrl, is_active = @isActive
      OUTPUT inserted.id
      WHERE id = @id AND school_id = @schoolId;

      SELECT scr.id, scr.school_id, scr.grade, scr.subject_id, s.name AS subject_name,
             scr.name, scr.image_url, scr.is_active
      FROM dbo.SchoolClassResources scr
      JOIN dbo.Subjects s ON s.id = scr.subject_id
      WHERE scr.id = @id AND scr.school_id = @schoolId;
    `)
    const record = result.recordsets?.[1]?.[0] || result.recordset?.[0]
    if (!record) {
      return json(404, { error: 'Kaynak bulunamadı.' })
    }

    return json(200, { resource: sanitizeResource(record) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }
    console.error('updateSchoolResourceHandler failed', error)
    return json(500, { error: 'Okul kaynağı güncellenemedi.' })
  }
}

async function deleteSchoolResourceHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const { schoolId, resourceId } = request.params
    if (!isGuid(schoolId) || !isGuid(resourceId)) {
      return json(400, { error: 'Geçerli bir kaynak seçin.' })
    }

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: resourceId },
      schoolId: { type: sql.UniqueIdentifier, value: schoolId },
    })
    // Bu kaynağa bağlı görevler varsa satırı silmek yerine pasifleştiririz (FK korunur).
    const result = await requestDb.query(`
      DECLARE @affected INT = 0;
      IF EXISTS (SELECT 1 FROM dbo.Tasks WHERE school_resource_id = @id)
      BEGIN
        UPDATE dbo.SchoolClassResources SET is_active = 0 WHERE id = @id AND school_id = @schoolId;
        SET @affected = @@ROWCOUNT;
      END
      ELSE
      BEGIN
        DELETE FROM dbo.SchoolClassResources WHERE id = @id AND school_id = @schoolId;
        SET @affected = @@ROWCOUNT;
      END
      SELECT @affected AS affected;
    `)

    if (!result.recordset?.[0]?.affected) {
      return json(404, { error: 'Kaynak bulunamadı.' })
    }

    return json(200, { ok: true })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }
    console.error('deleteSchoolResourceHandler failed', error)
    return json(500, { error: 'Okul kaynağı silinemedi.' })
  }
}

// Veli/öğrenci panelinde "Okul Ödevi" görev türünde ders + kaynak seçimini besler.
async function getPanelSchoolResourcesHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) return error

    const profileDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const profileResult = await profileDb.query(`
      SELECT school_id, grade FROM dbo.StudentProfiles WHERE student_id = @studentId;
    `)
    const profile = profileResult.recordset[0]
    if (!profile?.school_id || !profile?.grade) {
      return json(200, { groups: [] })
    }

    const requestDb = await withRequest({
      schoolId: { type: sql.UniqueIdentifier, value: profile.school_id },
      grade: { type: sql.NVarChar(20), value: profile.grade },
    })
    const result = await requestDb.query(`
      SELECT scr.id, scr.subject_id, s.name AS subject_name, scr.name, scr.image_url
      FROM dbo.SchoolClassResources scr
      JOIN dbo.Subjects s ON s.id = scr.subject_id
      WHERE scr.school_id = @schoolId AND scr.grade = @grade AND scr.is_active = 1
      ORDER BY s.name ASC, scr.name ASC;
    `)

    const groupsMap = new Map()
    for (const row of result.recordset) {
      if (!groupsMap.has(row.subject_id)) {
        groupsMap.set(row.subject_id, {
          subjectId: row.subject_id,
          subjectName: row.subject_name,
          resources: [],
        })
      }
      groupsMap.get(row.subject_id).resources.push({
        id: row.id,
        name: row.name,
        imageUrl: row.image_url || null,
      })
    }

    return json(200, { groups: Array.from(groupsMap.values()) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }
    console.error('getPanelSchoolResourcesHandler failed', error)
    return json(500, { error: 'Okul kaynakları yüklenemedi.' })
  }
}

// Öğretmen öğrenci detayında "Okul Ödevi" atarken: öğrencinin okulu + sınıfı ve
// öğretmenin dersi (StudentTeachers.subject_id) için tanımlı aktif okul kaynakları.
// Tek ders olduğundan grup yerine düz bir liste döner.
async function getTeacherStudentSchoolResourcesHandler(request) {
  try {
    const { error, studentId, subjectId } = await requireTeacherStudentContext(request)
    if (error) return error

    const profileDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const profileResult = await profileDb.query(`
      SELECT school_id, grade FROM dbo.StudentProfiles WHERE student_id = @studentId;
    `)
    const profile = profileResult.recordset[0]
    if (!profile?.school_id || !profile?.grade || !subjectId) {
      return json(200, { resources: [] })
    }

    const requestDb = await withRequest({
      schoolId: { type: sql.UniqueIdentifier, value: profile.school_id },
      grade: { type: sql.NVarChar(20), value: profile.grade },
      subjectId: { type: sql.UniqueIdentifier, value: subjectId },
    })
    const result = await requestDb.query(`
      SELECT scr.id, scr.name, scr.image_url
      FROM dbo.SchoolClassResources scr
      WHERE scr.school_id = @schoolId AND scr.grade = @grade
        AND scr.subject_id = @subjectId AND scr.is_active = 1
      ORDER BY scr.name ASC;
    `)

    return json(200, {
      resources: result.recordset.map((row) => ({
        id: row.id,
        name: row.name,
        imageUrl: row.image_url || null,
      })),
    })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }
    console.error('getTeacherStudentSchoolResourcesHandler failed', error)
    return json(500, { error: 'Okul kaynakları yüklenemedi.' })
  }
}

module.exports = {
  listSchoolResourcesHandler,
  createSchoolResourceHandler,
  updateSchoolResourceHandler,
  deleteSchoolResourceHandler,
  getPanelSchoolResourcesHandler,
  getTeacherStudentSchoolResourcesHandler,
}
