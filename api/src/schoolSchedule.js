const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { clearSessionHeaders, json } = require('./http')
const { isSessionError } = require('./security')
const { requireAdmin } = require('./admin')
const { requireStudentContext } = require('./studentScope')

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
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
 * İki girdinin tarih aralığının kesişip kesişmediğini kontrol eder. null/undefined bir uç,
 * o girdinin sınırsız (her zaman geçerli) olduğu anlamına gelir — bu yüzden tarih aralığı
 * olmayan bir girdi, tarih aralığı olan başka herhangi bir girdiyle her zaman çakışır.
 */
function dateRangesOverlap(aStart, aEnd, bStart, bEnd) {
  if (aStart && bEnd && aStart > bEnd) return false
  if (bStart && aEnd && bStart > aEnd) return false
  return true
}

/**
 * Bir okul ders programı/öğrenci ders programı girdi listesini doğrular: her girdi için
 * dayOfWeek bilinen 7 günden biri, saatler HH:MM ve başlangıç bitişten önce olmalı; aynı gün
 * içinde ve aynı tarih aralığında çakışan saat aralıkları (kısmi kesişim dahil) reddedilir.
 * startDate/endDate opsiyoneldir — girilmezse girdi her hafta sınırsız geçerli sayılır
 * (mevcut kayıtlarla geriye dönük uyumluluk için).
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
    const startDate = typeof raw?.startDate === 'string' ? raw.startDate.trim() : ''
    const endDate = typeof raw?.endDate === 'string' ? raw.endDate.trim() : ''

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
    if ((startDate || endDate) && !(startDate && endDate)) {
      return { error: 'Tarih aralığının başlangıcı ve bitişi birlikte girilmeli.' }
    }
    if (startDate && !DATE_PATTERN.test(startDate)) {
      return { error: 'Başlangıç tarihi geçersiz.' }
    }
    if (endDate && !DATE_PATTERN.test(endDate)) {
      return { error: 'Bitiş tarihi geçersiz.' }
    }
    if (startDate && endDate && startDate > endDate) {
      return { error: 'Bitiş tarihi başlangıç tarihinden önce olamaz.' }
    }

    entries.push({
      dayOfWeek,
      startTime,
      endTime,
      lessonName: lessonName || null,
      startDate: startDate || null,
      endDate: endDate || null,
    })
  }

  const byDay = new Map()
  for (const entry of entries) {
    const dayEntries = byDay.get(entry.dayOfWeek) || []
    const start = timeToMinutes(entry.startTime)
    const end = timeToMinutes(entry.endTime)
    const overlaps = dayEntries.some((other) => {
      const timeOverlaps = start < timeToMinutes(other.endTime) && end > timeToMinutes(other.startTime)
      if (!timeOverlaps) return false
      return dateRangesOverlap(entry.startDate, entry.endDate, other.startDate, other.endDate)
    })
    if (overlaps) {
      return { error: 'Aynı gün ve tarih aralığında çakışan saat aralıkları eklenemez.' }
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

function sanitizeCalendarEntry(record) {
  return {
    id: record.id,
    entryType: record.entry_type,
    startDate: typeof record.start_date === 'string' ? record.start_date : record.start_date?.toISOString().slice(0, 10),
    endDate: typeof record.end_date === 'string' ? record.end_date : record.end_date?.toISOString().slice(0, 10),
    name: record.name || null,
  }
}

/** Bir okulun tatil/kapalı gün takvimi girdilerini döner (bkz. dbo.SchoolCalendarEntries). */
async function getSchoolCalendarEntries(schoolId) {
  if (!isGuid(schoolId)) return []
  const requestDb = await withRequest({
    schoolId: { type: sql.UniqueIdentifier, value: schoolId },
  })
  const result = await requestDb.query(`
    SELECT id, entry_type, start_date, end_date, name
    FROM dbo.SchoolCalendarEntries
    WHERE school_id = @schoolId
    ORDER BY start_date ASC;
  `)
  return result.recordset.map(sanitizeCalendarEntry)
}

async function listSchoolCalendarHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const schoolId = request.params.schoolId
    if (!isGuid(schoolId)) {
      return json(400, { error: 'Geçerli bir okul seçin.' })
    }

    return json(200, { entries: await getSchoolCalendarEntries(schoolId) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }
    console.error('listSchoolCalendarHandler failed', error)
    return json(500, { error: 'Okul takvimi yüklenemedi.' })
  }
}

async function createSchoolCalendarEntryHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const schoolId = request.params.schoolId
    if (!isGuid(schoolId)) {
      return json(400, { error: 'Geçerli bir okul seçin.' })
    }

    const payload = await request.json().catch(() => null)
    const startDate = typeof payload?.startDate === 'string' ? payload.startDate.trim() : ''
    const endDate = typeof payload?.endDate === 'string' ? payload.endDate.trim() : startDate
    const name = typeof payload?.name === 'string' ? payload.name.trim() : ''

    if (!DATE_PATTERN.test(startDate) || !DATE_PATTERN.test(endDate)) {
      return json(400, { error: 'Geçerli bir tarih girin.' })
    }
    if (startDate > endDate) {
      return json(400, { error: 'Bitiş tarihi başlangıç tarihinden önce olamaz.' })
    }
    if (name.length > 200) {
      return json(400, { error: 'Tatil adı en fazla 200 karakter olabilir.' })
    }

    const requestDb = await withRequest({
      schoolId: { type: sql.UniqueIdentifier, value: schoolId },
      startDate: { type: sql.Date, value: startDate },
      endDate: { type: sql.Date, value: endDate },
      name: { type: sql.NVarChar(200), value: name || null },
    })
    const result = await requestDb.query(`
      INSERT INTO dbo.SchoolCalendarEntries (school_id, entry_type, start_date, end_date, name)
      OUTPUT inserted.id, inserted.entry_type, inserted.start_date, inserted.end_date, inserted.name
      VALUES (@schoolId, 'tatil', @startDate, @endDate, @name);
    `)

    return json(201, { entry: sanitizeCalendarEntry(result.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }
    console.error('createSchoolCalendarEntryHandler failed', error)
    return json(500, { error: 'Tatil eklenemedi.' })
  }
}

async function deleteSchoolCalendarEntryHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) return error

    const { schoolId, entryId } = request.params
    if (!isGuid(schoolId) || !isGuid(entryId)) {
      return json(400, { error: 'Geçerli bir kayıt seçin.' })
    }

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: entryId },
      schoolId: { type: sql.UniqueIdentifier, value: schoolId },
    })
    const result = await requestDb.query(`
      DELETE FROM dbo.SchoolCalendarEntries WHERE id = @id AND school_id = @schoolId;
      SELECT @@ROWCOUNT AS affected;
    `)
    if (!result.recordset?.[0]?.affected) {
      return json(404, { error: 'Kayıt bulunamadı.' })
    }

    return json(200, { ok: true })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }
    console.error('deleteSchoolCalendarEntryHandler failed', error)
    return json(500, { error: 'Kayıt silinemedi.' })
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

/**
 * Bir öğrencinin haftalık plan için okul ders saatlerini ve tatil takvimini döner.
 * Okul + sınıf biliniyorsa saatler canlı olarak admin şablonundan (SchoolClassSchedules)
 * türetilir; aksi halde öğrenciye kaydedilmiş manuel programa düşülür. Hem veli hem
 * öğretmen panelleri bu ortak çözümleyiciyi kullanır.
 */
async function resolveStudentSchoolSchedule(studentId) {
  const requestDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
  })
  const result = await requestDb.query(`
    SELECT school_id, grade, school_schedule_json FROM dbo.StudentProfiles WHERE student_id = @studentId;
  `)
  const profile = result.recordset[0]

  let entries = []
  if (profile?.school_id && profile?.grade) {
    entries = await getStudentSchoolScheduleTemplate(profile.school_id, profile.grade)
  }
  if (entries.length === 0) {
    entries = parseJsonEntries(profile?.school_schedule_json)
  }

  const holidays = profile?.school_id ? await getSchoolCalendarEntries(profile.school_id) : []

  return { entries, holidays }
}

async function getPanelSchoolScheduleHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    return json(200, await resolveStudentSchoolSchedule(studentId))
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
  getSchoolCalendarEntries,
  resolveStudentSchoolSchedule,
  getSchoolClassScheduleHandler,
  saveSchoolClassScheduleHandler,
  getPanelSchoolScheduleHandler,
  listSchoolCalendarHandler,
  createSchoolCalendarEntryHandler,
  deleteSchoolCalendarEntryHandler,
}
