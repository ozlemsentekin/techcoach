const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { clearSessionHeaders, json } = require('./http')
const { isSessionError } = require('./security')
const { requireAdmin } = require('./admin')
const { requireStudentContext } = require('./studentScope')

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const WEEKDAY_KEYS = new Set(['pazartesi', 'sali', 'carsamba', 'persembe', 'cuma', 'cumartesi', 'pazar'])
const GRADE_OPTIONS = new Set(['1', '2', '3', '4', '5', '6', '7', '8'])
const MAX_SCHEDULE_ENTRIES = 30
const MAX_LESSON_NAME_LENGTH = 100

function isGuid(value) {
  return typeof value === 'string' && GUID_PATTERN.test(value.trim())
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function parseJsonEntries(value) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Bir okul ders programı/öğrenci ders programı girdi listesini doğrular: her girdi için
 * dayOfWeek bilinen 7 günden biri, saatler HH:MM ve başlangıç bitişten önce olmalı; aynı gün
 * içinde çakışan aralıklar (kısmi kesişim dahil) reddedilir.
 */
function validateScheduleEntries(rawEntries) {
  if (rawEntries === undefined || rawEntries === null) {
    return { value: [] }
  }
  if (!Array.isArray(rawEntries)) {
    return { error: 'Ders programı listesi geçersiz.' }
  }
  if (rawEntries.length > MAX_SCHEDULE_ENTRIES) {
    return { error: `En fazla ${MAX_SCHEDULE_ENTRIES} zaman aralığı ekleyebilirsiniz.` }
  }

  const entries = []
  for (const raw of rawEntries) {
    const dayOfWeek = raw?.dayOfWeek
    const startTime = raw?.startTime
    const endTime = raw?.endTime
    const lessonName = typeof raw?.lessonName === 'string' ? raw.lessonName.trim() : ''

    if (!WEEKDAY_KEYS.has(dayOfWeek)) {
      return { error: 'Geçerli bir gün seçilmeli.' }
    }
    if (typeof startTime !== 'string' || !TIME_PATTERN.test(startTime)) {
      return { error: 'Başlangıç saati geçersiz.' }
    }
    if (typeof endTime !== 'string' || !TIME_PATTERN.test(endTime)) {
      return { error: 'Bitiş saati geçersiz.' }
    }
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      return { error: 'Bitiş saati başlangıç saatinden sonra olmalı.' }
    }
    if (lessonName.length > MAX_LESSON_NAME_LENGTH) {
      return { error: `Ders adı en fazla ${MAX_LESSON_NAME_LENGTH} karakter olmalı.` }
    }

    entries.push({ dayOfWeek, startTime, endTime, lessonName: lessonName || null })
  }

  const byDay = new Map()
  for (const entry of entries) {
    const dayEntries = byDay.get(entry.dayOfWeek) || []
    const start = timeToMinutes(entry.startTime)
    const end = timeToMinutes(entry.endTime)
    const overlaps = dayEntries.some(
      (other) => start < timeToMinutes(other.endTime) && end > timeToMinutes(other.startTime),
    )
    if (overlaps) {
      return { error: 'Aynı gün içinde çakışan saat aralıkları eklenemez.' }
    }
    dayEntries.push(entry)
    byDay.set(entry.dayOfWeek, dayEntries)
  }

  return { value: entries }
}

async function getSchoolClassScheduleHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const schoolId = request.params.schoolId
    const grade = request.query.get('grade')
    if (!isGuid(schoolId)) {
      return json(400, { error: 'Geçerli bir okul seçin.' })
    }
    if (!GRADE_OPTIONS.has(grade)) {
      return json(400, { error: 'Geçerli bir sınıf seçin.' })
    }

    const requestDb = await withRequest({
      schoolId: { type: sql.UniqueIdentifier, value: schoolId },
      grade: { type: sql.NVarChar(20), value: grade },
    })
    const result = await requestDb.query(`
      SELECT schedule_json FROM dbo.SchoolClassSchedules WHERE school_id = @schoolId AND grade = @grade;
    `)

    return json(200, { entries: parseJsonEntries(result.recordset[0]?.schedule_json) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('getSchoolClassScheduleHandler failed', error)
    return json(500, { error: 'Ders programı yüklenemedi.' })
  }
}

async function saveSchoolClassScheduleHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const schoolId = request.params.schoolId
    if (!isGuid(schoolId)) {
      return json(400, { error: 'Geçerli bir okul seçin.' })
    }

    const payload = await request.json().catch(() => null)
    const grade = payload?.grade
    if (!GRADE_OPTIONS.has(grade)) {
      return json(400, { error: 'Geçerli bir sınıf seçin.' })
    }

    const entriesResult = validateScheduleEntries(payload?.entries)
    if (entriesResult.error) {
      return json(400, { error: entriesResult.error })
    }

    const requestDb = await withRequest({
      schoolId: { type: sql.UniqueIdentifier, value: schoolId },
      grade: { type: sql.NVarChar(20), value: grade },
      scheduleJson: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(entriesResult.value) },
    })
    await requestDb.query(`
      MERGE dbo.SchoolClassSchedules AS target
      USING (SELECT @schoolId AS school_id, @grade AS grade) AS src
      ON target.school_id = src.school_id AND target.grade = src.grade
      WHEN MATCHED THEN UPDATE SET schedule_json = @scheduleJson
      WHEN NOT MATCHED THEN INSERT (school_id, grade, schedule_json)
        VALUES (@schoolId, @grade, @scheduleJson);
    `)

    return json(200, { entries: entriesResult.value })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('saveSchoolClassScheduleHandler failed', error)
    return json(500, { error: 'Ders programı kaydedilemedi.' })
  }
}

async function getStudentSchoolScheduleTemplate(schoolId, grade) {
  if (!isGuid(schoolId) || !GRADE_OPTIONS.has(grade)) {
    return []
  }
  const requestDb = await withRequest({
    schoolId: { type: sql.UniqueIdentifier, value: schoolId },
    grade: { type: sql.NVarChar(20), value: grade },
  })
  const result = await requestDb.query(`
    SELECT schedule_json FROM dbo.SchoolClassSchedules WHERE school_id = @schoolId AND grade = @grade;
  `)
  return parseJsonEntries(result.recordset[0]?.schedule_json)
}

async function getPanelSchoolScheduleHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const result = await requestDb.query(`
      SELECT school_schedule_json FROM dbo.StudentProfiles WHERE student_id = @studentId;
    `)

    return json(200, { entries: parseJsonEntries(result.recordset[0]?.school_schedule_json) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('getPanelSchoolScheduleHandler failed', error)
    return json(500, { error: 'Ders programı yüklenemedi.' })
  }
}

module.exports = {
  validateScheduleEntries,
  parseJsonEntries,
  getStudentSchoolScheduleTemplate,
  getSchoolClassScheduleHandler,
  saveSchoolClassScheduleHandler,
  getPanelSchoolScheduleHandler,
}
