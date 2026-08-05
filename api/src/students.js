const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { clearSessionHeaders, createSessionHeaders, json } = require('./http')
const {
  createSessionToken,
  defaultPasswordForPhone,
  hashPassword,
  isSessionError,
  normalizeEmail,
  normalizePhone,
  readSessionToken,
  verifySessionToken,
} = require('./security')
const { sanitizeUser } = require('./auth')
const { requireStudentContext } = require('./studentScope')

const TEACHER_TYPES = new Set(['ozel_ogretmen', 'okul_ogretmeni'])
const TEACHER_TYPE_LABELS = {
  ozel_ogretmen: 'Özel Öğretmen',
  okul_ogretmeni: 'Okul Öğretmeni',
}
const SCHEDULE_DAYS = new Set(['pazartesi', 'sali', 'carsamba', 'persembe', 'cuma', 'cumartesi', 'pazar'])
const SCHEDULE_DAY_ALIASES = {
  pazartesi: 'pazartesi',
  sali: 'sali',
  salı: 'sali',
  carsamba: 'carsamba',
  çarşamba: 'carsamba',
  persembe: 'persembe',
  perşembe: 'persembe',
  cuma: 'cuma',
  cumartesi: 'cumartesi',
  pazar: 'pazar',
}
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

function sanitizeStudent(record) {
  return {
    id: record.id,
    fullName: record.full_name,
    email: record.email,
    role: record.role,
    createdAt: record.created_at,
    resourceCount: Number(record.resource_count) || 0,
    teacherCount: Number(record.teacher_count) || 0,
  }
}

function sanitizeStudentResourceBook(record) {
  return {
    id: record.id,
    publisherId: record.publisher_id,
    publisherName: record.publisher_name || null,
    subjectId: record.subject_id,
    subjectName: record.subject_name || null,
    name: record.name,
    pageCount: record.page_count,
    isActive: Boolean(record.is_active),
    type: record.resource_type,
    hasAnswerKey: Boolean(record.has_answer_key),
    imageUrl: record.image_url || null,
    assigned: Boolean(record.assigned),
    assignedAt: record.assigned_at || null,
  }
}

function sanitizeTeacherResourceBook(record) {
  return {
    id: record.id,
    publisherId: record.publisher_id,
    publisherName: record.publisher_name || null,
    subjectId: record.subject_id,
    subjectName: record.subject_name || null,
    name: record.name,
    pageCount: record.page_count,
    isActive: Boolean(record.is_active),
    type: record.resource_type,
    hasAnswerKey: Boolean(record.has_answer_key),
    imageUrl: record.image_url || null,
    assigned: Boolean(record.assigned),
    assignedAt: record.assigned_at || null,
  }
}

function parseScheduleJson(value) {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function sanitizeStudentTeacher(record) {
  return {
    id: record.id,
    studentId: record.student_id,
    subjectId: record.subject_id,
    subjectName: record.subject_name || null,
    fullName: record.teacher_full_name,
    studentFullName: record.student_full_name || null,
    studentEmail: record.student_email || null,
    phone: record.phone,
    type: record.teacher_type,
    typeLabel: TEACHER_TYPE_LABELS[record.teacher_type] || record.teacher_type,
    schedule: parseScheduleJson(record.schedule_json),
    resourceBooks: record.resourceBooks || [],
    resourceCount: Number(record.resource_count) || 0,
    teacherUserId: record.teacher_user_id || null,
    accessGrantedAt: record.access_granted_at || null,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

function isGuid(value) {
  return typeof value === 'string' && GUID_PATTERN.test(value.trim())
}

function minutesForTime(value) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function normalizeTime(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return TIME_PATTERN.test(trimmed) ? trimmed : null
}

function normalizeDay(value) {
  if (typeof value !== 'string') return ''
  return SCHEDULE_DAY_ALIASES[value.trim().toLocaleLowerCase('tr-TR')] || ''
}

function normalizeSchedule(value, teacherType) {
  if (teacherType !== 'ozel_ogretmen') {
    return { schedule: [] }
  }

  const entries = Array.isArray(value) ? value : []
  if (entries.length > 7) {
    return { error: 'En fazla 7 ders zamanı ekleyebilirsiniz.' }
  }

  const schedule = []
  for (const entry of entries) {
    const dayOfWeek = normalizeDay(entry?.dayOfWeek)
    const startTime = normalizeTime(entry?.startTime)
    const endTime = normalizeTime(entry?.endTime)
    const hasValue = dayOfWeek || entry?.startTime || entry?.endTime

    if (!hasValue) continue

    if (!SCHEDULE_DAYS.has(dayOfWeek) || !startTime || !endTime) {
      return { error: 'Ders günü ve saat aralığı geçerli olmalı.' }
    }

    if (minutesForTime(startTime) >= minutesForTime(endTime)) {
      return { error: 'Ders başlangıç saati bitiş saatinden önce olmalı.' }
    }

    schedule.push({ dayOfWeek, startTime, endTime })
  }

  return { schedule }
}

function validateTeacherPayload(payload) {
  if (!payload) {
    return { error: 'Geçersiz istek gövdesi.' }
  }

  const fullName = payload.fullName?.trim()
  if (!fullName || fullName.length < 3 || fullName.length > 120) {
    return { error: 'Öğretmen ad soyadı 3-120 karakter arasında olmalı.' }
  }

  const subjectId = payload.subjectId?.trim()
  if (!isGuid(subjectId)) {
    return { error: 'Geçerli bir ders seçin.' }
  }

  const phone = payload.phone?.trim()
  if (!phone || phone.length < 7 || phone.length > 30) {
    return { error: 'Telefon bilgisi 7-30 karakter arasında olmalı.' }
  }

  const type = payload.type
  if (!TEACHER_TYPES.has(type)) {
    return { error: 'Geçerli bir öğretmen tipi seçin.' }
  }

  const scheduleResult = normalizeSchedule(payload.schedule, type)
  if (scheduleResult.error) {
    return { error: scheduleResult.error }
  }

  return {
    value: {
      fullName,
      subjectId,
      phone,
      type,
      schedule: scheduleResult.schedule,
    },
  }
}

function normalizeResourceBookIds(value) {
  if (!Array.isArray(value)) {
    return { error: 'Kaynak listesi geçersiz.' }
  }

  const ids = []
  const seen = new Set()
  for (const rawId of value) {
    if (typeof rawId !== 'string') {
      return { error: 'Kaynak listesi geçersiz.' }
    }

    const id = rawId.trim()
    if (!isGuid(id)) {
      return { error: 'Kaynak listesi geçersiz.' }
    }

    if (!seen.has(id)) {
      seen.add(id)
      ids.push(id)
    }
  }

  return { resourceBookIds: ids }
}

async function requireParentSession(request) {
  const token = readSessionToken(request)
  if (!token) {
    return { error: json(401, { error: 'Oturum bulunamadı.' }) }
  }

  const session = verifySessionToken(token)
  const requestDb = await withRequest({
    id: { type: sql.UniqueIdentifier, value: session.sub },
  })
  const result = await requestDb.query(`
    SELECT TOP 1 role FROM dbo.Users WHERE id = @id;
  `)
  const record = result.recordset[0]

  if (!record) {
    return { error: json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders()) }
  }

  if (record.role !== 'ebeveyn') {
    return { error: json(403, { error: 'Bu alana erişim yetkiniz yok.' }) }
  }

  return { parentId: session.sub }
}

async function verifyParentOwnsStudent(parentId, studentId) {
  const ownershipDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    parentId: { type: sql.UniqueIdentifier, value: parentId },
  })
  const ownershipResult = await ownershipDb.query(`
    SELECT TOP 1 id FROM dbo.Users WHERE id = @studentId AND parent_id = @parentId;
  `)
  return Boolean(ownershipResult.recordset[0])
}

async function verifyParentOwnsTeacher(parentId, studentId, teacherId) {
  const requestDb = await withRequest({
    parentId: { type: sql.UniqueIdentifier, value: parentId },
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    teacherId: { type: sql.UniqueIdentifier, value: teacherId },
  })
  const result = await requestDb.query(`
    SELECT TOP 1 st.id
    FROM dbo.StudentTeachers st
    INNER JOIN dbo.Users u ON u.id = st.student_id
    WHERE st.id = @teacherId AND st.student_id = @studentId AND u.parent_id = @parentId;
  `)

  return Boolean(result.recordset[0])
}

async function fetchStudentResourceBooks(studentId) {
  const requestDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
  })
  const result = await requestDb.query(`
    SELECT rb.id, rb.publisher_id, p.name AS publisher_name, rb.subject_id, s.name AS subject_name,
           rb.name, rb.page_count, rb.is_active, rb.resource_type, rb.has_answer_key, rb.image_url,
           CASE WHEN srb.resource_book_id IS NULL THEN 0 ELSE 1 END AS assigned,
           srb.assigned_at
    FROM dbo.ResourceBooks rb
    LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
    LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
    LEFT JOIN dbo.StudentResourceBooks srb
      ON srb.resource_book_id = rb.id AND srb.student_id = @studentId
    WHERE rb.is_active = 1
    ORDER BY s.name ASC, p.name ASC, rb.name ASC;
  `)

  return result.recordset.map(sanitizeStudentResourceBook)
}

async function fetchStudentTeachers(studentId) {
  const requestDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
  })
  const result = await requestDb.query(`
    SELECT st.id, st.student_id, st.subject_id, s.name AS subject_name,
           st.teacher_full_name, st.phone, st.teacher_type, st.schedule_json,
           st.teacher_user_id, st.access_granted_at,
           st.created_at, st.updated_at
    FROM dbo.StudentTeachers st
    LEFT JOIN dbo.Subjects s ON s.id = st.subject_id
    WHERE st.student_id = @studentId
    ORDER BY s.name ASC, st.teacher_full_name ASC;
  `)

  return result.recordset.map(sanitizeStudentTeacher)
}

async function attachResourceBooksToTeachers(teachers) {
  if (!teachers.length) {
    return teachers
  }

  const bindings = Object.fromEntries(
    teachers.map((teacher, index) => [`teacherId${index}`, { type: sql.UniqueIdentifier, value: teacher.id }]),
  )
  const placeholders = teachers.map((_, index) => `@teacherId${index}`)
  const requestDb = await withRequest(bindings)
  const result = await requestDb.query(`
    SELECT strb.teacher_id, rb.id, rb.publisher_id, p.name AS publisher_name,
           rb.subject_id, s.name AS subject_name, rb.name, rb.page_count, rb.is_active,
           rb.resource_type, rb.has_answer_key, rb.image_url, 1 AS assigned, strb.assigned_at
    FROM dbo.StudentTeacherResourceBooks strb
    INNER JOIN dbo.ResourceBooks rb ON rb.id = strb.resource_book_id
    LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
    LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
    WHERE strb.teacher_id IN (${placeholders.join(', ')}) AND rb.is_active = 1
    ORDER BY s.name ASC, p.name ASC, rb.name ASC;
  `)

  const resourcesByTeacherId = new Map()
  result.recordset.forEach((record) => {
    const resource = sanitizeTeacherResourceBook(record)
    const current = resourcesByTeacherId.get(record.teacher_id) || []
    current.push(resource)
    resourcesByTeacherId.set(record.teacher_id, current)
  })

  return teachers.map((teacher) => {
    const resourceBooks = resourcesByTeacherId.get(teacher.id) || []
    return {
      ...teacher,
      resourceBooks,
      resourceCount: resourceBooks.length,
    }
  })
}

async function fetchParentTeachers(parentId) {
  const requestDb = await withRequest({
    parentId: { type: sql.UniqueIdentifier, value: parentId },
  })
  const result = await requestDb.query(`
    SELECT st.id, st.student_id, u.full_name AS student_full_name, u.email AS student_email,
           st.subject_id, s.name AS subject_name, st.teacher_full_name, st.phone,
           st.teacher_type, st.schedule_json, st.teacher_user_id, st.access_granted_at,
           st.created_at, st.updated_at
    FROM dbo.StudentTeachers st
    INNER JOIN dbo.Users u ON u.id = st.student_id
    LEFT JOIN dbo.Subjects s ON s.id = st.subject_id
    WHERE u.parent_id = @parentId
    ORDER BY u.full_name ASC, s.name ASC, st.teacher_full_name ASC;
  `)

  return attachResourceBooksToTeachers(result.recordset.map(sanitizeStudentTeacher))
}

async function fetchTeacherResourceBooks(studentId, teacherId) {
  const requestDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    teacherId: { type: sql.UniqueIdentifier, value: teacherId },
  })
  const result = await requestDb.query(`
    SELECT rb.id, rb.publisher_id, p.name AS publisher_name, rb.subject_id, s.name AS subject_name,
           rb.name, rb.page_count, rb.is_active, rb.resource_type, rb.has_answer_key, rb.image_url,
           CASE WHEN strb.resource_book_id IS NULL THEN 0 ELSE 1 END AS assigned,
           strb.assigned_at
    FROM dbo.StudentResourceBooks srb
    INNER JOIN dbo.ResourceBooks rb ON rb.id = srb.resource_book_id
    LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
    LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
    LEFT JOIN dbo.StudentTeacherResourceBooks strb
      ON strb.teacher_id = @teacherId
     AND strb.student_id = @studentId
     AND strb.resource_book_id = rb.id
    WHERE srb.student_id = @studentId AND rb.is_active = 1
    ORDER BY s.name ASC, p.name ASC, rb.name ASC;
  `)

  return result.recordset.map(sanitizeTeacherResourceBook)
}

async function verifySubjectExists(subjectId) {
  const subjectDb = await withRequest({
    subjectId: { type: sql.UniqueIdentifier, value: subjectId },
  })
  const result = await subjectDb.query(`
    SELECT TOP 1 id FROM dbo.Subjects WHERE id = @subjectId;
  `)
  return Boolean(result.recordset[0])
}

async function listStudentsHandler(request) {
  try {
    const { error, parentId } = await requireParentSession(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({
      parentId: { type: sql.UniqueIdentifier, value: parentId },
    })
    const result = await requestDb.query(`
      SELECT u.id, u.full_name, u.email, u.role, u.last_login_at, u.created_at,
             COUNT(DISTINCT rb.id) AS resource_count,
             COUNT(DISTINCT st.id) AS teacher_count
      FROM dbo.Users u
      LEFT JOIN dbo.StudentResourceBooks srb ON srb.student_id = u.id
      LEFT JOIN dbo.ResourceBooks rb ON rb.id = srb.resource_book_id AND rb.is_active = 1
      LEFT JOIN dbo.StudentTeachers st ON st.student_id = u.id
      WHERE u.parent_id = @parentId
      GROUP BY u.id, u.full_name, u.email, u.role, u.last_login_at, u.created_at
      ORDER BY u.created_at ASC;
    `)

    return json(200, {
      students: result.recordset.map((record) => ({
        ...sanitizeStudent(record),
        lastLoginAt: record.last_login_at,
      })),
    })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listStudentsHandler failed', error)
    return json(500, { error: 'Öğrenciler yüklenemedi.' })
  }
}

async function createStudentHandler(request) {
  try {
    const { error, parentId } = await requireParentSession(request)
    if (error) {
      return error
    }

    const payload = await request.json().catch(() => null)
    if (!payload) {
      return json(400, { error: 'Geçersiz istek gövdesi.' })
    }

    const fullName = String(payload.fullName || '').trim()
    if (fullName.length < 3 || fullName.length > 120) {
      return json(400, { error: 'Ad soyad 3 ile 120 karakter arasında olmalı.' })
    }

    if (payload.acceptConsent !== true) {
      return json(400, { error: 'Devam etmek için aydınlatma ve KVKK onaylarını vermelisiniz.' })
    }

    const rawEmail = normalizeEmail(payload.email)
    const email = rawEmail || null
    if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320)) {
      return json(400, { error: 'Geçerli bir e-posta adresi girin.' })
    }

    const now = new Date()

    const requestDb = await withRequest({
      fullName: { type: sql.NVarChar(120), value: fullName },
      email: { type: sql.NVarChar(320), value: email },
      role: { type: sql.NVarChar(20), value: 'ogrenci' },
      parentId: { type: sql.UniqueIdentifier, value: parentId },
      consentAt: { type: sql.DateTime2, value: now },
    })

    const result = await requestDb.query(`
      INSERT INTO dbo.Users (full_name, email, role, parent_id, aydinlatma_accepted_at, kvkk_accepted_at)
      OUTPUT inserted.id, inserted.full_name, inserted.email, inserted.role, inserted.created_at,
             0 AS resource_count, 0 AS teacher_count
      VALUES (@fullName, @email, @role, @parentId, @consentAt, @consentAt);
    `)

    return json(201, { student: sanitizeStudent(result.recordset[0]) })
  } catch (error) {
    if (error.number === 2601 || error.number === 2627) {
      return json(409, { error: 'Bu e-posta adresi ile daha önce kayıt oluşturulmuş.' })
    }

    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('createStudentHandler failed', error)
    return json(500, { error: 'Öğrenci profili oluşturulamadı.' })
  }
}

async function enterStudentHandler(request) {
  try {
    const { error, parentId } = await requireParentSession(request)
    if (error) {
      return error
    }

    const studentId = request.params.studentId

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      parentId: { type: sql.UniqueIdentifier, value: parentId },
    })
    const result = await requestDb.query(`
      SELECT TOP 1
        u.id, u.full_name, u.email, u.role, u.last_login_at, u.created_at,
        e.status AS entitlement_status, e.source AS entitlement_source,
        e.current_period_end AS entitlement_current_period_end
      FROM dbo.Users u
      LEFT JOIN dbo.Entitlements e ON e.parent_id = @parentId
      WHERE u.id = @studentId AND u.parent_id = @parentId;
    `)
    const record = result.recordset[0]
    if (!record) {
      return json(404, { error: 'Öğrenci bulunamadı.' })
    }

    const parentDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: parentId },
    })
    const parentResult = await parentDb.query(`
      SELECT TOP 1 full_name FROM dbo.Users WHERE id = @id;
    `)
    const parentFullName = parentResult.recordset[0]?.full_name

    const student = sanitizeStudent(record)
    const token = createSessionToken(student, {
      actingParentId: parentId,
      actingParentName: parentFullName,
    })

    const user = {
      ...student,
      actingParent: { id: parentId, fullName: parentFullName },
      entitlement: {
        status: record.entitlement_status || 'none',
        source: record.entitlement_source || null,
        currentPeriodEnd: record.entitlement_current_period_end || null,
      },
    }
    return json(200, { user }, createSessionHeaders(token))
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('enterStudentHandler failed', error)
    return json(500, { error: 'Öğrenci görünümüne geçilemedi.' })
  }
}

async function exitStudentHandler(request) {
  try {
    const token = readSessionToken(request)
    if (!token) {
      return json(401, { error: 'Oturum bulunamadı.' })
    }

    const session = verifySessionToken(token)
    if (!session.actingParentId) {
      return json(400, { error: 'Aktif bir ebeveyn görünümü yok.' })
    }

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: session.actingParentId },
    })
    const result = await requestDb.query(`
      SELECT TOP 1
        u.id, u.full_name, u.email, u.role, u.is_admin, u.last_login_at, u.created_at,
        e.status AS entitlement_status, e.source AS entitlement_source,
        e.current_period_end AS entitlement_current_period_end
      FROM dbo.Users u
      LEFT JOIN dbo.Entitlements e ON e.parent_id = u.id
      WHERE u.id = @id;
    `)
    const record = result.recordset[0]
    if (!record || record.role !== 'ebeveyn') {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    const user = sanitizeUser(record)
    user.entitlement = {
      status: record.entitlement_status || 'none',
      source: record.entitlement_source || null,
      currentPeriodEnd: record.entitlement_current_period_end || null,
    }
    const newToken = createSessionToken(user)
    return json(200, { user }, createSessionHeaders(newToken))
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('exitStudentHandler failed', error)
    return json(500, { error: 'Ebeveyn görünümüne dönülemedi.' })
  }
}

async function listStudentResourceBooksHandler(request) {
  try {
    const { error, parentId } = await requireParentSession(request)
    if (error) {
      return error
    }

    const studentId = request.params.studentId
    const ownsStudent = await verifyParentOwnsStudent(parentId, studentId)
    if (!ownsStudent) {
      return json(404, { error: 'Öğrenci bulunamadı.' })
    }

    const resourceBooks = await fetchStudentResourceBooks(studentId)
    return json(200, { resourceBooks })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listStudentResourceBooksHandler failed', error)
    return json(500, { error: 'Kaynaklar yüklenemedi.' })
  }
}

async function updateStudentResourceBooksHandler(request) {
  try {
    const { error, parentId } = await requireParentSession(request)
    if (error) {
      return error
    }

    const studentId = request.params.studentId
    const ownsStudent = await verifyParentOwnsStudent(parentId, studentId)
    if (!ownsStudent) {
      return json(404, { error: 'Öğrenci bulunamadı.' })
    }

    const payload = await request.json().catch(() => null)
    if (!payload || !Array.isArray(payload.resourceBookIds)) {
      return json(400, { error: 'Kaynak listesi geçersiz.' })
    }

    const resourceBookIds = Array.from(
      new Set(payload.resourceBookIds.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim())),
    )

    if (resourceBookIds.length) {
      const placeholders = resourceBookIds.map((_, index) => `@resourceBookId${index}`)
      const validationDb = await withRequest(
        Object.fromEntries(resourceBookIds.map((id, index) => [`resourceBookId${index}`, { type: sql.UniqueIdentifier, value: id }])),
      )
      const validationResult = await validationDb.query(`
        SELECT id FROM dbo.ResourceBooks WHERE is_active = 1 AND id IN (${placeholders.join(', ')});
      `)
      if (validationResult.recordset.length !== resourceBookIds.length) {
        return json(400, { error: 'Seçilen kaynaklardan biri bulunamadı veya aktif değil.' })
      }
    }

    const bindings = {
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      ...Object.fromEntries(resourceBookIds.map((id, index) => [`resourceBookId${index}`, { type: sql.UniqueIdentifier, value: id }])),
    }
    const placeholders = resourceBookIds.map((_, index) => `@resourceBookId${index}`)
    const insertStatements = resourceBookIds
      .map(
        (_, index) => `
          INSERT INTO dbo.StudentResourceBooks (student_id, resource_book_id)
          SELECT @studentId, @resourceBookId${index}
          WHERE NOT EXISTS (
            SELECT 1 FROM dbo.StudentResourceBooks
            WHERE student_id = @studentId AND resource_book_id = @resourceBookId${index}
          );
        `,
      )
      .join('\n')

    const requestDb = await withRequest(bindings)
    await requestDb.query(`
      BEGIN TRY
        BEGIN TRANSACTION;

        DELETE FROM dbo.StudentResourceBooks
        WHERE student_id = @studentId
          ${placeholders.length ? `AND resource_book_id NOT IN (${placeholders.join(', ')})` : ''};

        ${insertStatements}

        COMMIT TRANSACTION;
      END TRY
      BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
      END CATCH
    `)

    const resourceBooks = await fetchStudentResourceBooks(studentId)
    const resourceCount = resourceBooks.filter((book) => book.assigned).length
    return json(200, { resourceBooks, resourceCount })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('updateStudentResourceBooksHandler failed', error)
    return json(500, { error: 'Kaynak atamaları kaydedilemedi.' })
  }
}

async function listStudentTeachersForParentHandler(request) {
  try {
    const { error, parentId } = await requireParentSession(request)
    if (error) {
      return error
    }

    const studentId = request.params.studentId
    const ownsStudent = await verifyParentOwnsStudent(parentId, studentId)
    if (!ownsStudent) {
      return json(404, { error: 'Öğrenci bulunamadı.' })
    }

    const teachers = await fetchStudentTeachers(studentId)
    return json(200, { teachers })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listStudentTeachersForParentHandler failed', error)
    return json(500, { error: 'Öğretmenler yüklenemedi.' })
  }
}

async function listParentTeachersHandler(request) {
  try {
    const { error, parentId } = await requireParentSession(request)
    if (error) {
      return error
    }

    const teachers = await fetchParentTeachers(parentId)
    return json(200, { teachers })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listParentTeachersHandler failed', error)
    return json(500, { error: 'Öğretmenler yüklenemedi.' })
  }
}

function normalizeTeacherNameForMatch(value) {
  return String(value || '').trim().toLocaleLowerCase('tr-TR')
}

// Aynı veliye ait, aynı öğretmene (ad+telefon normalize edilerek eşleşen) bağlı
// TÜM StudentTeachers satırlarının id'lerini döner — "Panele Yetki Ver" bunların
// hepsini tek seferde aynı öğretmen hesabına bağlar.
async function findMatchingTeacherRowIds(parentId, fullName, normalizedPhone) {
  const requestDb = await withRequest({ parentId: { type: sql.UniqueIdentifier, value: parentId } })
  const result = await requestDb.query(`
    SELECT st.id, st.teacher_full_name, st.phone
    FROM dbo.StudentTeachers st
    INNER JOIN dbo.Users u ON u.id = st.student_id
    WHERE u.parent_id = @parentId;
  `)
  return result.recordset
    .filter(
      (row) =>
        normalizeTeacherNameForMatch(row.teacher_full_name) === normalizeTeacherNameForMatch(fullName) &&
        normalizePhone(row.phone) === normalizedPhone,
    )
    .map((row) => row.id)
}

async function grantTeacherAccessHandler(request) {
  try {
    const { error, parentId } = await requireParentSession(request)
    if (error) {
      return error
    }

    const studentId = request.params.studentId
    const teacherId = request.params.teacherId
    const ownsTeacher = await verifyParentOwnsTeacher(parentId, studentId, teacherId)
    if (!ownsTeacher) {
      return json(404, { error: 'Öğretmen bulunamadı.' })
    }

    const rowDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: teacherId } })
    const rowResult = await rowDb.query(`
      SELECT id, teacher_full_name, phone, teacher_user_id FROM dbo.StudentTeachers WHERE id = @id;
    `)
    const row = rowResult.recordset[0]
    if (!row) {
      return json(404, { error: 'Öğretmen bulunamadı.' })
    }

    const teacherPhone = normalizePhone(row.phone)
    if (!teacherPhone) {
      return json(400, { error: 'Öğretmenin geçerli bir cep telefonu numarası olmalı ki panele giriş yapabilsin.' })
    }

    let teacherUserId
    let isNewAccount = false
    const existingDb = await withRequest({ phone: { type: sql.NVarChar(20), value: teacherPhone } })
    const existingResult = await existingDb.query(`
      SELECT TOP 1 id FROM dbo.Users WHERE role = 'ogretmen' AND phone_number = @phone;
    `)

    if (existingResult.recordset[0]) {
      teacherUserId = existingResult.recordset[0].id
    } else {
      isNewAccount = true
      const now = new Date()
      const passwordHash = await hashPassword(defaultPasswordForPhone(teacherPhone))
      const insertDb = await withRequest({
        fullName: { type: sql.NVarChar(120), value: row.teacher_full_name },
        phone: { type: sql.NVarChar(20), value: teacherPhone },
        passwordHash: { type: sql.NVarChar(255), value: passwordHash },
        role: { type: sql.NVarChar(20), value: 'ogretmen' },
        consentAt: { type: sql.DateTime2, value: now },
      })
      try {
        const insertResult = await insertDb.query(`
          INSERT INTO dbo.Users (full_name, phone_number, password_hash, role, aydinlatma_accepted_at, kvkk_accepted_at)
          OUTPUT inserted.id
          VALUES (@fullName, @phone, @passwordHash, @role, @consentAt, @consentAt);
        `)
        teacherUserId = insertResult.recordset[0].id
      } catch (insertError) {
        // Yarış durumu: aynı telefonla eşzamanlı ikinci "yetki ver" isteği.
        if (insertError.number === 2601 || insertError.number === 2627) {
          const retryDb = await withRequest({ phone: { type: sql.NVarChar(20), value: teacherPhone } })
          const retryResult = await retryDb.query(`SELECT TOP 1 id FROM dbo.Users WHERE phone_number = @phone;`)
          teacherUserId = retryResult.recordset[0]?.id
          isNewAccount = false
        } else {
          throw insertError
        }
      }
    }

    const matchingIds = await findMatchingTeacherRowIds(parentId, row.teacher_full_name, teacherPhone)
    const idsToUpdate = matchingIds.length ? matchingIds : [teacherId]
    const placeholders = idsToUpdate.map((_, index) => `@id${index}`)
    const updateDb = await withRequest({
      teacherUserId: { type: sql.UniqueIdentifier, value: teacherUserId },
      ...Object.fromEntries(idsToUpdate.map((id, index) => [`id${index}`, { type: sql.UniqueIdentifier, value: id }])),
    })
    await updateDb.query(`
      UPDATE dbo.StudentTeachers
      SET teacher_user_id = @teacherUserId, access_granted_at = SYSUTCDATETIME()
      WHERE id IN (${placeholders.join(', ')});
    `)

    const teachers = await fetchParentTeachers(parentId)
    return json(200, {
      teacher: teachers.find((item) => item.id === teacherId) || null,
      teachers,
      isNewAccount,
      temporaryPassword: isNewAccount ? defaultPasswordForPhone(teacherPhone) : null,
    })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }
    console.error('grantTeacherAccessHandler failed', error)
    return json(500, { error: 'Öğretmene panel yetkisi verilemedi.' })
  }
}

async function createStudentTeacherHandler(request) {
  try {
    const { error, parentId } = await requireParentSession(request)
    if (error) {
      return error
    }

    const studentId = request.params.studentId
    const ownsStudent = await verifyParentOwnsStudent(parentId, studentId)
    if (!ownsStudent) {
      return json(404, { error: 'Öğrenci bulunamadı.' })
    }

    const payload = await request.json().catch(() => null)
    const validationResult = validateTeacherPayload(payload)
    if (validationResult.error) {
      return json(400, { error: validationResult.error })
    }

    const teacher = validationResult.value
    const subjectExists = await verifySubjectExists(teacher.subjectId)
    if (!subjectExists) {
      return json(400, { error: 'Seçilen ders bulunamadı.' })
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      subjectId: { type: sql.UniqueIdentifier, value: teacher.subjectId },
      createdByParentId: { type: sql.UniqueIdentifier, value: parentId },
      fullName: { type: sql.NVarChar(120), value: teacher.fullName },
      phone: { type: sql.NVarChar(30), value: teacher.phone },
      teacherType: { type: sql.NVarChar(30), value: teacher.type },
      scheduleJson: {
        type: sql.NVarChar(sql.MAX),
        value: teacher.type === 'ozel_ogretmen' && teacher.schedule.length ? JSON.stringify(teacher.schedule) : null,
      },
    })

    const result = await requestDb.query(`
      INSERT INTO dbo.StudentTeachers
        (student_id, subject_id, created_by_parent_id, teacher_full_name, phone, teacher_type, schedule_json)
      OUTPUT inserted.id
      VALUES (@studentId, @subjectId, @createdByParentId, @fullName, @phone, @teacherType, @scheduleJson);
    `)

    const teachers = await fetchStudentTeachers(studentId)
    const createdTeacherId = result.recordset[0]?.id
    return json(201, {
      teacher: teachers.find((item) => item.id === createdTeacherId) || null,
      teachers,
      teacherCount: teachers.length,
    })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('createStudentTeacherHandler failed', error)
    return json(500, { error: 'Öğretmen kaydı oluşturulamadı.' })
  }
}

async function updateStudentTeacherHandler(request) {
  try {
    const { error, parentId } = await requireParentSession(request)
    if (error) {
      return error
    }

    const studentId = request.params.studentId
    const teacherId = request.params.teacherId
    const ownsTeacher = await verifyParentOwnsTeacher(parentId, studentId, teacherId)
    if (!ownsTeacher) {
      return json(404, { error: 'Öğretmen bulunamadı.' })
    }

    const payload = await request.json().catch(() => null)
    const validationResult = validateTeacherPayload(payload)
    if (validationResult.error) {
      return json(400, { error: validationResult.error })
    }

    const teacher = validationResult.value
    const subjectExists = await verifySubjectExists(teacher.subjectId)
    if (!subjectExists) {
      return json(400, { error: 'Seçilen ders bulunamadı.' })
    }

    const requestDb = await withRequest({
      teacherId: { type: sql.UniqueIdentifier, value: teacherId },
      subjectId: { type: sql.UniqueIdentifier, value: teacher.subjectId },
      fullName: { type: sql.NVarChar(120), value: teacher.fullName },
      phone: { type: sql.NVarChar(30), value: teacher.phone },
      teacherType: { type: sql.NVarChar(30), value: teacher.type },
      scheduleJson: {
        type: sql.NVarChar(sql.MAX),
        value: teacher.type === 'ozel_ogretmen' && teacher.schedule.length ? JSON.stringify(teacher.schedule) : null,
      },
    })

    await requestDb.query(`
      UPDATE dbo.StudentTeachers
      SET subject_id = @subjectId, teacher_full_name = @fullName, phone = @phone,
          teacher_type = @teacherType, schedule_json = @scheduleJson, updated_at = SYSUTCDATETIME()
      WHERE id = @teacherId;
    `)

    const teachers = await fetchStudentTeachers(studentId)
    return json(200, {
      teacher: teachers.find((item) => item.id === teacherId) || null,
      teachers,
    })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('updateStudentTeacherHandler failed', error)
    return json(500, { error: 'Öğretmen bilgileri güncellenemedi.' })
  }
}

async function listTeacherResourceBooksForParentHandler(request) {
  try {
    const { error, parentId } = await requireParentSession(request)
    if (error) {
      return error
    }

    const studentId = request.params.studentId
    const teacherId = request.params.teacherId
    const ownsTeacher = await verifyParentOwnsTeacher(parentId, studentId, teacherId)
    if (!ownsTeacher) {
      return json(404, { error: 'Öğretmen bulunamadı.' })
    }

    const resourceBooks = await fetchTeacherResourceBooks(studentId, teacherId)
    return json(200, { resourceBooks, resourceCount: resourceBooks.filter((book) => book.assigned).length })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listTeacherResourceBooksForParentHandler failed', error)
    return json(500, { error: 'Öğretmen kaynakları yüklenemedi.' })
  }
}

async function updateTeacherResourceBooksForParentHandler(request) {
  try {
    const { error, parentId } = await requireParentSession(request)
    if (error) {
      return error
    }

    const studentId = request.params.studentId
    const teacherId = request.params.teacherId
    const ownsTeacher = await verifyParentOwnsTeacher(parentId, studentId, teacherId)
    if (!ownsTeacher) {
      return json(404, { error: 'Öğretmen bulunamadı.' })
    }

    const payload = await request.json().catch(() => null)
    const normalized = normalizeResourceBookIds(payload?.resourceBookIds)
    if (normalized.error) {
      return json(400, { error: normalized.error })
    }

    const resourceBookIds = normalized.resourceBookIds
    if (resourceBookIds.length) {
      const placeholders = resourceBookIds.map((_, index) => `@resourceBookId${index}`)
      const validationDb = await withRequest({
        studentId: { type: sql.UniqueIdentifier, value: studentId },
        ...Object.fromEntries(resourceBookIds.map((id, index) => [`resourceBookId${index}`, { type: sql.UniqueIdentifier, value: id }])),
      })
      const validationResult = await validationDb.query(`
        SELECT srb.resource_book_id
        FROM dbo.StudentResourceBooks srb
        INNER JOIN dbo.ResourceBooks rb ON rb.id = srb.resource_book_id
        WHERE srb.student_id = @studentId
          AND rb.is_active = 1
          AND srb.resource_book_id IN (${placeholders.join(', ')});
      `)

      if (validationResult.recordset.length !== resourceBookIds.length) {
        return json(400, { error: 'Seçilen kaynaklardan biri bu öğrenciye atanmış değil.' })
      }
    }

    const bindings = {
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      teacherId: { type: sql.UniqueIdentifier, value: teacherId },
      ...Object.fromEntries(resourceBookIds.map((id, index) => [`resourceBookId${index}`, { type: sql.UniqueIdentifier, value: id }])),
    }
    const insertStatements = resourceBookIds
      .map(
        (_, index) => `
          INSERT INTO dbo.StudentTeacherResourceBooks (teacher_id, student_id, resource_book_id)
          VALUES (@teacherId, @studentId, @resourceBookId${index});
        `,
      )
      .join('\n')

    const requestDb = await withRequest(bindings)
    await requestDb.query(`
      BEGIN TRY
        BEGIN TRANSACTION;

        DELETE FROM dbo.StudentTeacherResourceBooks
        WHERE teacher_id = @teacherId AND student_id = @studentId;

        ${insertStatements}

        COMMIT TRANSACTION;
      END TRY
      BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
      END CATCH
    `)

    const resourceBooks = await fetchTeacherResourceBooks(studentId, teacherId)
    return json(200, { resourceBooks, resourceCount: resourceBooks.filter((book) => book.assigned).length })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('updateTeacherResourceBooksForParentHandler failed', error)
    return json(500, { error: 'Öğretmen kaynakları kaydedilemedi.' })
  }
}

async function listStudentTeachersForPanelHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const teachers = await fetchStudentTeachers(studentId)
    return json(200, { teachers })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listStudentTeachersForPanelHandler failed', error)
    return json(500, { error: 'Öğretmenler yüklenemedi.' })
  }
}

module.exports = {
  listStudentsHandler,
  createStudentHandler,
  enterStudentHandler,
  exitStudentHandler,
  listStudentResourceBooksHandler,
  updateStudentResourceBooksHandler,
  listStudentTeachersForParentHandler,
  listParentTeachersHandler,
  createStudentTeacherHandler,
  updateStudentTeacherHandler,
  listTeacherResourceBooksForParentHandler,
  updateTeacherResourceBooksForParentHandler,
  listStudentTeachersForPanelHandler,
  grantTeacherAccessHandler,
  fetchTeacherResourceBooks,
  requireParentSession,
  verifyParentOwnsStudent,
}
