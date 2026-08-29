const { sql, withRequest, withTransaction } = require('./db')
const { isConfigError } = require('./config')
const { clearSessionHeaders, json } = require('./http')
const {
  defaultPasswordForPhone,
  hashPassword,
  isSessionError,
  normalizePhone,
} = require('./security')
const { requireTeacherSession, requireTeacherStudentContext } = require('./teacherScope')
const { normalizeTeacherSubjectIds, parseTeacherSubjectIdsJson } = require('./subjectIds')
const { fetchTeacherResourceBooks, verifySubjectExists } = require('./students')
const { fetchStudentProfile, validateGeoSelection, sanitizePhotoUrl } = require('./studentProfile')
const { getTeacherQuota, hasActiveParentEntitlement } = require('./entitlements')
const {
  SELECT_HOMEWORK,
  HOMEWORK_TASK_TYPES_SQL,
  sanitizeHomework,
  fetchHomeworkById,
  checkDuplicateHomework,
  getAssignedResourceBook,
  getAssignedSchoolResource,
  createHomeworkTask,
  deleteHomeworkTask,
  isValidTime,
  computeEndTime,
} = require('./homework')

const WEEKDAY_IDS = ['pazartesi', 'sali', 'carsamba', 'persembe', 'cuma', 'cumartesi', 'pazar']

function timeRangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd
}

function weekdayIdForDate(dateISO) {
  const jsDay = new Date(`${dateISO}T00:00:00Z`).getUTCDay()
  return WEEKDAY_IDS[(jsDay + 6) % 7]
}

function addDaysISO(dateISO, days) {
  const date = new Date(`${dateISO}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
const { SELECT_TASK, sanitizeTask, fetchTaskAnswerSheetData } = require('./tasks')
const { resolveStudentSchoolSchedule } = require('./schoolSchedule')
const {
  fetchResourceBookTopicsWithTests,
  LIBRARY_GRADES,
  fetchLibraryResourceBooks,
} = require('./catalog')
const {
  sanitizeProgressResourceBook,
  sanitizeProgressTest,
  sanitizeProgressTask,
  sanitizeProgressSession,
  sanitizeProgressHomework,
  sanitizeWrongQuestion,
  sanitizeManualTestCompletion,
  computeWrongQuestionTopicStats,
  fetchWrongQuestionBookImagesByName,
  fetchResourceBookImagesByIds,
  MISTAKE_REASONS,
} = require('./progress')
const { gradeTestAnswers } = require('./testGrading')
const { sanitizeMistakePhoto, WRONG_QUESTION_OUTPUT_COLUMNS } = require('./mistakePhoto')

const TEACHER_TYPE_LABELS = {
  ozel_ogretmen: 'Özel Öğretmen',
  okul_ogretmeni: 'Okul Öğretmeni',
}

const STUDENT_STATUS_FILTERS = new Set(['active', 'inactive', 'all'])

// Bir görevin (dbo.Tasks t) bu öğretmenin (öğrenci, ders) kapsamına girip girmediğini
// belirleyen ortak SQL koşulu. @studentId, @subjectId, @studentTeacherId bind edilmiş olmalı.
// Kapsam:
//  - Öğretmenin kendi oluşturduğu görevler (student_teacher_id eşleşir)
//  - Öğretmenin takip ettiği bir kaynağa ait her görev — ödev kaydına (homework_id) bağlı
//    olsun ya da olmasın; öğrenci/veli "Bugün planı"ndan eklediği soru bankası ödevleri de
//    dahil (bkz. AddTaskDrawer 'soru-bankasi-odevi')
//  - Öğretmenin dersine ait, kaynağı olmayan ödev-tipi görevler (örn. okuma kitabı, okul ödevi)
const TEACHER_TASK_IN_SCOPE = `(
  t.student_teacher_id = @studentTeacherId
  OR EXISTS (
    SELECT 1 FROM dbo.StudentTeacherResourceBooks strb
    WHERE strb.teacher_id = @studentTeacherId AND strb.resource_book_id = t.resource_book_id
  )
  OR (
    t.resource_book_id IS NULL
    AND t.subject_id = @subjectId
    AND t.task_type IN ('odev', 'soru-bankasi-odevi', 'okul-odevi', 'etkinlik-odevi')
  )
)`

function parseScheduleJson(value) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function handleError(error, fallbackLabel, fallbackMessage) {
  if (isConfigError(error)) {
    return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
  }
  if (isSessionError(error)) {
    return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
  }
  console.error(`${fallbackLabel} failed`, error)
  return json(500, { error: fallbackMessage })
}

function normalizeStudentStatusFilter(value) {
  const status = String(value || 'active').trim().toLowerCase()
  return STUDENT_STATUS_FILTERS.has(status) ? status : 'active'
}

function nextRecurringOccurrence(schedule, todayISO, nowHHMM) {
  if (!schedule?.length) return null
  const todayWeekdayIdx = WEEKDAY_IDS.indexOf(weekdayIdForDate(todayISO))
  let best = null
  schedule.forEach((slot) => {
    const targetIdx = WEEKDAY_IDS.indexOf(slot.dayOfWeek)
    if (targetIdx === -1) return
    let diff = (targetIdx - todayWeekdayIdx + 7) % 7
    if (diff === 0 && slot.startTime <= nowHHMM) diff = 7
    const date = addDaysISO(todayISO, diff)
    if (!best || date < best.date || (date === best.date && slot.startTime < best.startTime)) {
      best = { date, startTime: slot.startTime, endTime: slot.endTime }
    }
  })
  return best
}

function earlierLesson(a, b) {
  if (!a) return b
  if (!b) return a
  if (a.date !== b.date) return a.date < b.date ? a : b
  return a.startTime <= b.startTime ? a : b
}

async function fetchNextOneTimeLessonsByStudentTeacherId(teacherUserId, todayISO) {
  const requestDb = await withRequest({
    teacherUserId: { type: sql.UniqueIdentifier, value: teacherUserId },
    today: { type: sql.Date, value: todayISO },
  })
  const result = await requestDb.query(`
    SELECT t.student_teacher_id, t.date, t.start_time, t.end_time
    FROM dbo.Tasks t
    INNER JOIN dbo.StudentTeachers st ON st.id = t.student_teacher_id
    WHERE st.teacher_user_id = @teacherUserId
      AND st.is_active = 1
      AND ((t.task_type = 'ders-calisma' AND t.created_by = 'ogretmen') OR t.task_type = 'ozel-ders')
      AND t.date >= @today
    ORDER BY t.date ASC, t.start_time ASC;
  `)

  const byStudentTeacherId = new Map()
  result.recordset.forEach((record) => {
    if (byStudentTeacherId.has(record.student_teacher_id)) return
    byStudentTeacherId.set(record.student_teacher_id, {
      date: record.date.toISOString().slice(0, 10),
      startTime: record.start_time,
      endTime: record.end_time,
    })
  })
  return byStudentTeacherId
}

function studentBookKey(studentId, resourceBookId) {
  return `${studentId}:${resourceBookId}`
}

function teacherTestKey(studentTeacherId, testId) {
  return `${studentTeacherId}:${testId}`
}

function shouldReplaceTaskResult(existing, next) {
  if (!existing) return true
  if (!next?.gradedAt) return false
  return !existing.gradedAt || next.gradedAt > existing.gradedAt
}

// Bir öğretmenin, birlikte çalıştığı her öğrenci ilişkisi (student_teacher_id) için o derse ait
// kaynak kitaplardaki tüm testlerin doğru/cevaplanan toplamından tek bir başarı oranı hesaplar.
// Önceki sürüm her öğrenci için fetchResourceBookStatsForStudent çağırıp 3 ayrı SQL sorgusu
// çalıştırıyordu. Bu toplu sürüm roster boyutu arttıkça sorgu sayısını sabit tutar.
async function fetchStudentTeacherSuccessRates(rows) {
  const rates = new Map()
  if (!rows.length) return rates

  const normalizedRows = rows.map((row) => ({
    studentTeacherId: String(row.studentTeacherId),
    studentId: String(row.studentId),
  }))
  const rowByStudentTeacherId = new Map(normalizedRows.map((row) => [row.studentTeacherId, row]))
  const idBindings = Object.fromEntries(
    normalizedRows.map((row, index) => [`stId${index}`, { type: sql.UniqueIdentifier, value: row.studentTeacherId }]),
  )
  const idPlaceholders = normalizedRows.map((_, index) => `@stId${index}`).join(', ')

  const booksDb = await withRequest(idBindings)
  const booksResult = await booksDb.query(`
    SELECT teacher_id AS student_teacher_id, resource_book_id
    FROM dbo.StudentTeacherResourceBooks
    WHERE teacher_id IN (${idPlaceholders});
  `)

  const teacherIdsByStudentBook = new Map()
  const resourceBookIds = new Set()
  booksResult.recordset.forEach((record) => {
    const studentTeacherId = String(record.student_teacher_id)
    const row = rowByStudentTeacherId.get(studentTeacherId)
    const resourceBookId = String(record.resource_book_id)
    if (!row || !resourceBookId) return

    resourceBookIds.add(resourceBookId)
    const key = studentBookKey(row.studentId, resourceBookId)
    if (!teacherIdsByStudentBook.has(key)) {
      teacherIdsByStudentBook.set(key, [])
    }
    teacherIdsByStudentBook.get(key).push(studentTeacherId)
  })

  if (!resourceBookIds.size) return rates

  const bookIdList = Array.from(resourceBookIds)
  const bookBindings = Object.fromEntries(
    bookIdList.map((id, index) => [`resourceBookId${index}`, { type: sql.UniqueIdentifier, value: id }]),
  )
  const bookPlaceholders = bookIdList.map((_, index) => `@resourceBookId${index}`).join(', ')

  const testsDb = await withRequest(bookBindings)
  const testsResult = await testsDb.query(`
    SELECT tt.id AS test_id, t.resource_book_id
    FROM dbo.ResourceBookTopicTests tt
    INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
    WHERE t.resource_book_id IN (${bookPlaceholders});
  `)

  const resourceBookIdByTestId = new Map(
    testsResult.recordset.map((record) => [String(record.test_id), String(record.resource_book_id)]),
  )
  if (!resourceBookIdByTestId.size) return rates

  const studentIds = Array.from(new Set(normalizedRows.map((row) => row.studentId)))
  const studentBindings = Object.fromEntries(
    studentIds.map((id, index) => [`studentId${index}`, { type: sql.UniqueIdentifier, value: id }]),
  )
  const studentPlaceholders = studentIds.map((_, index) => `@studentId${index}`).join(', ')
  const resultsByTeacherTest = new Map()

  const applyResult = (studentId, testId, result, { force = false } = {}) => {
    const resourceBookId = resourceBookIdByTestId.get(String(testId))
    if (!resourceBookId) return

    const studentTeacherIds = teacherIdsByStudentBook.get(studentBookKey(String(studentId), resourceBookId))
    if (!studentTeacherIds?.length) return

    studentTeacherIds.forEach((studentTeacherId) => {
      const key = teacherTestKey(studentTeacherId, testId)
      const existing = resultsByTeacherTest.get(key)
      if (force || shouldReplaceTaskResult(existing?.result, result)) {
        resultsByTeacherTest.set(key, { studentTeacherId, result })
      }
    })
  }

  const tasksDb = await withRequest({
    ...studentBindings,
    ...bookBindings,
  })
  const tasksResult = await tasksDb.query(`
    SELECT student_id, test_results_json
    FROM dbo.Tasks
    WHERE student_id IN (${studentPlaceholders})
      AND resource_book_id IN (${bookPlaceholders})
      AND test_results_json IS NOT NULL;
  `)

  tasksResult.recordset.forEach((row) => {
    let results
    try {
      results = JSON.parse(row.test_results_json)
    } catch {
      return
    }

    Object.entries(results || {}).forEach(([testId, result]) => {
      applyResult(row.student_id, testId, result)
    })
  })

  const manualDb = await withRequest({
    ...studentBindings,
    ...bookBindings,
  })
  const manualResult = await manualDb.query(`
    SELECT smtc.student_id, smtc.test_id, t.resource_book_id,
           smtc.correct_count, smtc.wrong_count, smtc.blank_count
    FROM dbo.StudentManualTestCompletions smtc
    INNER JOIN dbo.ResourceBookTopicTests tt ON tt.id = smtc.test_id
    INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
    WHERE smtc.student_id IN (${studentPlaceholders})
      AND t.resource_book_id IN (${bookPlaceholders});
  `)

  manualResult.recordset.forEach((row) => {
    if (row.correct_count === null && row.wrong_count === null && row.blank_count === null) return
    applyResult(
      row.student_id,
      row.test_id,
      {
        correct: row.correct_count,
        wrong: row.wrong_count,
        blank: row.blank_count,
      },
      { force: true },
    )
  })

  const countsByStudentTeacherId = new Map()
  resultsByTeacherTest.forEach(({ studentTeacherId, result }) => {
    const correct = Number(result?.correct) || 0
    const wrong = Number(result?.wrong) || 0
    const blank = Number(result?.blank) || 0
    const answered = correct + wrong + blank
    if (answered <= 0) return

    const counts = countsByStudentTeacherId.get(studentTeacherId) || { correct: 0, answered: 0 }
    counts.correct += correct
    counts.answered += answered
    countsByStudentTeacherId.set(studentTeacherId, counts)
  })

  countsByStudentTeacherId.forEach((counts, studentTeacherId) => {
    rates.set(studentTeacherId, counts.answered > 0 ? counts.correct / counts.answered : null)
  })

  return rates
}

async function listTeacherStudentsHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) return error

    const status = normalizeStudentStatusFilter(request.query.get('status'))
    const statusBindings =
      status === 'all' ? {} : { isActive: { type: sql.Bit, value: status === 'active' } }
    const statusWhere = status === 'all' ? '' : 'AND st.is_active = @isActive'
    const requestDb = await withRequest({
      teacherUserId: { type: sql.UniqueIdentifier, value: teacherUserId },
      ...statusBindings,
    })
    const result = await requestDb.query(`
      SELECT st.id AS student_teacher_id, st.student_id, u.full_name AS student_full_name, u.phone_number AS student_phone,
             st.subject_id, s.name AS subject_name, st.teacher_type, st.schedule_json, st.access_granted_at,
             st.is_active,
             sp.grade AS student_grade, sp.photo_url AS student_photo_url, sch.name AS school_name,
             (SELECT COUNT(*) FROM dbo.StudentTeacherResourceBooks strb WHERE strb.teacher_id = st.id) AS resource_count
      FROM dbo.StudentTeachers st
      INNER JOIN dbo.Users u ON u.id = st.student_id
      LEFT JOIN dbo.Subjects s ON s.id = st.subject_id
      LEFT JOIN dbo.StudentProfiles sp ON sp.student_id = st.student_id
      LEFT JOIN dbo.Schools sch ON sch.id = sp.school_id
      WHERE st.teacher_user_id = @teacherUserId
        ${statusWhere}
      ORDER BY u.full_name ASC, s.name ASC;
    `)

    const todayISO = new Date().toISOString().slice(0, 10)
    const nowHHMM = new Date().toISOString().slice(11, 16)
    const nextOneTimeByStudentTeacherId = await fetchNextOneTimeLessonsByStudentTeacherId(teacherUserId, todayISO)
    const successRateByStudentTeacherId = await fetchStudentTeacherSuccessRates(
      result.recordset.map((record) => ({ studentTeacherId: record.student_teacher_id, studentId: record.student_id })),
    )

    const students = result.recordset.map((record) => {
      const schedule = parseScheduleJson(record.schedule_json)
      const nextLesson = earlierLesson(
        nextRecurringOccurrence(schedule, todayISO, nowHHMM),
        nextOneTimeByStudentTeacherId.get(record.student_teacher_id) || null,
      )

      return {
        studentTeacherId: record.student_teacher_id,
        studentId: record.student_id,
        studentFullName: record.student_full_name,
        studentPhone: record.student_phone || null,
        studentGrade: record.student_grade || null,
        studentPhotoUrl: record.student_photo_url || null,
        schoolName: record.school_name || null,
        subjectId: record.subject_id,
        subjectName: record.subject_name || null,
        teacherType: record.teacher_type,
        typeLabel: TEACHER_TYPE_LABELS[record.teacher_type] || record.teacher_type,
        isActive: Boolean(record.is_active),
        schedule,
        nextLesson,
        resourceCount: Number(record.resource_count) || 0,
        accessGrantedAt: record.access_granted_at || null,
        successRate: successRateByStudentTeacherId.get(record.student_teacher_id) ?? null,
      }
    })

    return json(200, { students })
  } catch (error) {
    return handleError(error, 'listTeacherStudentsHandler', 'Öğrenciler yüklenemedi.')
  }
}

// listTeacherStudentsHandler'ın tekil öğrenci karşılığı — StudentDetailPage gibi tek bir
// öğrenciye ihtiyaç duyan ekranların tüm roster'ı çekip client-side .find() yapmasını önler.
// nextLesson/successRate gibi listede hesaplanan pahalı alanları kasıtlı olarak içermez.
async function getTeacherStudentHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) return error

    const studentTeacherId = request.params.studentTeacherId
    const requestDb = await withRequest({
      studentTeacherId: { type: sql.UniqueIdentifier, value: studentTeacherId },
      teacherUserId: { type: sql.UniqueIdentifier, value: teacherUserId },
    })
    const result = await requestDb.query(`
      SELECT st.id AS student_teacher_id, st.student_id, u.full_name AS student_full_name, u.phone_number AS student_phone,
             st.subject_id, s.name AS subject_name, st.teacher_type, st.schedule_json, st.schedule_exceptions_json,
             st.access_granted_at, st.is_active,
             sp.grade AS student_grade, sp.photo_url AS student_photo_url, sch.name AS school_name,
             (SELECT COUNT(*) FROM dbo.StudentTeacherResourceBooks strb WHERE strb.teacher_id = st.id) AS resource_count
      FROM dbo.StudentTeachers st
      INNER JOIN dbo.Users u ON u.id = st.student_id
      LEFT JOIN dbo.Subjects s ON s.id = st.subject_id
      LEFT JOIN dbo.StudentProfiles sp ON sp.student_id = st.student_id
      LEFT JOIN dbo.Schools sch ON sch.id = sp.school_id
      WHERE st.id = @studentTeacherId AND st.teacher_user_id = @teacherUserId AND st.is_active = 1;
    `)

    const record = result.recordset[0]
    if (!record) {
      return json(404, { error: 'Öğrenci bulunamadı.' })
    }

    return json(200, {
      student: {
        studentTeacherId: record.student_teacher_id,
        studentId: record.student_id,
        studentFullName: record.student_full_name,
        studentPhone: record.student_phone || null,
        studentGrade: record.student_grade || null,
        studentPhotoUrl: record.student_photo_url || null,
        schoolName: record.school_name || null,
        subjectId: record.subject_id,
        subjectName: record.subject_name || null,
        teacherType: record.teacher_type,
        typeLabel: TEACHER_TYPE_LABELS[record.teacher_type] || record.teacher_type,
        isActive: Boolean(record.is_active),
        schedule: parseScheduleJson(record.schedule_json),
        scheduleExceptions: parseScheduleJson(record.schedule_exceptions_json),
        resourceCount: Number(record.resource_count) || 0,
        accessGrantedAt: record.access_granted_at || null,
      },
    })
  } catch (error) {
    return handleError(error, 'getTeacherStudentHandler', 'Öğrenci yüklenemedi.')
  }
}

// Öğretmen tarafındaki "Profil Kartı" görünümü — veli panelindeki profil sihirbazının Temel
// Bilgiler ve Okul Bilgileri adımlarını salt okunur gösterir (bu bilgiler normalde veli
// tarafından doldurulur). Öğrenciyi bizzat öğretmen eklediyse (funded_by_teacher_id kendisiyse),
// hiçbir zaman panel erişimi olmayan bir veli bu alanları dolduramayacağı için Temel Bilgiler
// adımı öğretmen tarafından da düzenlenebilir hale gelir (bkz. updateTeacherStudentProfileHandler).
async function getTeacherStudentProfileHandler(request) {
  try {
    const { error, studentId, actorId: teacherUserId } = await requireTeacherStudentContext(request, {
      includeInactive: true,
    })
    if (error) return error

    const profile = await fetchStudentProfile(studentId)
    const canEditBasics = await isStudentFundedByTeacher(studentId, teacherUserId)
    return json(200, { profile, canEditBasics })
  } catch (error) {
    return handleError(error, 'getTeacherStudentProfileHandler', 'Profil yüklenemedi.')
  }
}

async function isStudentFundedByTeacher(studentId, teacherUserId) {
  const requestDb = await withRequest({ studentId: { type: sql.UniqueIdentifier, value: studentId } })
  const result = await requestDb.query(`
    SELECT funded_by_teacher_id FROM dbo.Users WHERE id = @studentId;
  `)
  const fundedByTeacherId = result.recordset[0]?.funded_by_teacher_id
  return Boolean(fundedByTeacherId) && String(fundedByTeacherId).toLowerCase() === String(teacherUserId).toLowerCase()
}

const STUDENT_GENDERS = new Set(['kiz', 'erkek'])
const PROFILE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// createTeacherStudentHandler ile eklenen öğrencinin velisi hiçbir zaman panele giriş yapmamış
// olabilir (password_hash yok) — bu durumda Temel Bilgiler adımındaki alanlar hiç doldurulamaz.
// Bu uç, sadece öğretmenin bizzat eklediği (funded_by_teacher_id kendisi olan) öğrenciler için
// bu alanların öğretmen panelinden düzenlenmesine izin verir.
async function updateTeacherStudentProfileHandler(request) {
  try {
    const { error, studentId, actorId: teacherUserId } = await requireTeacherStudentContext(request, {
      includeInactive: true,
    })
    if (error) return error

    const canEdit = await isStudentFundedByTeacher(studentId, teacherUserId)
    if (!canEdit) {
      return json(403, { error: 'Bu bilgiler yalnızca öğrenciyi ekleyen öğretmen tarafından düzenlenebilir.' })
    }

    const payload = await request.json().catch(() => null)
    if (!payload) {
      return json(400, { error: 'Geçersiz istek gövdesi.' })
    }

    const firstName = String(payload.firstName || '').trim()
    const lastName = String(payload.lastName || '').trim()
    const fullName = `${firstName} ${lastName}`.trim()
    if (fullName.length < 3 || fullName.length > 120) {
      return json(400, { error: 'Öğrenci adı 3 ile 120 karakter arasında olmalı.' })
    }

    const grade = String(payload.grade || '').trim()
    if (!LIBRARY_GRADES.has(grade)) {
      return json(400, { error: 'Geçerli bir sınıf seçilmeli.' })
    }

    const birthDateRaw = String(payload.birthDate || '').trim()
    let birthDate = null
    if (birthDateRaw) {
      if (!PROFILE_DATE_PATTERN.test(birthDateRaw) || Number.isNaN(new Date(birthDateRaw).getTime())) {
        return json(400, { error: 'Doğum tarihi geçerli olmalı.' })
      }
      if (new Date(birthDateRaw).getTime() > Date.now()) {
        return json(400, { error: 'Doğum tarihi gelecekte olamaz.' })
      }
      birthDate = birthDateRaw
    }

    const genderRaw = String(payload.gender || '').trim()
    if (genderRaw && !STUDENT_GENDERS.has(genderRaw)) {
      return json(400, { error: 'Geçerli bir cinsiyet seçilmeli.' })
    }
    const gender = genderRaw || null

    const phoneRaw = String(payload.phone || '').trim()
    let phone = null
    if (phoneRaw) {
      phone = normalizePhone(phoneRaw)
      if (!phone) {
        return json(400, { error: 'Geçerli bir telefon numarası girin.' })
      }
    }

    // Fotoğraf yalnızca istekte gönderildiyse güncellenir (Okul Bilgileri adımı photoUrl
    // göndermez); aksi halde MERGE mevcut fotoğrafı korur.
    const updatePhoto = Object.prototype.hasOwnProperty.call(payload, 'photoUrl')
    let photoUrl = null
    if (updatePhoto) {
      const photoResult = sanitizePhotoUrl(payload.photoUrl)
      if (photoResult.error) {
        return json(400, { error: photoResult.error })
      }
      photoUrl = photoResult.value
    }

    const provinceId = payload.provinceId || null
    const districtId = payload.districtId || null
    const schoolId = payload.schoolId || null
    const geoValidation = await validateGeoSelection({ provinceId, districtId, schoolId })
    if (geoValidation.error) {
      return json(400, { error: geoValidation.error })
    }

    // Öğrenci telefonu Users.phone_number'da da tutulur (liste/detay uçları buradan okur,
    // giriş şifresi de telefonun son 6 hanesinden türetilir) — studentProfile.js'teki veli
    // akışıyla aynı senkron burada da yapılır.
    const passwordHash = phone ? await hashPassword(defaultPasswordForPhone(phone)) : null

    const updateDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      fullName: { type: sql.NVarChar(120), value: fullName },
      grade: { type: sql.NVarChar(20), value: grade },
      birthDate: { type: sql.Date, value: birthDate },
      gender: { type: sql.NVarChar(20), value: gender },
      phone: { type: sql.NVarChar(30), value: phone },
      passwordHash: { type: sql.NVarChar(255), value: passwordHash },
      provinceId: { type: sql.UniqueIdentifier, value: provinceId },
      districtId: { type: sql.UniqueIdentifier, value: districtId },
      schoolId: { type: sql.UniqueIdentifier, value: schoolId },
      updatePhoto: { type: sql.Bit, value: updatePhoto ? 1 : 0 },
      photoUrl: { type: sql.NVarChar(sql.MAX), value: photoUrl },
    })
    await updateDb.query(`
      UPDATE dbo.Users
      SET full_name = @fullName,
          phone_number = @phone,
          password_hash = CASE
            WHEN @phone IS NOT NULL AND (phone_number IS NULL OR phone_number <> @phone) THEN @passwordHash
            ELSE password_hash
          END
      WHERE id = @studentId;

      MERGE dbo.StudentProfiles AS target
      USING (SELECT @studentId AS student_id) AS src
      ON target.student_id = src.student_id
      WHEN MATCHED THEN UPDATE SET
        grade = @grade,
        birth_date = @birthDate,
        gender = @gender,
        phone = @phone,
        province_id = @provinceId,
        district_id = @districtId,
        school_id = @schoolId,
        photo_url = CASE WHEN @updatePhoto = 1 THEN @photoUrl ELSE photo_url END
      WHEN NOT MATCHED THEN INSERT (student_id, grade, birth_date, gender, phone, province_id, district_id, school_id, photo_url)
        VALUES (@studentId, @grade, @birthDate, @gender, @phone, @provinceId, @districtId, @schoolId, @photoUrl);
    `)

    const profile = await fetchStudentProfile(studentId)
    return json(200, { profile, studentFullName: fullName })
  } catch (error) {
    return handleError(error, 'updateTeacherStudentProfileHandler', 'Profil kaydedilemedi.')
  }
}

async function updateTeacherStudentStatusHandler(request) {
  try {
    const { error, studentTeacherId, actorId: teacherUserId } = await requireTeacherStudentContext(request, {
      includeInactive: true,
    })
    if (error) return error

    const payload = await request.json().catch(() => null)
    if (typeof payload?.isActive !== 'boolean') {
      return json(400, { error: 'Geçerli bir durum seçilmeli.' })
    }

    const updateDb = await withRequest({
      studentTeacherId: { type: sql.UniqueIdentifier, value: studentTeacherId },
      teacherUserId: { type: sql.UniqueIdentifier, value: teacherUserId },
      isActive: { type: sql.Bit, value: payload.isActive },
    })
    const result = await updateDb.query(`
      UPDATE dbo.StudentTeachers
      SET is_active = @isActive
      OUTPUT inserted.id, inserted.is_active
      WHERE id = @studentTeacherId AND teacher_user_id = @teacherUserId;
    `)

    const updated = result.recordset[0]
    if (!updated) {
      return json(404, { error: 'Öğrenci bulunamadı.' })
    }

    return json(200, {
      student: {
        studentTeacherId: updated.id,
        isActive: Boolean(updated.is_active),
      },
    })
  } catch (error) {
    return handleError(error, 'updateTeacherStudentStatusHandler', 'Öğrenci durumu güncellenemedi.')
  }
}

// Öğretmen tarafından eklenen öğrencilerin StudentProfiles kaydı (dolayısıyla grade'i) olmayabilir
// (bkz. createTeacherStudentHandler). Sınıfı olmayan öğrenci, kütüphanede kaynak atanabilir
// öğrenci listesinden düşer (assignable-students sorgusu grade üzerinden filtreler). Bu uç,
// mevcut bir öğrencinin sınıfını sonradan tanımlamayı/düzeltmeyi sağlar.
async function updateTeacherStudentGradeHandler(request) {
  try {
    const { error, studentId } = await requireTeacherStudentContext(request, { includeInactive: true })
    if (error) return error

    const payload = await request.json().catch(() => null)
    const grade = String(payload?.grade || '').trim()
    if (!LIBRARY_GRADES.has(grade)) {
      return json(400, { error: 'Geçerli bir sınıf seçilmeli.' })
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      grade: { type: sql.NVarChar(20), value: grade },
    })
    await requestDb.query(`
      MERGE dbo.StudentProfiles AS target
      USING (SELECT @studentId AS student_id) AS src
      ON target.student_id = src.student_id
      WHEN MATCHED THEN UPDATE SET grade = @grade
      WHEN NOT MATCHED THEN INSERT (student_id, grade) VALUES (@studentId, @grade);
    `)

    return json(200, { student: { studentId, grade } })
  } catch (error) {
    return handleError(error, 'updateTeacherStudentGradeHandler', 'Sınıf güncellenemedi.')
  }
}

async function deleteTeacherStudentRelationData(requestInTransaction, bindings) {
  await requestInTransaction(bindings).query(`
    DELETE FROM dbo.TaskActivityLogs
    WHERE task_id IN (SELECT id FROM dbo.Tasks WHERE student_teacher_id = @studentTeacherId);

    UPDATE dbo.WrongQuestions
    SET task_id = NULL
    WHERE task_id IN (SELECT id FROM dbo.Tasks WHERE student_teacher_id = @studentTeacherId);

    UPDATE dbo.StudySessions
    SET task_id = NULL
    WHERE task_id IN (SELECT id FROM dbo.Tasks WHERE student_teacher_id = @studentTeacherId);

    UPDATE dbo.ParentMotivationMessages
    SET linked_task_id = NULL
    WHERE linked_task_id IN (SELECT id FROM dbo.Tasks WHERE student_teacher_id = @studentTeacherId);

    DELETE FROM dbo.Tasks
    WHERE student_teacher_id = @studentTeacherId;

    DELETE FROM dbo.StudentTeachers
    WHERE id = @studentTeacherId AND teacher_user_id = @teacherUserId;
  `)
}

async function hardDeleteFundedStudent(requestInTransaction, bindings) {
  await requestInTransaction(bindings).query(`
    DELETE FROM dbo.TaskActivityLogs
    WHERE student_id = @studentId
       OR actor_user_id = @studentId
       OR task_id IN (SELECT id FROM dbo.Tasks WHERE student_id = @studentId);

    DELETE FROM dbo.StudentManualTestCompletions
    WHERE student_id = @studentId OR marked_by_user_id = @studentId;

    DELETE FROM dbo.WrongQuestions WHERE student_id = @studentId;
    DELETE FROM dbo.StudySessions WHERE student_id = @studentId;
    DELETE FROM dbo.ParentMotivationMessages WHERE student_id = @studentId;
    DELETE FROM dbo.MotivationFeedback WHERE student_id = @studentId;
    DELETE FROM dbo.MotivationDailySelections WHERE student_id = @studentId;
    DELETE FROM dbo.CheckIns WHERE student_id = @studentId;
    DELETE FROM dbo.StudentRequests WHERE student_id = @studentId;
    DELETE FROM dbo.CoachNotes WHERE student_id = @studentId;
    DELETE FROM dbo.Messages WHERE student_id = @studentId;
    DELETE FROM dbo.WeeklyPlanStatuses WHERE student_id = @studentId;
    DELETE FROM dbo.Tasks WHERE student_id = @studentId;
    DELETE FROM dbo.Homeworks WHERE student_id = @studentId;
    DELETE FROM dbo.StudentTeachers WHERE student_id = @studentId;
    DELETE FROM dbo.StudentResourceBooks WHERE student_id = @studentId;
    DELETE FROM dbo.StudentProfiles WHERE student_id = @studentId;

    DELETE FROM dbo.Users
    WHERE id = @studentId AND funded_by_teacher_id = @teacherUserId AND role = 'ogrenci';
  `)
}

async function deleteTeacherStudentHandler(request) {
  try {
    const { error, studentTeacherId, studentId, actorId: teacherUserId } = await requireTeacherStudentContext(request, {
      includeInactive: true,
    })
    if (error) return error

    const deleteResult = await withTransaction(async (requestInTransaction) => {
      const bindings = {
        studentTeacherId: { type: sql.UniqueIdentifier, value: studentTeacherId },
        studentId: { type: sql.UniqueIdentifier, value: studentId },
        teacherUserId: { type: sql.UniqueIdentifier, value: teacherUserId },
      }
      const ownershipResult = await requestInTransaction(bindings).query(`
        SELECT TOP 1 funded_by_teacher_id
        FROM dbo.Users
        WHERE id = @studentId AND role = 'ogrenci';
      `)
      const student = ownershipResult.recordset[0]
      if (!student) return { rowsAffected: 0, hardDeletedStudent: false }

      const hardDeletedStudent =
        student.funded_by_teacher_id &&
        String(student.funded_by_teacher_id).toLowerCase() === String(teacherUserId).toLowerCase()

      if (hardDeletedStudent) {
        await hardDeleteFundedStudent(requestInTransaction, bindings)
        return { rowsAffected: 1, hardDeletedStudent: true }
      }

      await deleteTeacherStudentRelationData(requestInTransaction, bindings)
      return { rowsAffected: 1, hardDeletedStudent: false }
    })

    if (!deleteResult.rowsAffected) {
      return json(404, { error: 'Öğrenci bulunamadı.' })
    }

    return json(200, { success: true, hardDeletedStudent: deleteResult.hardDeletedStudent })
  } catch (error) {
    if (error.number === 547) {
      return json(409, { error: 'İlişkili kayıtlar nedeniyle öğrenci silinemedi.' })
    }
    return handleError(error, 'deleteTeacherStudentHandler', 'Öğrenci silinemedi.')
  }
}

async function listTeacherParentsHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) return error

    const requestDb = await withRequest({ teacherUserId: { type: sql.UniqueIdentifier, value: teacherUserId } })
    const result = await requestDb.query(`
      SELECT p.id AS parent_id, p.full_name AS parent_full_name, p.phone_number AS parent_phone,
             p.password_hash AS parent_password_hash,
             u.id AS student_id, u.full_name AS student_full_name
      FROM dbo.StudentTeachers st
      INNER JOIN dbo.Users u ON u.id = st.student_id
      INNER JOIN dbo.Users p ON p.id = u.parent_id
      WHERE st.teacher_user_id = @teacherUserId
        AND st.is_active = 1
      ORDER BY p.full_name ASC, u.full_name ASC;
    `)

    const parentsById = new Map()
    result.recordset.forEach((record) => {
      const existing = parentsById.get(record.parent_id)
      const student = { id: record.student_id, fullName: record.student_full_name }
      if (existing) {
        existing.students.push(student)
      } else {
        parentsById.set(record.parent_id, {
          id: record.parent_id,
          fullName: record.parent_full_name,
          phone: record.parent_phone,
          hasPanelAccess: Boolean(record.parent_password_hash),
          students: [student],
        })
      }
    })

    return json(200, { parents: Array.from(parentsById.values()) })
  } catch (error) {
    return handleError(error, 'listTeacherParentsHandler', 'Veliler yüklenemedi.')
  }
}

// Bir öğretmenin bir öğrencisinin velisine ilk kez panel erişimi açar (veli şu ana kadar
// hiç giriş yapamıyorsa, password_hash NULL'dır). Geçici şifre `defaultPasswordForPhone`
// ile aynı desende üretilir — grantTeacherAccessHandler (students.js) ile simetrik bir akış.
async function grantParentAccessHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) return error

    const parentId = request.params.parentId

    const ownershipDb = await withRequest({
      teacherUserId: { type: sql.UniqueIdentifier, value: teacherUserId },
      parentId: { type: sql.UniqueIdentifier, value: parentId },
    })
    const ownershipResult = await ownershipDb.query(`
      SELECT TOP 1 1
      FROM dbo.StudentTeachers st
      INNER JOIN dbo.Users u ON u.id = st.student_id
      WHERE st.teacher_user_id = @teacherUserId AND u.parent_id = @parentId;
    `)
    if (!ownershipResult.recordset[0]) {
      return json(404, { error: 'Veli bulunamadı.' })
    }

    const parentDb = await withRequest({ parentId: { type: sql.UniqueIdentifier, value: parentId } })
    const parentResult = await parentDb.query(`
      SELECT TOP 1 phone_number, password_hash FROM dbo.Users WHERE id = @parentId AND role = 'ebeveyn';
    `)
    const parent = parentResult.recordset[0]
    if (!parent) {
      return json(404, { error: 'Veli bulunamadı.' })
    }
    if (parent.password_hash) {
      return json(409, { error: 'Bu veli zaten panel erişimine sahip.' })
    }
    if (!parent.phone_number) {
      return json(400, { error: 'Velinin geçerli bir cep telefonu numarası olmalı ki panele giriş yapabilsin.' })
    }

    const temporaryPassword = defaultPasswordForPhone(parent.phone_number)
    const passwordHash = await hashPassword(temporaryPassword)

    const updateDb = await withRequest({
      parentId: { type: sql.UniqueIdentifier, value: parentId },
      passwordHash: { type: sql.NVarChar(255), value: passwordHash },
    })
    await updateDb.query(`
      UPDATE dbo.Users SET password_hash = @passwordHash WHERE id = @parentId;
    `)

    return json(200, { temporaryPassword })
  } catch (error) {
    return handleError(error, 'grantParentAccessHandler', 'Veliye panel erişimi verilemedi.')
  }
}

async function getTeacherEntitlementHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) return error

    const quota = await getTeacherQuota(teacherUserId)
    return json(200, { entitlement: quota })
  } catch (error) {
    return handleError(error, 'getTeacherEntitlementHandler', 'Panel kotası yüklenemedi.')
  }
}

async function updateTeacherProfileHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) return error

    const payload = await request.json().catch(() => null)
    const subjectIdsResult = normalizeTeacherSubjectIds(payload?.subjectIds)
    if (subjectIdsResult.error) {
      return json(400, { error: subjectIdsResult.error })
    }
    const teacherSubjectIds = subjectIdsResult.value

    const requestDb = await withRequest({
      teacherUserId: { type: sql.UniqueIdentifier, value: teacherUserId },
      teacherSubjectIdsJson: {
        type: sql.NVarChar(sql.MAX),
        value: teacherSubjectIds.length ? JSON.stringify(teacherSubjectIds) : null,
      },
    })
    const result = await requestDb.query(`
      UPDATE dbo.Users
      SET teacher_subject_ids_json = @teacherSubjectIdsJson
      WHERE id = @teacherUserId;

      SELECT teacher_subject_ids_json FROM dbo.Users WHERE id = @teacherUserId;
    `)

    const updated = result.recordset[0]
    return json(200, { teacherSubjectIds: parseTeacherSubjectIdsJson(updated?.teacher_subject_ids_json) })
  } catch (error) {
    return handleError(error, 'updateTeacherProfileHandler', 'Branş bilgisi güncellenemedi.')
  }
}


// Öğretmenin kendi panel kotasından doğrudan bir öğrenci eklemesini sağlar. Veli telefon
// numarasıyla aranır: zaten kendi (aktif) planı olan bir veli bulunursa öğretmenin kotası
// harcanmaz; bulunamazsa veya velinin aktif planı yoksa yeni öğrenci öğretmenin kotasından
// düşülür ve veliye (varsa yeni oluşturularak) kısıtlı bir panel erişimi bağlanır.
async function createTeacherStudentHandler(request) {
  try {
    const { error, teacherUserId, teacherFullName, teacherPhone } = await requireTeacherSession(request)
    if (error) return error

    const payload = await request.json().catch(() => null)
    if (!payload) {
      return json(400, { error: 'Geçersiz istek gövdesi.' })
    }

    const studentFullName = String(payload.studentFullName || '').trim()
    if (studentFullName.length < 3 || studentFullName.length > 120) {
      return json(400, { error: 'Öğrenci adı 3 ile 120 karakter arasında olmalı.' })
    }

    const parentFullName = String(payload.parentFullName || '').trim()
    if (parentFullName.length < 3 || parentFullName.length > 120) {
      return json(400, { error: 'Veli adı 3 ile 120 karakter arasında olmalı.' })
    }

    const teacherType = 'ozel_ogretmen'

    const subjectId = payload.subjectId
    if (!subjectId || !(await verifySubjectExists(subjectId))) {
      return json(400, { error: 'Geçerli bir ders seçilmeli.' })
    }

    const grade = String(payload.grade || '').trim()
    if (!LIBRARY_GRADES.has(grade)) {
      return json(400, { error: 'Geçerli bir sınıf seçilmeli.' })
    }

    const studentPhoneRaw = String(payload.studentPhone || '').trim()
    const studentPhone = studentPhoneRaw ? normalizePhone(studentPhoneRaw) : null
    if (studentPhoneRaw && !studentPhone) {
      return json(400, { error: 'Geçerli bir öğrenci telefon numarası girin.' })
    }

    const parentPhone = normalizePhone(payload.parentPhone)
    if (!parentPhone) {
      return json(400, { error: 'Geçerli bir veli telefon numarası girin.' })
    }

    const quota = await getTeacherQuota(teacherUserId)
    if (!quota.isActive) {
      return json(403, { error: 'Panel aboneliğiniz aktif değil.' })
    }

    let parentId
    let consumesQuota
    let parentHasPanelAccess

    const existingParentDb = await withRequest({ phone: { type: sql.NVarChar(20), value: parentPhone } })
    const existingParentResult = await existingParentDb.query(`
      SELECT TOP 1 id, password_hash FROM dbo.Users WHERE role = 'ebeveyn' AND phone_number = @phone;
    `)
    const existingParent = existingParentResult.recordset[0]

    if (existingParent) {
      parentId = existingParent.id
      parentHasPanelAccess = Boolean(existingParent.password_hash)
      consumesQuota = !(await hasActiveParentEntitlement(parentId))
    } else {
      consumesQuota = true
      parentHasPanelAccess = false
      const insertParentDb = await withRequest({
        fullName: { type: sql.NVarChar(120), value: parentFullName },
        phone: { type: sql.NVarChar(20), value: parentPhone },
        role: { type: sql.NVarChar(20), value: 'ebeveyn' },
      })
      try {
        const insertParentResult = await insertParentDb.query(`
          INSERT INTO dbo.Users (full_name, phone_number, role)
          OUTPUT inserted.id
          VALUES (@fullName, @phone, @role);
        `)
        parentId = insertParentResult.recordset[0].id
      } catch (insertError) {
        // Yarış durumu: aynı telefonla eşzamanlı ikinci "öğrenci ekle" isteği.
        if (insertError.number === 2601 || insertError.number === 2627) {
          const retryDb = await withRequest({ phone: { type: sql.NVarChar(20), value: parentPhone } })
          const retryResult = await retryDb.query(`
            SELECT TOP 1 id, password_hash FROM dbo.Users WHERE phone_number = @phone;
          `)
          const retryParent = retryResult.recordset[0]
          if (!retryParent) throw insertError
          parentId = retryParent.id
          parentHasPanelAccess = Boolean(retryParent.password_hash)
          consumesQuota = !(await hasActiveParentEntitlement(parentId))
        } else {
          throw insertError
        }
      }
    }

    if (consumesQuota && quota.remainingSeats <= 0) {
      return json(403, { error: 'Öğrenci ekleme hakkınız kalmadı.' })
    }

    // Aile zaten onay verdiyse (veli girişe sahipse) yeni öğrenci de aynı onayı miras alır;
    // aksi halde onay velinin ilk girişinde (KVKK/aydınlatma ekranı) alınana kadar bekler.
    const parentConsentDb = await withRequest({ parentId: { type: sql.UniqueIdentifier, value: parentId } })
    const parentConsentResult = await parentConsentDb.query(`
      SELECT aydinlatma_accepted_at, kvkk_accepted_at FROM dbo.Users WHERE id = @parentId;
    `)
    const parentConsent = parentConsentResult.recordset[0]

    const insertStudentDb = await withRequest({
      fullName: { type: sql.NVarChar(120), value: studentFullName },
      role: { type: sql.NVarChar(20), value: 'ogrenci' },
      phone: { type: sql.NVarChar(30), value: studentPhone },
      parentId: { type: sql.UniqueIdentifier, value: parentId },
      fundedByTeacherId: { type: sql.UniqueIdentifier, value: consumesQuota ? teacherUserId : null },
      aydinlatmaAcceptedAt: { type: sql.DateTime2, value: parentConsent?.aydinlatma_accepted_at || null },
      kvkkAcceptedAt: { type: sql.DateTime2, value: parentConsent?.kvkk_accepted_at || null },
    })
    let studentResult
    try {
      studentResult = await insertStudentDb.query(`
        INSERT INTO dbo.Users (full_name, role, phone_number, parent_id, funded_by_teacher_id, aydinlatma_accepted_at, kvkk_accepted_at)
        OUTPUT inserted.id
        VALUES (@fullName, @role, @phone, @parentId, @fundedByTeacherId, @aydinlatmaAcceptedAt, @kvkkAcceptedAt);
      `)
    } catch (insertError) {
      if (studentPhone && (insertError.number === 2601 || insertError.number === 2627)) {
        return json(409, { error: 'Bu öğrenci telefon numarası ile zaten bir kayıt var.' })
      }
      throw insertError
    }
    const studentId = studentResult.recordset[0].id

    const insertProfileDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      grade: { type: sql.NVarChar(20), value: grade },
      phone: { type: sql.NVarChar(30), value: studentPhone },
    })
    await insertProfileDb.query(`
      INSERT INTO dbo.StudentProfiles (student_id, grade, phone) VALUES (@studentId, @grade, @phone);
    `)

    const insertStudentTeacherDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      subjectId: { type: sql.UniqueIdentifier, value: subjectId },
      createdByParentId: { type: sql.UniqueIdentifier, value: parentId },
      teacherFullName: { type: sql.NVarChar(120), value: teacherFullName },
      teacherPhone: { type: sql.NVarChar(30), value: teacherPhone || '' },
      teacherType: { type: sql.NVarChar(30), value: teacherType },
      teacherUserId: { type: sql.UniqueIdentifier, value: teacherUserId },
    })
    await insertStudentTeacherDb.query(`
      INSERT INTO dbo.StudentTeachers (
        student_id, subject_id, created_by_parent_id, teacher_full_name, phone, teacher_type,
        teacher_user_id, access_granted_at
      )
      VALUES (
        @studentId, @subjectId, @createdByParentId, @teacherFullName, @teacherPhone, @teacherType,
        @teacherUserId, SYSUTCDATETIME()
      );
    `)

    return json(201, {
      student: { id: studentId, fullName: studentFullName, restricted: consumesQuota },
      parent: { id: parentId, fullName: parentFullName, phone: parentPhone, hasPanelAccess: parentHasPanelAccess },
    })
  } catch (error) {
    return handleError(error, 'createTeacherStudentHandler', 'Öğrenci eklenemedi.')
  }
}

async function fetchRecurringLessonEntries(teacherUserId) {
  const requestDb = await withRequest({ teacherUserId: { type: sql.UniqueIdentifier, value: teacherUserId } })
  const result = await requestDb.query(`
    SELECT st.id AS student_teacher_id, u.full_name AS student_full_name, s.name AS subject_name,
           st.schedule_json, st.schedule_exceptions_json
    FROM dbo.StudentTeachers st
    INNER JOIN dbo.Users u ON u.id = st.student_id
    LEFT JOIN dbo.Subjects s ON s.id = st.subject_id
    WHERE st.teacher_user_id = @teacherUserId
      AND st.is_active = 1
      AND st.teacher_type = 'ozel_ogretmen'
      AND st.schedule_json IS NOT NULL;
  `)

  return result.recordset.flatMap((record) => {
    const exceptions = parseScheduleJson(record.schedule_exceptions_json)
    return parseScheduleJson(record.schedule_json).map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      studentTeacherId: record.student_teacher_id,
      studentFullName: record.student_full_name,
      subjectName: record.subject_name || null,
      skipDates: exceptions
        .filter((exception) => exception.dayOfWeek === slot.dayOfWeek && exception.startTime === slot.startTime)
        .map((exception) => exception.date),
    }))
  })
}

async function fetchOneTimeLessonEntries(teacherUserId, weekStart) {
  const weekEnd = addDaysISO(weekStart, 6)
  const requestDb = await withRequest({
    teacherUserId: { type: sql.UniqueIdentifier, value: teacherUserId },
    weekStart: { type: sql.Date, value: weekStart },
    weekEnd: { type: sql.Date, value: weekEnd },
  })
  const result = await requestDb.query(`
    SELECT t.id, t.date, t.start_time, t.end_time, st.id AS student_teacher_id,
           u.full_name AS student_full_name, s.name AS subject_name
    FROM dbo.Tasks t
    INNER JOIN dbo.StudentTeachers st ON st.id = t.student_teacher_id
    INNER JOIN dbo.Users u ON u.id = t.student_id
    LEFT JOIN dbo.Subjects s ON s.id = st.subject_id
    WHERE st.teacher_user_id = @teacherUserId
      AND st.is_active = 1
      AND ((t.task_type = 'ders-calisma' AND t.created_by = 'ogretmen') OR t.task_type = 'ozel-ders')
      AND t.date BETWEEN @weekStart AND @weekEnd;
  `)

  return result.recordset.map((record) => ({
    id: record.id,
    date: record.date.toISOString().slice(0, 10),
    startTime: record.start_time,
    endTime: record.end_time,
    studentTeacherId: record.student_teacher_id,
    studentFullName: record.student_full_name,
    subjectName: record.subject_name || null,
  }))
}

async function getTeacherLessonPlanHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) return error

    const weekStart = request.query.get('weekStart')
    const recurringEntries = await fetchRecurringLessonEntries(teacherUserId)
    const oneTimeEntries =
      weekStart && /^\d{4}-\d{2}-\d{2}$/.test(weekStart)
        ? await fetchOneTimeLessonEntries(teacherUserId, weekStart)
        : []

    return json(200, { recurringEntries, oneTimeEntries })
  } catch (error) {
    return handleError(error, 'getTeacherLessonPlanHandler', 'Ders planı yüklenemedi.')
  }
}

async function addTeacherRecurringLessonSlotHandler(request) {
  try {
    const { error, studentTeacherId, teacherType, actorId: teacherUserId } = await requireTeacherStudentContext(request)
    if (error) return error

    if (teacherType !== 'ozel_ogretmen') {
      return json(400, { error: 'Ders planı yalnızca özel ders öğrencileri için kullanılabilir.' })
    }

    const payload = await request.json().catch(() => null)
    const dayOfWeek = payload?.dayOfWeek
    const startTime = payload?.startTime
    const durationMinutes = Number(payload?.durationMinutes)

    if (!WEEKDAY_IDS.includes(dayOfWeek)) {
      return json(400, { error: 'Geçerli bir gün seçilmeli.' })
    }
    if (!isValidTime(startTime)) {
      return json(400, { error: 'Geçerli bir başlangıç saati seçilmeli.' })
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
      return json(400, { error: 'Süre 5 ile 480 dakika arasında olmalı.' })
    }

    const endTime = computeEndTime(startTime, durationMinutes)

    const recurringEntries = await fetchRecurringLessonEntries(teacherUserId)
    const hasConflict = recurringEntries.some(
      (entry) => entry.dayOfWeek === dayOfWeek && timeRangesOverlap(startTime, endTime, entry.startTime, entry.endTime),
    )
    if (hasConflict) {
      return json(409, { error: 'Bu saatte planlanmış başka bir dersiniz var.' })
    }

    const currentDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: studentTeacherId } })
    const currentResult = await currentDb.query(`
      SELECT schedule_json FROM dbo.StudentTeachers WHERE id = @id;
    `)
    const schedule = parseScheduleJson(currentResult.recordset[0]?.schedule_json)
    schedule.push({ dayOfWeek, startTime, endTime })
    schedule.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))

    const updateDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: studentTeacherId },
      scheduleJson: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(schedule) },
    })
    await updateDb.query(`
      UPDATE dbo.StudentTeachers SET schedule_json = @scheduleJson WHERE id = @id;
    `)

    return json(201, { recurringEntries: await fetchRecurringLessonEntries(teacherUserId) })
  } catch (error) {
    return handleError(error, 'addTeacherRecurringLessonSlotHandler', 'Ders eklenemedi.')
  }
}

async function updateTeacherRecurringLessonSlotHandler(request) {
  try {
    const { error, studentTeacherId, teacherType, actorId: teacherUserId } = await requireTeacherStudentContext(request)
    if (error) return error

    if (teacherType !== 'ozel_ogretmen') {
      return json(400, { error: 'Ders planı yalnızca özel ders öğrencileri için kullanılabilir.' })
    }

    const payload = await request.json().catch(() => null)
    const originalDayOfWeek = payload?.originalDayOfWeek
    const originalStartTime = payload?.originalStartTime
    const dayOfWeek = payload?.dayOfWeek
    const startTime = payload?.startTime
    const durationMinutes = Number(payload?.durationMinutes)

    if (!WEEKDAY_IDS.includes(originalDayOfWeek) || !isValidTime(originalStartTime)) {
      return json(400, { error: 'Düzenlenecek ders bulunamadı.' })
    }
    if (!WEEKDAY_IDS.includes(dayOfWeek)) {
      return json(400, { error: 'Geçerli bir gün seçilmeli.' })
    }
    if (!isValidTime(startTime)) {
      return json(400, { error: 'Geçerli bir başlangıç saati seçilmeli.' })
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
      return json(400, { error: 'Süre 5 ile 480 dakika arasında olmalı.' })
    }

    const endTime = computeEndTime(startTime, durationMinutes)

    const currentDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: studentTeacherId } })
    const currentResult = await currentDb.query(`
      SELECT schedule_json FROM dbo.StudentTeachers WHERE id = @id;
    `)
    const schedule = parseScheduleJson(currentResult.recordset[0]?.schedule_json)
    const slotIndex = schedule.findIndex(
      (slot) => slot.dayOfWeek === originalDayOfWeek && slot.startTime === originalStartTime,
    )
    if (slotIndex === -1) {
      return json(404, { error: 'Düzenlenecek ders bulunamadı.' })
    }

    const otherRecurringEntries = (await fetchRecurringLessonEntries(teacherUserId)).filter(
      (entry) =>
        !(
          entry.studentTeacherId === studentTeacherId &&
          entry.dayOfWeek === originalDayOfWeek &&
          entry.startTime === originalStartTime
        ),
    )
    const hasConflict = otherRecurringEntries.some(
      (entry) => entry.dayOfWeek === dayOfWeek && timeRangesOverlap(startTime, endTime, entry.startTime, entry.endTime),
    )
    if (hasConflict) {
      return json(409, { error: 'Bu saatte planlanmış başka bir dersiniz var.' })
    }

    schedule[slotIndex] = { dayOfWeek, startTime, endTime }
    schedule.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))

    const updateDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: studentTeacherId },
      scheduleJson: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(schedule) },
    })
    await updateDb.query(`
      UPDATE dbo.StudentTeachers SET schedule_json = @scheduleJson WHERE id = @id;
    `)

    return json(200, { recurringEntries: await fetchRecurringLessonEntries(teacherUserId) })
  } catch (error) {
    return handleError(error, 'updateTeacherRecurringLessonSlotHandler', 'Ders güncellenemedi.')
  }
}

async function deleteTeacherRecurringLessonSlotHandler(request) {
  try {
    const { error, studentTeacherId, teacherType, actorId: teacherUserId } = await requireTeacherStudentContext(request)
    if (error) return error

    if (teacherType !== 'ozel_ogretmen') {
      return json(400, { error: 'Ders planı yalnızca özel ders öğrencileri için kullanılabilir.' })
    }

    const payload = await request.json().catch(() => null)
    const dayOfWeek = payload?.dayOfWeek
    const startTime = payload?.startTime

    if (!WEEKDAY_IDS.includes(dayOfWeek) || !isValidTime(startTime)) {
      return json(400, { error: 'Silinecek ders bulunamadı.' })
    }

    const currentDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: studentTeacherId } })
    const currentResult = await currentDb.query(`
      SELECT schedule_json FROM dbo.StudentTeachers WHERE id = @id;
    `)
    const schedule = parseScheduleJson(currentResult.recordset[0]?.schedule_json)
    const nextSchedule = schedule.filter((slot) => !(slot.dayOfWeek === dayOfWeek && slot.startTime === startTime))
    if (nextSchedule.length === schedule.length) {
      return json(404, { error: 'Silinecek ders bulunamadı.' })
    }

    const updateDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: studentTeacherId },
      scheduleJson: { type: sql.NVarChar(sql.MAX), value: nextSchedule.length ? JSON.stringify(nextSchedule) : null },
    })
    await updateDb.query(`
      UPDATE dbo.StudentTeachers SET schedule_json = @scheduleJson WHERE id = @id;
    `)

    return json(200, { recurringEntries: await fetchRecurringLessonEntries(teacherUserId) })
  } catch (error) {
    return handleError(error, 'deleteTeacherRecurringLessonSlotHandler', 'Ders silinemedi.')
  }
}

// Tekrarlayan bir ders kuralının tek bir haftadaki oluşumunu, kuralın kendisini bozmadan
// başka bir tarih/saate taşır: schedule_exceptions_json'a o oluşumu "atla" kaydı eklenir ve
// yeni tarih/saatte gerçek bir Tasks satırı (tek seferlik ders) oluşturulur.
async function moveTeacherRecurringLessonOccurrenceHandler(request) {
  try {
    const { error, studentId, studentTeacherId, teacherType, subjectId, actorId: teacherUserId } =
      await requireTeacherStudentContext(request)
    if (error) return error

    if (teacherType !== 'ozel_ogretmen') {
      return json(400, { error: 'Ders planı yalnızca özel ders öğrencileri için kullanılabilir.' })
    }

    const payload = await request.json().catch(() => null)
    const dayOfWeek = payload?.dayOfWeek
    const originalStartTime = payload?.originalStartTime
    const originalDate = payload?.originalDate
    const date = payload?.date
    const startTime = payload?.startTime
    const durationMinutes = Number(payload?.durationMinutes)

    if (!WEEKDAY_IDS.includes(dayOfWeek) || !isValidTime(originalStartTime)) {
      return json(400, { error: 'Taşınacak ders bulunamadı.' })
    }
    if (!originalDate || !/^\d{4}-\d{2}-\d{2}$/.test(originalDate) || weekdayIdForDate(originalDate) !== dayOfWeek) {
      return json(400, { error: 'Taşınacak dersin tarihi geçersiz.' })
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json(400, { error: 'Geçerli bir tarih seçilmeli.' })
    }
    const todayISO = new Date().toISOString().slice(0, 10)
    if (date < todayISO) {
      return json(400, { error: 'Geçmiş bir tarihe ders taşınamaz.' })
    }
    if (!isValidTime(startTime)) {
      return json(400, { error: 'Geçerli bir başlangıç saati seçilmeli.' })
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
      return json(400, { error: 'Süre 5 ile 480 dakika arasında olmalı.' })
    }

    const endTime = computeEndTime(startTime, durationMinutes)

    const currentDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: studentTeacherId } })
    const currentResult = await currentDb.query(`
      SELECT schedule_json, schedule_exceptions_json FROM dbo.StudentTeachers WHERE id = @id;
    `)
    const currentRecord = currentResult.recordset[0]
    const schedule = parseScheduleJson(currentRecord?.schedule_json)
    const slotExists = schedule.some((slot) => slot.dayOfWeek === dayOfWeek && slot.startTime === originalStartTime)
    if (!slotExists) {
      return json(404, { error: 'Taşınacak ders bulunamadı.' })
    }

    const exceptions = parseScheduleJson(currentRecord?.schedule_exceptions_json)
    const alreadySkipped = exceptions.some(
      (exception) =>
        exception.dayOfWeek === dayOfWeek && exception.startTime === originalStartTime && exception.date === originalDate,
    )
    if (alreadySkipped) {
      return json(409, { error: 'Bu ders zaten başka bir tarihe taşınmış.' })
    }

    const recurringEntries = (await fetchRecurringLessonEntries(teacherUserId)).filter(
      (entry) =>
        !(entry.studentTeacherId === studentTeacherId && entry.dayOfWeek === dayOfWeek && entry.startTime === originalStartTime),
    )
    const newDayOfWeek = weekdayIdForDate(date)
    const recurringConflict = recurringEntries.some(
      (entry) => entry.dayOfWeek === newDayOfWeek && timeRangesOverlap(startTime, endTime, entry.startTime, entry.endTime),
    )

    const oneTimeEntries = await fetchOneTimeLessonEntries(teacherUserId, date)
    const oneTimeConflict = oneTimeEntries.some(
      (entry) => entry.date === date && timeRangesOverlap(startTime, endTime, entry.startTime, entry.endTime),
    )

    if (recurringConflict || oneTimeConflict) {
      return json(409, { error: 'Bu saatte planlanmış başka bir dersiniz var.' })
    }

    const subjectDb = await withRequest({ subjectId: { type: sql.UniqueIdentifier, value: subjectId } })
    const subjectResult = await subjectDb.query(`SELECT TOP 1 name FROM dbo.Subjects WHERE id = @subjectId;`)
    const subjectName = subjectResult.recordset[0]?.name || null
    const title = subjectName ? `${subjectName} Dersi` : 'Özel Ders'

    await withTransaction(async (requestInTransaction) => {
      const nextExceptions = [...exceptions, { dayOfWeek, startTime: originalStartTime, date: originalDate }]
      const updateScheduleDb = await requestInTransaction({
        id: { type: sql.UniqueIdentifier, value: studentTeacherId },
        scheduleExceptionsJson: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(nextExceptions) },
      })
      await updateScheduleDb.query(`
        UPDATE dbo.StudentTeachers SET schedule_exceptions_json = @scheduleExceptionsJson WHERE id = @id;
      `)

      const insertDb = await requestInTransaction({
        studentId: { type: sql.UniqueIdentifier, value: studentId },
        studentTeacherId: { type: sql.UniqueIdentifier, value: studentTeacherId },
        date: { type: sql.Date, value: date },
        title: { type: sql.NVarChar(200), value: title },
        subject: { type: sql.NVarChar(100), value: subjectName },
        startTime: { type: sql.Char(5), value: startTime },
        endTime: { type: sql.Char(5), value: endTime },
        durationMinutes: { type: sql.Int, value: durationMinutes },
      })
      await insertDb.query(`
        INSERT INTO dbo.Tasks (
          student_id, student_teacher_id, date, title, subject, task_type,
          start_time, end_time, duration_minutes, status, priority, created_by, is_draft
        )
        VALUES (
          @studentId, @studentTeacherId, @date, @title, @subject, 'ders-calisma',
          @startTime, @endTime, @durationMinutes, 'bekliyor', 'orta', 'ogretmen', 0
        );
      `)
    })

    return json(200, { success: true })
  } catch (error) {
    return handleError(error, 'moveTeacherRecurringLessonOccurrenceHandler', 'Ders taşınamadı.')
  }
}

async function addTeacherOneTimeLessonHandler(request) {
  try {
    const {
      error,
      studentId,
      studentTeacherId,
      teacherType,
      studentFullName,
      subjectId,
      actorId: teacherUserId,
    } = await requireTeacherStudentContext(request)
    if (error) return error

    if (teacherType !== 'ozel_ogretmen') {
      return json(400, { error: 'Ders planı yalnızca özel ders öğrencileri için kullanılabilir.' })
    }

    const payload = await request.json().catch(() => null)
    const date = payload?.date
    const startTime = payload?.startTime
    const durationMinutes = Number(payload?.durationMinutes)

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json(400, { error: 'Geçerli bir tarih seçilmeli.' })
    }
    const todayISO = new Date().toISOString().slice(0, 10)
    if (date < todayISO) {
      return json(400, { error: 'Geçmiş bir tarihe ders eklenemez.' })
    }
    if (!isValidTime(startTime)) {
      return json(400, { error: 'Geçerli bir başlangıç saati seçilmeli.' })
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
      return json(400, { error: 'Süre 5 ile 480 dakika arasında olmalı.' })
    }

    const endTime = computeEndTime(startTime, durationMinutes)

    const recurringEntries = await fetchRecurringLessonEntries(teacherUserId)
    const dayOfWeek = weekdayIdForDate(date)
    const recurringConflict = recurringEntries.some(
      (entry) => entry.dayOfWeek === dayOfWeek && timeRangesOverlap(startTime, endTime, entry.startTime, entry.endTime),
    )

    const oneTimeEntries = await fetchOneTimeLessonEntries(teacherUserId, date)
    const oneTimeConflict = oneTimeEntries.some(
      (entry) => entry.date === date && timeRangesOverlap(startTime, endTime, entry.startTime, entry.endTime),
    )

    if (recurringConflict || oneTimeConflict) {
      return json(409, { error: 'Bu saatte planlanmış başka bir dersiniz var.' })
    }

    const subjectDb = await withRequest({ subjectId: { type: sql.UniqueIdentifier, value: subjectId } })
    const subjectResult = await subjectDb.query(`SELECT TOP 1 name FROM dbo.Subjects WHERE id = @subjectId;`)
    const subjectName = subjectResult.recordset[0]?.name || null
    const title = subjectName ? `${subjectName} Dersi` : 'Özel Ders'

    const insertDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      studentTeacherId: { type: sql.UniqueIdentifier, value: studentTeacherId },
      date: { type: sql.Date, value: date },
      title: { type: sql.NVarChar(200), value: title },
      subject: { type: sql.NVarChar(100), value: subjectName },
      startTime: { type: sql.Char(5), value: startTime },
      endTime: { type: sql.Char(5), value: endTime },
      durationMinutes: { type: sql.Int, value: durationMinutes },
    })
    const insertResult = await insertDb.query(`
      INSERT INTO dbo.Tasks (
        student_id, student_teacher_id, date, title, subject, task_type,
        start_time, end_time, duration_minutes, status, priority, created_by, is_draft
      )
      OUTPUT inserted.id
      VALUES (
        @studentId, @studentTeacherId, @date, @title, @subject, 'ders-calisma',
        @startTime, @endTime, @durationMinutes, 'bekliyor', 'orta', 'ogretmen', 0
      );
    `)

    return json(201, {
      lesson: {
        id: insertResult.recordset[0].id,
        date,
        startTime,
        endTime,
        studentTeacherId,
        studentFullName,
        subjectName,
      },
    })
  } catch (error) {
    return handleError(error, 'addTeacherOneTimeLessonHandler', 'Ders eklenemedi.')
  }
}

async function updateTeacherOneTimeLessonHandler(request) {
  try {
    const { error, studentTeacherId, teacherType, actorId: teacherUserId } = await requireTeacherStudentContext(request)
    if (error) return error

    if (teacherType !== 'ozel_ogretmen') {
      return json(400, { error: 'Ders planı yalnızca özel ders öğrencileri için kullanılabilir.' })
    }

    const lessonId = request.params.lessonId
    const payload = await request.json().catch(() => null)
    const date = payload?.date
    const startTime = payload?.startTime
    const durationMinutes = Number(payload?.durationMinutes)

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json(400, { error: 'Geçerli bir tarih seçilmeli.' })
    }
    if (!isValidTime(startTime)) {
      return json(400, { error: 'Geçerli bir başlangıç saati seçilmeli.' })
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
      return json(400, { error: 'Süre 5 ile 480 dakika arasında olmalı.' })
    }

    const lessonDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: lessonId },
      studentTeacherId: { type: sql.UniqueIdentifier, value: studentTeacherId },
    })
    const lessonResult = await lessonDb.query(`
      SELECT TOP 1 id FROM dbo.Tasks
      WHERE id = @id AND student_teacher_id = @studentTeacherId
        AND ((task_type = 'ders-calisma' AND created_by = 'ogretmen') OR task_type = 'ozel-ders');
    `)
    if (!lessonResult.recordset[0]) {
      return json(404, { error: 'Ders bulunamadı.' })
    }

    const endTime = computeEndTime(startTime, durationMinutes)

    const recurringEntries = await fetchRecurringLessonEntries(teacherUserId)
    const dayOfWeek = weekdayIdForDate(date)
    const recurringConflict = recurringEntries.some(
      (entry) => entry.dayOfWeek === dayOfWeek && timeRangesOverlap(startTime, endTime, entry.startTime, entry.endTime),
    )

    const oneTimeEntries = (await fetchOneTimeLessonEntries(teacherUserId, date)).filter((entry) => entry.id !== lessonId)
    const oneTimeConflict = oneTimeEntries.some(
      (entry) => entry.date === date && timeRangesOverlap(startTime, endTime, entry.startTime, entry.endTime),
    )

    if (recurringConflict || oneTimeConflict) {
      return json(409, { error: 'Bu saatte planlanmış başka bir dersiniz var.' })
    }

    const updateDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: lessonId },
      date: { type: sql.Date, value: date },
      startTime: { type: sql.Char(5), value: startTime },
      endTime: { type: sql.Char(5), value: endTime },
      durationMinutes: { type: sql.Int, value: durationMinutes },
    })
    await updateDb.query(`
      UPDATE dbo.Tasks
      SET date = @date, start_time = @startTime, end_time = @endTime, duration_minutes = @durationMinutes
      WHERE id = @id;
    `)

    return json(200, { oneTimeEntries: await fetchOneTimeLessonEntries(teacherUserId, date) })
  } catch (error) {
    return handleError(error, 'updateTeacherOneTimeLessonHandler', 'Ders güncellenemedi.')
  }
}

async function deleteTeacherOneTimeLessonHandler(request) {
  try {
    const { error, studentTeacherId } = await requireTeacherStudentContext(request)
    if (error) return error

    const lessonId = request.params.lessonId

    const deleteDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: lessonId },
      studentTeacherId: { type: sql.UniqueIdentifier, value: studentTeacherId },
    })
    const deleteResult = await deleteDb.query(`
      DELETE FROM dbo.Tasks
      OUTPUT deleted.id
      WHERE id = @id AND student_teacher_id = @studentTeacherId
        AND ((task_type = 'ders-calisma' AND created_by = 'ogretmen') OR task_type = 'ozel-ders');
    `)
    if (!deleteResult.recordset[0]) {
      return json(404, { error: 'Ders bulunamadı.' })
    }

    return json(200, { success: true })
  } catch (error) {
    return handleError(error, 'deleteTeacherOneTimeLessonHandler', 'Ders silinemedi.')
  }
}

async function listTeacherResourceBooksHandler(request) {
  try {
    const { error, studentId, studentTeacherId } = await requireTeacherStudentContext(request)
    if (error) return error

    const resourceBooks = (await fetchTeacherResourceBooks(studentId, studentTeacherId)).filter(
      (book) => book.assigned,
    )
    return json(200, { resourceBooks })
  } catch (error) {
    return handleError(error, 'listTeacherResourceBooksHandler', 'Kaynaklar yüklenemedi.')
  }
}

// Profil Kartı'ndaki "Özel Kaynaklar" adımı için: öğretmenin bu öğrenciyle paylaştığı derse
// ait, "özel" kaynak türündeki (resource_source = 'ozel') tüm kütüphane kaynaklarını listeler
// ve öğretmenin bu öğrenciye zaten atadıklarını (StudentTeacherResourceBooks) işaretler —
// böylece öğretmen tek ekrandan toplu olarak yeni kaynak atayabilir.
async function listTeacherStudentPrivateResourceBooksHandler(request) {
  try {
    const { error, studentId, subjectId, studentTeacherId, actorId: teacherUserId } = await requireTeacherStudentContext(
      request,
      { includeInactive: true },
    )
    if (error) return error

    const gradeDb = await withRequest({ studentId: { type: sql.UniqueIdentifier, value: studentId } })
    const gradeResult = await gradeDb.query(`
      SELECT grade FROM dbo.StudentProfiles WHERE student_id = @studentId;
    `)
    const grade = gradeResult.recordset[0]?.grade || null
    if (!grade) {
      return json(200, { resourceBooks: [], gradeMissing: true })
    }

    const resourceBooks = await fetchLibraryResourceBooks({
      grade,
      subjectId,
      actorUserId: teacherUserId,
      source: 'ozel',
    })

    const assignedDb = await withRequest({
      studentTeacherId: { type: sql.UniqueIdentifier, value: studentTeacherId },
    })
    const assignedResult = await assignedDb.query(`
      SELECT resource_book_id FROM dbo.StudentTeacherResourceBooks WHERE teacher_id = @studentTeacherId;
    `)
    const assignedIds = new Set(assignedResult.recordset.map((record) => String(record.resource_book_id)))

    return json(200, {
      resourceBooks: resourceBooks.map((book) => ({ ...book, assigned: assignedIds.has(String(book.id)) })),
      gradeMissing: false,
    })
  } catch (error) {
    return handleError(error, 'listTeacherStudentPrivateResourceBooksHandler', 'Kaynaklar yüklenemedi.')
  }
}

// Profil Kartı > Kütüphane sekmesinden öğretmenin, öğrenciyle paylaştığı derse ait bir "özel"
// kütüphane kaynağını öğrenciye atamasını sağlar. Kaynak öğrencinin takip listesinde
// (StudentResourceBooks) yoksa oraya da eklenir — StudentTeacherResourceBooks'un FK'si bunu
// zorunlu kılar. İşlem idempotenttir: zaten atanmış kaynak için de 200 döner.
async function assignTeacherLibraryResourceBookHandler(request) {
  try {
    const { error, studentId, subjectId, studentTeacherId, actorId: teacherUserId } =
      await requireTeacherStudentContext(request, { includeInactive: true })
    if (error) return error

    const resourceBookId = request.params.resourceBookId
    if (!resourceBookId) {
      return json(400, { error: 'Kaynak belirtilmeli.' })
    }

    const gradeDb = await withRequest({ studentId: { type: sql.UniqueIdentifier, value: studentId } })
    const gradeResult = await gradeDb.query(`
      SELECT grade FROM dbo.StudentProfiles WHERE student_id = @studentId;
    `)
    const grade = gradeResult.recordset[0]?.grade || null
    if (!grade) {
      return json(400, { error: 'Önce bu öğrencinin sınıfını tanımlayın.' })
    }

    // Yalnızca Kütüphane sekmesinde gösterilen kaynaklar atanabilir (aynı sınıf/ders, "özel" tür,
    // öğretmenin görebildiği görünürlük) — liste ucuyla birebir aynı filtre.
    const libraryBooks = await fetchLibraryResourceBooks({
      grade,
      subjectId,
      actorUserId: teacherUserId,
      source: 'ozel',
    })
    const allowed = libraryBooks.some(
      (book) => String(book.id).toLowerCase() === String(resourceBookId).toLowerCase(),
    )
    if (!allowed) {
      return json(404, { error: 'Kaynak bulunamadı.' })
    }

    await withTransaction(async (requestInTransaction) => {
      const assignDb = await requestInTransaction({
        studentId: { type: sql.UniqueIdentifier, value: studentId },
        studentTeacherId: { type: sql.UniqueIdentifier, value: studentTeacherId },
        resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId },
      })
      await assignDb.query(`
        INSERT INTO dbo.StudentResourceBooks (student_id, resource_book_id)
        SELECT @studentId, @resourceBookId
        WHERE NOT EXISTS (
          SELECT 1 FROM dbo.StudentResourceBooks
          WHERE student_id = @studentId AND resource_book_id = @resourceBookId
        );

        INSERT INTO dbo.StudentTeacherResourceBooks (teacher_id, student_id, resource_book_id)
        SELECT @studentTeacherId, @studentId, @resourceBookId
        WHERE NOT EXISTS (
          SELECT 1 FROM dbo.StudentTeacherResourceBooks
          WHERE teacher_id = @studentTeacherId AND resource_book_id = @resourceBookId
        );
      `)
    })

    return json(200, { success: true })
  } catch (error) {
    return handleError(error, 'assignTeacherLibraryResourceBookHandler', 'Kaynak atanamadı.')
  }
}

// Öğretmenin bir kaynağı öğrenciden geri almasını sağlar: yalnızca öğretmen–öğrenci atama
// bağını (StudentTeacherResourceBooks) siler; öğrencinin takip listesindeki (StudentResourceBooks)
// kaydına ve varsa ilerleme verisine dokunmaz. İşlem idempotenttir.
async function unassignTeacherLibraryResourceBookHandler(request) {
  try {
    const { error, studentTeacherId } = await requireTeacherStudentContext(request, { includeInactive: true })
    if (error) return error

    const resourceBookId = request.params.resourceBookId
    if (!resourceBookId) {
      return json(400, { error: 'Kaynak belirtilmeli.' })
    }

    const deleteDb = await withRequest({
      studentTeacherId: { type: sql.UniqueIdentifier, value: studentTeacherId },
      resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId },
    })
    await deleteDb.query(`
      DELETE FROM dbo.StudentTeacherResourceBooks
      WHERE teacher_id = @studentTeacherId AND resource_book_id = @resourceBookId;
    `)

    return json(200, { success: true })
  } catch (error) {
    return handleError(error, 'unassignTeacherLibraryResourceBookHandler', 'Kaynak ataması kaldırılamadı.')
  }
}

async function listTeacherResourceBookTopicsHandler(request) {
  try {
    const { error, studentId, studentTeacherId } = await requireTeacherStudentContext(request)
    if (error) return error

    const resourceBookId = request.query.get('resourceBookId')
    if (!resourceBookId) {
      return json(200, { topics: [] })
    }

    const trackedDb = await withRequest({
      studentTeacherId: { type: sql.UniqueIdentifier, value: studentTeacherId },
      resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId },
    })
    const trackedResult = await trackedDb.query(`
      SELECT TOP 1 1 FROM dbo.StudentTeacherResourceBooks
      WHERE teacher_id = @studentTeacherId AND resource_book_id = @resourceBookId;
    `)
    if (!trackedResult.recordset[0]) {
      return json(404, { error: 'Bu kaynak sizin takip ettiğiniz kaynaklardan değil.' })
    }

    const topics = await fetchResourceBookTopicsWithTests(resourceBookId, studentId)
    return json(200, { topics })
  } catch (error) {
    return handleError(error, 'listTeacherResourceBookTopicsHandler', 'Konular yüklenemedi.')
  }
}

// Öğretmenin bir testi elle işaretleyebilmesi/optik formla notlayabilmesi/hata fotoğrafı
// ekleyebilmesi için, o testin öğretmenin takip ettiği bir kaynağa ait olduğunu doğrular
// (dbo.StudentTeacherResourceBooks — veli tarafındaki verifyStudentTestAssignment'ın muadili).
async function verifyTeacherTestAssignment(studentTeacherId, testId) {
  const requestDb = await withRequest({
    studentTeacherId: { type: sql.UniqueIdentifier, value: studentTeacherId },
    testId: { type: sql.UniqueIdentifier, value: testId },
  })
  const result = await requestDb.query(`
    SELECT TOP 1 tt.id
    FROM dbo.ResourceBookTopicTests tt
    INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
    INNER JOIN dbo.ResourceBooks rb ON rb.id = t.resource_book_id
    INNER JOIN dbo.StudentTeacherResourceBooks strb ON strb.resource_book_id = rb.id AND strb.teacher_id = @studentTeacherId
    WHERE tt.id = @testId AND rb.is_active = 1;
  `)
  return Boolean(result.recordset[0])
}

function parseNullableCount(value) {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) return null
  return parsed
}

async function markTeacherResourceBookTopicTestCompletionHandler(request) {
  try {
    const { error, studentId, studentTeacherId, actorId } = await requireTeacherStudentContext(request)
    if (error) return error

    const testId = request.params.testId
    const isAssigned = await verifyTeacherTestAssignment(studentTeacherId, testId)
    if (!isAssigned) {
      return json(404, { error: 'Test sizin takip ettiğiniz kaynaklardan değil.' })
    }

    const payload = await request.json().catch(() => null)
    const correctCount = parseNullableCount(payload?.correctCount)
    const wrongCount = parseNullableCount(payload?.wrongCount)
    const blankCount = parseNullableCount(payload?.blankCount)

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      testId: { type: sql.UniqueIdentifier, value: testId },
      markedByUserId: { type: sql.UniqueIdentifier, value: actorId },
      correctCount: { type: sql.Int, value: correctCount },
      wrongCount: { type: sql.Int, value: wrongCount },
      blankCount: { type: sql.Int, value: blankCount },
    })
    await requestDb.query(`
      MERGE dbo.StudentManualTestCompletions AS target
      USING (SELECT @studentId AS student_id, @testId AS test_id) AS source
        ON target.student_id = source.student_id AND target.test_id = source.test_id
      WHEN MATCHED THEN UPDATE SET
        correct_count = @correctCount,
        wrong_count = @wrongCount,
        blank_count = @blankCount
      WHEN NOT MATCHED THEN
        INSERT (student_id, test_id, marked_by_user_id, correct_count, wrong_count, blank_count)
        VALUES (@studentId, @testId, @markedByUserId, @correctCount, @wrongCount, @blankCount);
    `)

    return json(200, { success: true, completionSource: 'manual', correctCount, wrongCount, blankCount })
  } catch (error) {
    return handleError(error, 'markTeacherResourceBookTopicTestCompletionHandler', 'Test tamamlandı olarak işaretlenemedi.')
  }
}

async function unmarkTeacherResourceBookTopicTestCompletionHandler(request) {
  try {
    const { error, studentId, studentTeacherId } = await requireTeacherStudentContext(request)
    if (error) return error

    const testId = request.params.testId
    const isAssigned = await verifyTeacherTestAssignment(studentTeacherId, testId)
    if (!isAssigned) {
      return json(404, { error: 'Test sizin takip ettiğiniz kaynaklardan değil.' })
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      testId: { type: sql.UniqueIdentifier, value: testId },
    })
    await requestDb.query(`
      DELETE FROM dbo.StudentManualTestCompletions WHERE student_id = @studentId AND test_id = @testId;
    `)

    return json(200, { success: true, completionSource: null })
  } catch (error) {
    return handleError(error, 'unmarkTeacherResourceBookTopicTestCompletionHandler', 'İşaret kaldırılamadı.')
  }
}

async function submitTeacherManualOpticalAnswersHandler(request) {
  try {
    const { error, studentId, studentTeacherId, actorId } = await requireTeacherStudentContext(request)
    if (error) return error

    const testId = request.params.testId
    const isAssigned = await verifyTeacherTestAssignment(studentTeacherId, testId)
    if (!isAssigned) {
      return json(404, { error: 'Test sizin takip ettiğiniz kaynaklardan değil.' })
    }

    const testDb = await withRequest({ testId: { type: sql.UniqueIdentifier, value: testId } })
    const testResult = await testDb.query(`SELECT question_count FROM dbo.ResourceBookTopicTests WHERE id = @testId;`)
    const questionCount = testResult.recordset[0]?.question_count
    if (!questionCount) {
      return json(404, { error: 'Test bulunamadı.' })
    }

    const payload = await request.json().catch(() => null)
    const { answers, result } = await gradeTestAnswers(testId, questionCount, payload?.answers)
    if (!result) {
      return json(400, { error: 'Tüm soruları işaretleyin — bu test için notlama ancak eksiksiz cevap anahtarıyla yapılabilir.' })
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      testId: { type: sql.UniqueIdentifier, value: testId },
      markedByUserId: { type: sql.UniqueIdentifier, value: actorId },
      correctCount: { type: sql.Int, value: result.correct },
      wrongCount: { type: sql.Int, value: result.wrong },
      blankCount: { type: sql.Int, value: result.blank },
      answersJson: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(answers) },
    })
    await requestDb.query(`
      MERGE dbo.StudentManualTestCompletions AS target
      USING (SELECT @studentId AS student_id, @testId AS test_id) AS source
        ON target.student_id = source.student_id AND target.test_id = source.test_id
      WHEN MATCHED THEN UPDATE SET
        correct_count = @correctCount,
        wrong_count = @wrongCount,
        blank_count = @blankCount,
        answers_json = @answersJson
      WHEN NOT MATCHED THEN
        INSERT (student_id, test_id, marked_by_user_id, correct_count, wrong_count, blank_count, answers_json)
        VALUES (@studentId, @testId, @markedByUserId, @correctCount, @wrongCount, @blankCount, @answersJson);
    `)

    return json(200, {
      success: true,
      completionSource: 'manual',
      correctCount: result.correct,
      wrongCount: result.wrong,
      blankCount: result.blank,
      correctLabels: result.correctLabels,
      answers,
    })
  } catch (error) {
    return handleError(error, 'submitTeacherManualOpticalAnswersHandler', 'Cevaplar kaydedilemedi.')
  }
}

async function saveTeacherManualWrongQuestionPhotoHandler(request) {
  try {
    const testId = request.params.testId
    const orderNo = request.params.orderNo
    const payload = await request.json().catch(() => null)
    const { error, studentId, studentTeacherId } = await requireTeacherStudentContext(request)
    if (error) return error

    const isAssigned = await verifyTeacherTestAssignment(studentTeacherId, testId)
    if (!isAssigned) {
      return json(404, { error: 'Test sizin takip ettiğiniz kaynaklardan değil.' })
    }

    const photoCheck = sanitizeMistakePhoto(payload?.photo)
    if (photoCheck.error) {
      return json(400, { error: photoCheck.error })
    }

    const completionDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      testId: { type: sql.UniqueIdentifier, value: testId },
    })
    const completionResult = await completionDb.query(`
      SELECT answers_json FROM dbo.StudentManualTestCompletions WHERE student_id = @studentId AND test_id = @testId;
    `)
    const completionRecord = completionResult.recordset[0]
    if (!completionRecord) {
      return json(404, { error: 'Bu test için kaydedilmiş bir sonuç bulunamadı.' })
    }

    const answers = completionRecord.answers_json ? JSON.parse(completionRecord.answers_json) : {}
    const studentAnswer = answers[orderNo]

    const keyDb = await withRequest({
      testId: { type: sql.UniqueIdentifier, value: testId },
      orderNo: { type: sql.Int, value: Number(orderNo) },
    })
    const keyResult = await keyDb.query(`
      SELECT correct_label FROM dbo.TestAnswerKeys WHERE test_id = @testId AND order_no = @orderNo;
    `)
    const correctLabel = keyResult.recordset[0]?.correct_label?.trim()

    const isActuallyWrong = Boolean(correctLabel) && Boolean(studentAnswer) && studentAnswer !== correctLabel
    if (!isActuallyWrong) {
      return json(400, { error: 'Bu soru yanlış işaretlenmemiş.' })
    }

    const testInfoDb = await withRequest({ testId: { type: sql.UniqueIdentifier, value: testId } })
    const testInfoResult = await testInfoDb.query(`
      SELECT t.name AS test_name, tp.name AS topic_name, rb.name AS book_name, pub.name AS publisher_name, s.name AS subject_name
      FROM dbo.ResourceBookTopicTests t
      JOIN dbo.ResourceBookTopics tp ON tp.id = t.topic_id
      JOIN dbo.ResourceBooks rb ON rb.id = tp.resource_book_id
      JOIN dbo.Publishers pub ON pub.id = rb.publisher_id
      LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
      WHERE t.id = @testId;
    `)
    const testInfo = testInfoResult.recordset[0]
    if (!testInfo) {
      return json(404, { error: 'Test bulunamadı.' })
    }

    const bindings = {
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      testId: { type: sql.UniqueIdentifier, value: testId },
      questionNumber: { type: sql.NVarChar(20), value: orderNo },
      subject: { type: sql.NVarChar(100), value: testInfo.subject_name || 'Genel' },
      topic: { type: sql.NVarChar(200), value: testInfo.topic_name || null },
      testName: { type: sql.NVarChar(200), value: testInfo.test_name || null },
      bookName: { type: sql.NVarChar(200), value: testInfo.book_name || null },
      publisherName: { type: sql.NVarChar(200), value: testInfo.publisher_name || null },
      photoUrl: { type: sql.NVarChar(sql.MAX), value: photoCheck.value },
      errorType: { type: sql.NVarChar(50), value: 'cevap-kagidi' },
    }

    const updateDb = await withRequest(bindings)
    const updateResult = await updateDb.query(`
      UPDATE dbo.WrongQuestions
      SET topic = @topic, test_name = @testName, book_name = @bookName, publisher_name = @publisherName, photo_url = @photoUrl
      OUTPUT ${WRONG_QUESTION_OUTPUT_COLUMNS}
      WHERE student_id = @studentId AND task_id IS NULL AND test_id = @testId AND question_number = @questionNumber;
    `)

    let wrongQuestionRecord = updateResult.recordset[0]
    if (!wrongQuestionRecord) {
      const insertDb = await withRequest(bindings)
      const insertResult = await insertDb.query(`
        INSERT INTO dbo.WrongQuestions (student_id, test_id, subject, topic, test_name, book_name, publisher_name, question_number, error_type, photo_url)
        OUTPUT ${WRONG_QUESTION_OUTPUT_COLUMNS}
        VALUES (@studentId, @testId, @subject, @topic, @testName, @bookName, @publisherName, @questionNumber, @errorType, @photoUrl);
      `)
      wrongQuestionRecord = insertResult.recordset[0]
    }

    return json(200, { wrongQuestion: sanitizeWrongQuestion(wrongQuestionRecord) })
  } catch (error) {
    return handleError(error, 'saveTeacherManualWrongQuestionPhotoHandler', 'Fotoğraf kaydedilemedi.')
  }
}

async function listTeacherStudentHomeworksHandler(request) {
  try {
    const { error, studentId, subjectId, studentTeacherId } = await requireTeacherStudentContext(request)
    if (error) return error

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      subjectId: { type: sql.UniqueIdentifier, value: subjectId },
      studentTeacherId: { type: sql.UniqueIdentifier, value: studentTeacherId },
    })
    const result = await requestDb.query(`
      ${SELECT_HOMEWORK}
        AND h.student_id = @studentId AND h.subject_id = @subjectId
        AND (h.resource_book_id IS NULL OR EXISTS (
          SELECT 1 FROM dbo.StudentTeacherResourceBooks strb
          WHERE strb.teacher_id = @studentTeacherId AND strb.resource_book_id = h.resource_book_id
        ))
      ORDER BY h.date ASC;
    `)

    return json(200, { homeworks: result.recordset.map(sanitizeHomework) })
  } catch (error) {
    return handleError(error, 'listTeacherStudentHomeworksHandler', 'Ödevler yüklenemedi.')
  }
}

async function createTeacherHomeworkHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const { error, studentId, subjectId, studentTeacherId } = await requireTeacherStudentContext(request, {
      studentTeacherId: payload?.studentTeacherId,
    })
    if (error) return error

    const isSchoolHomework = payload?.homeworkType === 'okul-odevi' || Boolean(payload?.schoolResourceId)
    const resourceBookId = isSchoolHomework ? null : payload?.resourceBookId || null
    const schoolResourceId = isSchoolHomework ? payload?.schoolResourceId || null : null
    const testIds = Array.isArray(payload?.testIds) ? payload.testIds : []
    const title = payload?.title?.trim()
    const description = payload?.description?.trim() || null
    const assignedDate = payload?.assignedDate
    const dueDate = payload?.dueDate
    const totalQuestionCount = Number(payload?.totalQuestionCount) || 0
    const totalPageCount = payload?.totalPageCount != null ? Number(payload.totalPageCount) || 0 : null
    const priority = payload?.priority || 'orta'
    const taskDate = payload?.taskDate || null
    const taskTime = payload?.taskTime || null
    const taskDurationMinutes = Number(payload?.taskDurationMinutes) || null

    if (isSchoolHomework) {
      if (!schoolResourceId) {
        return json(400, { error: 'Okul ödevi için bir okul kaynağı seçilmeli.' })
      }
    } else if (!resourceBookId) {
      return json(400, { error: 'Ödev için takip ettiğiniz bir kaynak seçilmeli.' })
    }
    if (!title || title.length < 2) {
      return json(400, { error: 'Ödev başlığı en az 2 karakter olmalı.' })
    }
    if (!assignedDate || !dueDate) {
      return json(400, { error: 'Tarih bilgileri zorunludur.' })
    }

    let assignedResource = null
    if (isSchoolHomework) {
      const schoolResource = await getAssignedSchoolResource(studentId, subjectId, schoolResourceId)
      if (!schoolResource) {
        return json(400, { error: 'Seçilen okul kaynağı bu öğrencinin okulu/sınıfı için tanımlı değil.' })
      }
    } else {
      assignedResource = await getAssignedResourceBook(studentId, subjectId, resourceBookId, {
        studentTeacherId,
      })
      if (!assignedResource) {
        return json(400, { error: 'Seçilen kaynak sizin takip ettiğiniz kaynaklardan değil.' })
      }
    }

    if (isSchoolHomework || assignedResource?.resourceType !== 'okuma_kitabi') {
      const isDuplicate = await checkDuplicateHomework({
        studentId,
        subjectId,
        resourceBookId,
        schoolResourceId,
        description,
        dueDate: taskDate || dueDate,
      })
      if (isDuplicate) {
        return json(409, {
          error: isSchoolHomework
            ? 'Bu okul kaynağı için o güne zaten bir ödev eklenmiş.'
            : 'Bu kaynak ve test için zaten bir ödev eklenmiş.',
        })
      }
    }

    const homeworkId = await createHomeworkTask(studentId, {
      subjectId,
      resourceBookId,
      schoolResourceId,
      resourceType: assignedResource?.resourceType || null,
      title,
      assignedDate,
      dueDate,
      totalQuestionCount,
      totalPageCount,
      priority,
      testIds,
      taskDate,
      taskTime,
      taskDurationMinutes,
      createdBy: 'ogretmen',
    })

    return json(201, { homework: await fetchHomeworkById(homeworkId) })
  } catch (error) {
    if (error.number === 547) {
      return json(400, { error: 'Seçilen ders veya kaynak bulunamadı.' })
    }
    return handleError(error, 'createTeacherHomeworkHandler', 'Ödev oluşturulamadı.')
  }
}

async function assignTeacherHomeworkTaskHandler(request) {
  try {
    const homeworkId = request.params.homeworkId
    const payload = await request.json().catch(() => null)
    const { error, studentId, subjectId, studentTeacherId } = await requireTeacherStudentContext(request, {
      studentTeacherId: payload?.studentTeacherId,
    })
    if (error) return error

    const date = payload?.date
    const startTime = payload?.startTime
    const durationMinutes = Number(payload?.durationMinutes)

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json(400, { error: 'Geçerli bir tarih seçilmeli.' })
    }
    if (startTime && !isValidTime(startTime)) {
      return json(400, { error: 'Geçerli bir başlangıç saati seçilmeli.' })
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
      return json(400, { error: 'Süre 5 ile 480 dakika arasında olmalı.' })
    }

    const inScope = await teacherHomeworkInScope(homeworkId, { studentId, subjectId, studentTeacherId })
    if (!inScope) {
      return json(404, { error: 'Ödev bulunamadı.' })
    }

    const endTime = startTime ? computeEndTime(startTime, durationMinutes) : null
    const updateDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: homeworkId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      date: { type: sql.Date, value: date },
      startTime: { type: sql.Char(5), value: startTime || null },
      endTime: { type: sql.Char(5), value: endTime || null },
      durationMinutes: { type: sql.Int, value: durationMinutes },
    })
    await updateDb.query(`
      UPDATE dbo.Tasks
      SET date = @date, start_time = @startTime, end_time = @endTime, duration_minutes = @durationMinutes,
          is_unscheduled = 0
      WHERE id = @id AND student_id = @studentId
        AND task_type IN (${HOMEWORK_TASK_TYPES_SQL}) AND is_draft = 0;
    `)

    return json(200, { homework: await fetchHomeworkById(homeworkId) })
  } catch (error) {
    return handleError(error, 'assignTeacherHomeworkTaskHandler', 'Görev oluşturulamadı.')
  }
}

// Bir ödev-görevinin (dbo.Tasks) bu öğretmenin (öğrenci, ders, takip edilen kaynak)
// kapsamında olup olmadığını doğrular.
async function teacherHomeworkInScope(homeworkId, { studentId, subjectId, studentTeacherId }) {
  const db = await withRequest({
    id: { type: sql.UniqueIdentifier, value: homeworkId },
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    subjectId: { type: sql.UniqueIdentifier, value: subjectId },
    studentTeacherId: { type: sql.UniqueIdentifier, value: studentTeacherId },
  })
  const result = await db.query(`
    SELECT TOP 1 t.id
    FROM dbo.Tasks t
    WHERE t.id = @id AND t.student_id = @studentId AND t.subject_id = @subjectId
      AND t.task_type IN (${HOMEWORK_TASK_TYPES_SQL}) AND t.is_draft = 0
      AND (t.resource_book_id IS NULL OR EXISTS (
        SELECT 1 FROM dbo.StudentTeacherResourceBooks strb
        WHERE strb.teacher_id = @studentTeacherId AND strb.resource_book_id = t.resource_book_id
      ));
  `)
  return result.recordset.length > 0
}

async function updateTeacherHomeworkHandler(request) {
  try {
    const homeworkId = request.params.homeworkId
    const payload = await request.json().catch(() => null)
    const { error, studentId, subjectId, studentTeacherId } = await requireTeacherStudentContext(request, {
      studentTeacherId: payload?.studentTeacherId,
    })
    if (error) return error

    const inScope = await teacherHomeworkInScope(homeworkId, { studentId, subjectId, studentTeacherId })
    if (!inScope) {
      return json(404, { error: 'Ödev bulunamadı.' })
    }

    const updates = []
    const bindings = {
      id: { type: sql.UniqueIdentifier, value: homeworkId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    }

    if (payload?.title !== undefined) {
      const title = payload.title.trim()
      if (!title || title.length < 2) {
        return json(400, { error: 'Ödev notu en az 2 karakter olmalı.' })
      }
      // Gerçek ödev başlığı Tasks.description'da (Tasks.title genel kalıp).
      updates.push('description = @description')
      bindings.description = { type: sql.NVarChar(1000), value: title }
    }
    if (payload?.totalQuestionCount !== undefined) {
      updates.push('target_question_count = @totalQuestionCount')
      bindings.totalQuestionCount = { type: sql.Int, value: Number(payload.totalQuestionCount) || 0 }
    }
    if (payload?.totalPageCount !== undefined) {
      updates.push('target_page_count = @totalPageCount')
      bindings.totalPageCount = { type: sql.Int, value: Number(payload.totalPageCount) || 0 }
    }
    if (payload?.schoolResourceId !== undefined) {
      const schoolResource = await getAssignedSchoolResource(studentId, subjectId, payload.schoolResourceId)
      if (!schoolResource) {
        return json(400, { error: 'Seçilen okul kaynağı bu öğrencinin okulu/sınıfı için tanımlı değil.' })
      }
      updates.push('school_resource_id = @schoolResourceId', 'resource_book_id = NULL', "task_type = 'okul-odevi'")
      bindings.schoolResourceId = { type: sql.UniqueIdentifier, value: payload.schoolResourceId }
    } else if (payload?.resourceBookId !== undefined) {
      const assignedResource = await getAssignedResourceBook(studentId, subjectId, payload.resourceBookId, {
        studentTeacherId,
      })
      if (!assignedResource) {
        return json(400, { error: 'Seçilen kaynak sizin takip ettiğiniz kaynaklardan değil.' })
      }
      updates.push('resource_book_id = @resourceBookId', 'school_resource_id = NULL', "task_type = 'soru-bankasi-odevi'")
      bindings.resourceBookId = { type: sql.UniqueIdentifier, value: payload.resourceBookId }
    }

    if (updates.length === 0) {
      return json(400, { error: 'Güncellenecek alan bulunamadı.' })
    }

    const requestDb = await withRequest(bindings)
    await requestDb.query(`
      UPDATE dbo.Tasks
      SET ${updates.join(', ')}
      WHERE id = @id AND student_id = @studentId
        AND task_type IN (${HOMEWORK_TASK_TYPES_SQL}) AND is_draft = 0;
    `)

    return json(200, { homework: await fetchHomeworkById(homeworkId) })
  } catch (error) {
    return handleError(error, 'updateTeacherHomeworkHandler', 'Ödev güncellenemedi.')
  }
}

async function deleteTeacherHomeworkHandler(request) {
  try {
    const homeworkId = request.params.homeworkId
    const { error, studentId, subjectId, studentTeacherId } = await requireTeacherStudentContext(request)
    if (error) return error

    const inScope = await teacherHomeworkInScope(homeworkId, { studentId, subjectId, studentTeacherId })
    if (!inScope) {
      return json(404, { error: 'Ödev bulunamadı.' })
    }

    const deleted = await deleteHomeworkTask(homeworkId, studentId)
    if (!deleted) {
      return json(404, { error: 'Ödev bulunamadı.' })
    }

    return json(200, { success: true })
  } catch (error) {
    return handleError(error, 'deleteTeacherHomeworkHandler', 'Ödev silinemedi.')
  }
}

async function listTeacherStudentTasksHandler(request) {
  try {
    const { error, studentId, subjectId, studentTeacherId } = await requireTeacherStudentContext(request)
    if (error) return error

    const date = request.query.get('date')
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json(400, { error: 'Geçerli bir tarih belirtilmeli.' })
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      subjectId: { type: sql.UniqueIdentifier, value: subjectId },
      studentTeacherId: { type: sql.UniqueIdentifier, value: studentTeacherId },
      date: { type: sql.Date, value: date },
    })
    const result = await requestDb.query(`
      ${SELECT_TASK}
      WHERE t.student_id = @studentId AND t.date = @date AND t.is_draft = 0 AND t.is_unscheduled = 0
        AND (
          ${TEACHER_TASK_IN_SCOPE}
          -- Branştan bağımsız plan öğeleri: öğrencinin spor ve (başka öğretmenlerden gelen)
          -- özel ders görevleri öğretmenin takviminde bağlam olarak görünür.
          OR t.task_type IN ('spor', 'ozel-ders')
        )
      ORDER BY t.start_time ASC;
    `)

    const normalizedStudentTeacherId = String(studentTeacherId).toLowerCase()
    const tasks = result.recordset.map(sanitizeTask).map((task) => {
      // Başka öğretmenin özel dersi ise öğretmen adını gizle — sadece ders adıyla göster.
      if (
        task.taskType === 'ozel-ders' &&
        String(task.studentTeacherId || '').toLowerCase() !== normalizedStudentTeacherId
      ) {
        return { ...task, teacherFullName: undefined, studentTeacherId: undefined }
      }
      return task
    })

    return json(200, { tasks })
  } catch (error) {
    return handleError(error, 'listTeacherStudentTasksHandler', 'Görevler yüklenemedi.')
  }
}

// Öğrencinin okul ders saatleri + tatil takvimi — öğretmenin haftalık takviminde "Okulda"
// kartlarını göstermek için (veli panelindeki ile aynı ortak çözümleyici).
async function getTeacherStudentSchoolScheduleHandler(request) {
  try {
    const { error, studentId } = await requireTeacherStudentContext(request)
    if (error) return error

    return json(200, await resolveStudentSchoolSchedule(studentId))
  } catch (error) {
    return handleError(error, 'getTeacherStudentSchoolScheduleHandler', 'Ders programı yüklenemedi.')
  }
}

// Öğretmenin, kendi dersine ait ve tamamlanmış bir soru bankası görevinin dijital optik
// cevap kağıdını salt okunur görebilmesini sağlar. Görevin gerçekten bu öğretmenin
// (öğrenci, ders) kapsamına ait olduğu, listTeacherStudentTasksHandler'daki aynı
// homework_id → subject_id zincirinden doğrulanır.
async function getTeacherTaskAnswerSheetHandler(request) {
  try {
    const { error, studentId, subjectId, studentTeacherId } = await requireTeacherStudentContext(request)
    if (error) return error

    const taskId = request.params.taskId
    const scopeDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: taskId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      subjectId: { type: sql.UniqueIdentifier, value: subjectId },
      studentTeacherId: { type: sql.UniqueIdentifier, value: studentTeacherId },
    })
    const scopeResult = await scopeDb.query(`
      SELECT TOP 1 t.id
      FROM dbo.Tasks t
      WHERE t.id = @id AND t.student_id = @studentId AND ${TEACHER_TASK_IN_SCOPE};
    `)
    if (!scopeResult.recordset[0]) {
      return json(404, { error: 'Görev bulunamadı.' })
    }

    const data = await fetchTaskAnswerSheetData(taskId, studentId)
    if (!data) {
      return json(404, { error: 'Görev bulunamadı.' })
    }

    return json(200, data)
  } catch (error) {
    return handleError(error, 'getTeacherTaskAnswerSheetHandler', 'Cevap kağıdı yüklenemedi.')
  }
}

// Öğretmenin, takviminde gördüğü (kendi kapsamındaki) bir görevi yeniden planlaması —
// ödev kaydına bağlı olsun ya da olmasın. Öğrenci/veli "Bugün planı"ndan eklenmiş, ödev
// kaydı olmayan soru bankası görevleri için homework tabanlı uçlar çalışmadığından bu
// görev tabanlı uç gerekli. Kapsam kontrolü listTeacherStudentTasksHandler ile aynı.
async function updateTeacherStudentTaskHandler(request) {
  try {
    const taskId = request.params.taskId
    const payload = await request.json().catch(() => null)
    const { error, studentId, subjectId, studentTeacherId } = await requireTeacherStudentContext(request)
    if (error) return error

    const date = payload?.date
    const startTime = payload?.startTime || null
    const durationMinutes = Number(payload?.durationMinutes)

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json(400, { error: 'Geçerli bir tarih seçilmeli.' })
    }
    if (startTime && !isValidTime(startTime)) {
      return json(400, { error: 'Geçerli bir başlangıç saati seçilmeli.' })
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 5 || durationMinutes > 480) {
      return json(400, { error: 'Süre 5 ile 480 dakika arasında olmalı.' })
    }

    const scopeDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: taskId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      subjectId: { type: sql.UniqueIdentifier, value: subjectId },
      studentTeacherId: { type: sql.UniqueIdentifier, value: studentTeacherId },
    })
    const scopeResult = await scopeDb.query(`
      SELECT TOP 1 t.id, t.homework_id
      FROM dbo.Tasks t
      WHERE t.id = @id AND t.student_id = @studentId AND ${TEACHER_TASK_IN_SCOPE};
    `)
    const scoped = scopeResult.recordset[0]
    if (!scoped) {
      return json(404, { error: 'Görev bulunamadı.' })
    }

    const endTime = startTime ? computeEndTime(startTime, durationMinutes) : null
    const updateDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: taskId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      date: { type: sql.Date, value: date },
      startTime: { type: sql.Char(5), value: startTime },
      endTime: { type: sql.Char(5), value: endTime },
      durationMinutes: { type: sql.Int, value: durationMinutes },
    })
    await updateDb.query(`
      UPDATE dbo.Tasks
      SET date = @date, start_time = @startTime, end_time = @endTime, duration_minutes = @durationMinutes
      WHERE id = @id AND student_id = @studentId;
    `)

    // Bağlı ödev kaydı varsa Ödevlerim'de aynı günün altında görünsün diye due_date'i eşitle.
    if (scoped.homework_id) {
      const hwDb = await withRequest({
        id: { type: sql.UniqueIdentifier, value: scoped.homework_id },
        date: { type: sql.Date, value: date },
      })
      await hwDb.query(`UPDATE dbo.Homeworks SET due_date = @date WHERE id = @id;`)
    }

    const fetchDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: taskId } })
    const fetchResult = await fetchDb.query(`${SELECT_TASK} WHERE t.id = @id;`)
    return json(200, { task: sanitizeTask(fetchResult.recordset[0]) })
  } catch (error) {
    return handleError(error, 'updateTeacherStudentTaskHandler', 'Görev güncellenemedi.')
  }
}

// Öğretmenin, takviminde gördüğü (kendi kapsamındaki) bir görevi silmesi. Görev bir ödev
// kaydına bağlıysa (homework_id) arkada kalan dbo.Homeworks satırı da temizlenir — aksi
// halde aynı kaynak/test için yeni ödev eklemek "zaten eklenmiş" hatasıyla engellenirdi.
async function deleteTeacherStudentTaskHandler(request) {
  try {
    const taskId = request.params.taskId
    const { error, studentId, subjectId, studentTeacherId } = await requireTeacherStudentContext(request)
    if (error) return error

    const scopeDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: taskId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      subjectId: { type: sql.UniqueIdentifier, value: subjectId },
      studentTeacherId: { type: sql.UniqueIdentifier, value: studentTeacherId },
    })
    const scopeResult = await scopeDb.query(`
      SELECT TOP 1 t.id
      FROM dbo.Tasks t
      WHERE t.id = @id AND t.student_id = @studentId AND ${TEACHER_TASK_IN_SCOPE};
    `)
    if (!scopeResult.recordset[0]) {
      return json(404, { error: 'Görev bulunamadı.' })
    }

    const deleteDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: taskId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const deleteResult = await deleteDb.query(`
      DELETE FROM dbo.Tasks
      OUTPUT deleted.homework_id
      WHERE id = @id AND student_id = @studentId;
    `)
    if (!deleteResult.recordset.length) {
      return json(404, { error: 'Görev bulunamadı.' })
    }

    const homeworkId = deleteResult.recordset[0].homework_id
    if (homeworkId) {
      const homeworkDb = await withRequest({
        id: { type: sql.UniqueIdentifier, value: homeworkId },
        studentId: { type: sql.UniqueIdentifier, value: studentId },
      })
      await homeworkDb.query(`DELETE FROM dbo.Homeworks WHERE id = @id AND student_id = @studentId;`)
    }

    return json(200, { success: true })
  } catch (error) {
    return handleError(error, 'deleteTeacherStudentTaskHandler', 'Görev silinemedi.')
  }
}

async function getTeacherStudentProgressOverviewHandler(request) {
  try {
    const { error, studentId, subjectId, studentTeacherId } = await requireTeacherStudentContext(request)
    if (error) return error

    const subjectDb = await withRequest({ subjectId: { type: sql.UniqueIdentifier, value: subjectId } })
    const subjectResult = await subjectDb.query(`SELECT TOP 1 name FROM dbo.Subjects WHERE id = @subjectId;`)
    const subjectName = subjectResult.recordset[0]?.name || ''

    const bindings = {
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      subjectId: { type: sql.UniqueIdentifier, value: subjectId },
      studentTeacherId: { type: sql.UniqueIdentifier, value: studentTeacherId },
    }
    const wrongQuestionBindings = {
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      subject: { type: sql.NVarChar(100), value: subjectName },
    }

    const [
      resourceBooksResult,
      testsResult,
      tasksResult,
      sessionsResult,
      homeworksResult,
      wrongQuestionsResult,
      manualTestCompletionsResult,
    ] = await Promise.all([
        withRequest(bindings).then((requestDb) =>
          requestDb.query(`
            SELECT rb.id, rb.publisher_id, p.name AS publisher_name, rb.subject_id, s.name AS subject_name,
                   rb.name, rb.resource_type, rb.has_answer_key
            FROM dbo.StudentResourceBooks srb
            INNER JOIN dbo.ResourceBooks rb ON rb.id = srb.resource_book_id
            LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
            LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
            INNER JOIN dbo.StudentTeacherResourceBooks strb
              ON strb.teacher_id = @studentTeacherId AND strb.resource_book_id = rb.id
            WHERE srb.student_id = @studentId AND rb.is_active = 1 AND rb.subject_id = @subjectId
            ORDER BY rb.name ASC;
          `),
        ),
        withRequest(bindings).then((requestDb) =>
          requestDb.query(`
            SELECT tt.id, rbt.resource_book_id, COALESCE(tt.topic_name, rbt.name) AS topic_name,
                   tt.name, tt.question_count
            FROM dbo.StudentResourceBooks srb
            INNER JOIN dbo.ResourceBooks rb ON rb.id = srb.resource_book_id
            INNER JOIN dbo.ResourceBookTopics rbt ON rbt.resource_book_id = srb.resource_book_id
            INNER JOIN dbo.ResourceBookTopicTests tt ON tt.topic_id = rbt.id
            INNER JOIN dbo.StudentTeacherResourceBooks strb
              ON strb.teacher_id = @studentTeacherId AND strb.resource_book_id = rb.id
            WHERE srb.student_id = @studentId AND rb.subject_id = @subjectId
            ORDER BY rbt.created_at ASC, tt.created_at ASC;
          `),
        ),
        withRequest(bindings).then((requestDb) =>
          requestDb.query(`
            SELECT t.id, t.date, t.title, t.task_type, t.homework_id, t.subject, t.topic,
                   t.duration_minutes, t.target_question_count, t.completed_question_count,
                   t.timer_started_at, t.timer_stopped_at, t.timer_elapsed_seconds,
                   t.target_page_count, t.completed_page_count, t.status, t.completed_at,
                   t.correct_count, t.wrong_count, t.blank_count, t.resource_book_id,
                   t.selected_test_ids_json, t.test_results_json, rb.name AS resource_book_name,
                   rb.resource_type, p.name AS publisher_name, rb.subject_id AS resource_subject_id,
                   s.name AS resource_subject_name, t.created_at, t.updated_at
            FROM dbo.Tasks t
            LEFT JOIN dbo.ResourceBooks rb ON rb.id = t.resource_book_id
            LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
            LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
            WHERE t.student_id = @studentId AND t.is_draft = 0 AND t.is_unscheduled = 0
              AND t.subject_id = @subjectId
              AND t.task_type IN ('odev', 'soru-bankasi-odevi', 'okul-odevi', 'etkinlik-odevi')
              AND (t.resource_book_id IS NULL OR EXISTS (
                SELECT 1 FROM dbo.StudentTeacherResourceBooks strb
                WHERE strb.teacher_id = @studentTeacherId AND strb.resource_book_id = t.resource_book_id
              ))
            ORDER BY t.date DESC, t.start_time ASC;
          `),
        ),
        withRequest(bindings).then((requestDb) =>
          requestDb.query(`
            SELECT ss.id, ss.student_id, ss.task_id, ss.started_at, ss.ended_at, ss.duration_minutes,
                   ss.completed_question_count, ss.correct_count, ss.wrong_count, ss.blank_count,
                   ss.difficulty_rating, ss.emotion, ss.note, ss.created_at, t.date AS task_date,
                   t.title AS task_title, t.task_type, t.homework_id, t.duration_minutes AS task_duration_minutes,
                   t.subject, t.topic, t.resource_book_id,
                   t.selected_test_ids_json, t.test_results_json, rb.name AS resource_book_name,
                   rb.resource_type, p.name AS publisher_name, rb.subject_id AS resource_subject_id,
                   s.name AS resource_subject_name
            FROM dbo.StudySessions ss
            LEFT JOIN dbo.Tasks t ON t.id = ss.task_id
            LEFT JOIN dbo.ResourceBooks rb ON rb.id = t.resource_book_id
            LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
            LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
            WHERE ss.student_id = @studentId
              AND t.subject_id = @subjectId
              AND t.task_type IN ('odev', 'soru-bankasi-odevi', 'okul-odevi', 'etkinlik-odevi')
              AND (t.resource_book_id IS NULL OR EXISTS (
                SELECT 1 FROM dbo.StudentTeacherResourceBooks strb
                WHERE strb.teacher_id = @studentTeacherId AND strb.resource_book_id = t.resource_book_id
              ))
            ORDER BY ss.started_at DESC;
          `),
        ),
        withRequest(bindings).then((requestDb) =>
          requestDb.query(`
            SELECT h.id, h.subject_id, s.name AS subject_name, h.resource_book_id,
                   rb.name AS resource_book_name, rb.resource_type, p.name AS publisher_name,
                   COALESCE(NULLIF(h.description, ''), h.title) AS title, h.description,
                   h.assigned_date, h.date AS due_date,
                   h.target_question_count AS total_question_count, h.completed_question_count,
                   h.target_page_count AS total_page_count,
                   h.status, h.created_at, h.updated_at
            FROM dbo.Tasks h
            LEFT JOIN dbo.Subjects s ON s.id = h.subject_id
            LEFT JOIN dbo.ResourceBooks rb ON rb.id = h.resource_book_id
            LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
            WHERE h.student_id = @studentId AND h.subject_id = @subjectId AND h.is_draft = 0
              AND h.task_type IN ('odev', 'soru-bankasi-odevi', 'okul-odevi', 'etkinlik-odevi')
              AND (h.resource_book_id IS NULL OR EXISTS (
                SELECT 1 FROM dbo.StudentTeacherResourceBooks strb
                WHERE strb.teacher_id = @studentTeacherId AND strb.resource_book_id = h.resource_book_id
              ))
            ORDER BY h.date DESC;
          `),
        ),
        withRequest(wrongQuestionBindings).then((requestDb) =>
          requestDb.query(`
            SELECT id, student_id, task_id, subject, topic, question_number, error_type, student_note, mistake_reason,
                   review_status, resolved_at, created_at
            FROM dbo.WrongQuestions
            WHERE student_id = @studentId AND subject = @subject
            ORDER BY created_at DESC;
          `),
        ),
        withRequest(bindings).then((requestDb) =>
          requestDb.query(`
            SELECT smtc.test_id, smtc.correct_count, smtc.wrong_count, smtc.blank_count, smtc.marked_at,
                   tt.name AS test_name, COALESCE(tt.topic_name, rbt.name) AS topic_name, tt.question_count,
                   rb.id AS resource_book_id, rb.name AS resource_book_name, rb.resource_type,
                   p.name AS publisher_name, rb.subject_id, s.name AS subject_name
            FROM dbo.StudentManualTestCompletions smtc
            INNER JOIN dbo.ResourceBookTopicTests tt ON tt.id = smtc.test_id
            INNER JOIN dbo.ResourceBookTopics rbt ON rbt.id = tt.topic_id
            INNER JOIN dbo.ResourceBooks rb ON rb.id = rbt.resource_book_id
            LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
            LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
            INNER JOIN dbo.StudentTeacherResourceBooks strb
              ON strb.teacher_id = @studentTeacherId AND strb.resource_book_id = rb.id
            WHERE smtc.student_id = @studentId AND rb.subject_id = @subjectId
              AND (smtc.correct_count IS NOT NULL OR smtc.wrong_count IS NOT NULL OR smtc.blank_count IS NOT NULL);
          `),
        ),
      ])

    const resourceBookImages = await fetchResourceBookImagesByIds([
      ...tasksResult.recordset.map((r) => r.resource_book_id),
      ...sessionsResult.recordset.map((r) => r.resource_book_id),
      ...homeworksResult.recordset.map((r) => r.resource_book_id),
      ...manualTestCompletionsResult.recordset.map((r) => r.resource_book_id),
    ])

    return json(200, {
      resourceBooks: resourceBooksResult.recordset.map(sanitizeProgressResourceBook),
      tests: testsResult.recordset.map(sanitizeProgressTest),
      tasks: tasksResult.recordset.map(sanitizeProgressTask),
      sessions: sessionsResult.recordset.map(sanitizeProgressSession),
      homeworks: homeworksResult.recordset.map(sanitizeProgressHomework),
      wrongQuestions: wrongQuestionsResult.recordset.map(sanitizeWrongQuestion),
      manualTestCompletions: manualTestCompletionsResult.recordset.map(sanitizeManualTestCompletion),
      resourceBookImages: Object.fromEntries(resourceBookImages),
    })
  } catch (error) {
    return handleError(error, 'getTeacherStudentProgressOverviewHandler', 'Gelişim verileri yüklenemedi.')
  }
}

async function resolveTeacherSubjectName(subjectId) {
  const subjectDb = await withRequest({ subjectId: { type: sql.UniqueIdentifier, value: subjectId } })
  const subjectResult = await subjectDb.query(`SELECT TOP 1 name FROM dbo.Subjects WHERE id = @subjectId;`)
  return subjectResult.recordset[0]?.name || ''
}

// Öğretmenin öğrenci Hata Defteri görünümü: getTeacherStudentProgressOverviewHandler'daki
// wrongQuestions sorgusunun foto/etiket dahil tam sürümü (o sorgu sadece özet metrik için
// photo_url'i hiç seçmiyordu). Öğretmen sadece kendi dersine (subject) ait kayıtları görür.
async function listTeacherStudentWrongQuestionsHandler(request) {
  try {
    const { error, studentId, subjectId } = await requireTeacherStudentContext(request)
    if (error) return error

    const subjectName = await resolveTeacherSubjectName(subjectId)

    // Bkz. progress.js listWrongQuestionsHandler'daki aynı gerekçe: BookTopics ekranı sadece o
    // kitaptaki testler için fotoğraf durumunu sorduğundan, resourceBookId verildiğinde sorguyu
    // o kitapla sınırlıyoruz — büyük hata defterlerinde bu ekranın yavaş açılmasını önler.
    const resourceBookId = request.query.get('resourceBookId')

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      subject: { type: sql.NVarChar(100), value: subjectName },
      ...(resourceBookId ? { resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId } } : {}),
    })
    // Bkz. progress.js listWrongQuestionsHandler'daki aynı gerekçe: kaynağın içerik ağacı
    // sonradan yeniden düzenlenmişse (testler farklı bir üniteye taşınmışsa) test_id üzerinden
    // katalogdaki güncel konu/kitap/yayın evi adına öncelik veriyoruz, tablodaki bayat metin
    // sadece test_id'siz eski manuel kayıtlar için geri düşüş.
    // rb.image_url'i (kapak fotoğrafı, ~140KB base64) burada her satırda tekrar seçmek yerine
    // fetchWrongQuestionBookImagesByName ile bir kez çekip book_name üzerinden eşliyoruz —
    // bkz. progress.js'deki aynı fonksiyonun yorumu.
    const [result, bookImageByName] = await Promise.all([
      requestDb.query(`
        SELECT wq.id, wq.student_id, wq.task_id, wq.test_id, wq.subject, wq.test_name,
               wq.question_number, wq.error_type, wq.student_note, wq.mistake_reason,
               wq.review_status, wq.resolved_at,
               CAST(1 AS bit) AS has_photo, wq.created_at,
               COALESCE(tp.name, wq.topic) AS topic,
               COALESCE(rb.name, wq.book_name) AS book_name,
               COALESCE(pub.name, wq.publisher_name) AS publisher_name,
               t.topic_name, t.page_start, t.page_end
        FROM dbo.WrongQuestions wq
        LEFT JOIN dbo.ResourceBookTopicTests t ON t.id = wq.test_id
        LEFT JOIN dbo.ResourceBookTopics tp ON tp.id = t.topic_id
        LEFT JOIN dbo.ResourceBooks rb ON rb.id = tp.resource_book_id
        LEFT JOIN dbo.Publishers pub ON pub.id = rb.publisher_id
        WHERE wq.student_id = @studentId AND wq.subject = @subject AND wq.test_id IS NOT NULL
        ${resourceBookId ? 'AND tp.resource_book_id = @resourceBookId' : ''}
        ORDER BY wq.created_at DESC;
      `),
      fetchWrongQuestionBookImagesByName(studentId, { resourceBookId }),
    ])

    return json(200, {
      wrongQuestions: result.recordset.map(sanitizeWrongQuestion),
      bookImages: Object.fromEntries(bookImageByName),
    })
  } catch (error) {
    return handleError(error, 'listTeacherStudentWrongQuestionsHandler', 'Yanlış sorular yüklenemedi.')
  }
}

// Galerinin sadece o an gösterilen fotoğrafı tembel çekmesi için (bkz. progress.js'deki
// getWrongQuestionPhotoHandler ile aynı gerekçe).
async function getTeacherStudentWrongQuestionPhotoHandler(request) {
  try {
    const { error, studentId, subjectId } = await requireTeacherStudentContext(request)
    if (error) return error

    const subjectName = await resolveTeacherSubjectName(subjectId)
    const wrongQuestionId = request.params.wrongQuestionId

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: wrongQuestionId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      subject: { type: sql.NVarChar(100), value: subjectName },
    })
    const result = await requestDb.query(`
      SELECT photo_url FROM dbo.WrongQuestions WHERE id = @id AND student_id = @studentId AND subject = @subject;
    `)

    const photoUrl = result.recordset[0]?.photo_url
    if (!photoUrl) {
      return json(404, { error: 'Fotoğraf bulunamadı.' })
    }

    return json(200, { photoUrl })
  } catch (error) {
    return handleError(error, 'getTeacherStudentWrongQuestionPhotoHandler', 'Fotoğraf yüklenemedi.')
  }
}

async function getTeacherStudentWrongQuestionTopicStatsHandler(request) {
  try {
    const { error, studentId, subjectId, studentTeacherId } = await requireTeacherStudentContext(request)
    if (error) return error

    const subjectName = await resolveTeacherSubjectName(subjectId)

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      subject: { type: sql.NVarChar(100), value: subjectName },
    })
    // Bkz. progress.js getWrongQuestionTopicStatsHandler'daki aynı gerekçe: anahtar kümesi
    // wq.topic yerine COALESCE(tp.name, wq.topic) canlı adına göre çıkarılmalı.
    const result = await requestDb.query(`
      SELECT DISTINCT wq.subject, COALESCE(tp.name, wq.topic) AS topic
      FROM dbo.WrongQuestions wq
      LEFT JOIN dbo.ResourceBookTopicTests t ON t.id = wq.test_id
      LEFT JOIN dbo.ResourceBookTopics tp ON tp.id = t.topic_id
      WHERE wq.student_id = @studentId AND wq.subject = @subject AND wq.test_id IS NOT NULL;
    `)

    const { topicStats, sourceTopicStats } = await computeWrongQuestionTopicStats(studentId, result.recordset, {
      teacherId: studentTeacherId,
    })
    return json(200, { topicStats, sourceTopicStats })
  } catch (error) {
    return handleError(error, 'getTeacherStudentWrongQuestionTopicStatsHandler', 'İçerik istatistikleri yüklenemedi.')
  }
}

async function updateTeacherStudentWrongQuestionHandler(request) {
  try {
    const { error, studentId, subjectId } = await requireTeacherStudentContext(request)
    if (error) return error

    const wrongQuestionId = request.params.wrongQuestionId
    const payload = await request.json().catch(() => null)

    const subjectName = await resolveTeacherSubjectName(subjectId)

    const setClauses = []
    const bindings = {
      id: { type: sql.UniqueIdentifier, value: wrongQuestionId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      subject: { type: sql.NVarChar(100), value: subjectName },
    }

    if (payload?.mistakeReason !== undefined) {
      if (!MISTAKE_REASONS.includes(payload.mistakeReason)) {
        return json(400, { error: 'Geçersiz hata nedeni.' })
      }
      setClauses.push('mistake_reason = @mistakeReason')
      bindings.mistakeReason = { type: sql.NVarChar(30), value: payload.mistakeReason }
    }
    if (payload?.studentNote !== undefined) {
      setClauses.push('student_note = @studentNote')
      bindings.studentNote = { type: sql.NVarChar(1000), value: payload.studentNote || null }
    }
    if (payload?.topic !== undefined) {
      setClauses.push('topic = @topic')
      bindings.topic = { type: sql.NVarChar(200), value: payload.topic || null }
    }

    if (setClauses.length === 0) {
      return json(400, { error: 'Güncellenecek alan bulunamadı.' })
    }

    const requestDb = await withRequest(bindings)
    const result = await requestDb.query(`
      UPDATE dbo.WrongQuestions SET ${setClauses.join(', ')}
      WHERE id = @id AND student_id = @studentId AND subject = @subject;
    `)

    if (!result.rowsAffected[0]) {
      return json(404, { error: 'Kayıt bulunamadı.' })
    }

    const fetchDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: wrongQuestionId } })
    const fetchResult = await fetchDb.query(`
      SELECT id, student_id, task_id, subject, topic, question_number, error_type, student_note, mistake_reason,
             review_status, resolved_at, created_at
      FROM dbo.WrongQuestions WHERE id = @id;
    `)

    return json(200, { wrongQuestion: sanitizeWrongQuestion(fetchResult.recordset[0]) })
  } catch (error) {
    return handleError(error, 'updateTeacherStudentWrongQuestionHandler', 'Kayıt güncellenemedi.')
  }
}

module.exports = {
  listTeacherStudentsHandler,
  getTeacherStudentHandler,
  getTeacherStudentProfileHandler,
  updateTeacherStudentProfileHandler,
  listTeacherStudentPrivateResourceBooksHandler,
  assignTeacherLibraryResourceBookHandler,
  unassignTeacherLibraryResourceBookHandler,
  updateTeacherStudentStatusHandler,
  updateTeacherStudentGradeHandler,
  deleteTeacherStudentHandler,
  listTeacherParentsHandler,
  getTeacherLessonPlanHandler,
  addTeacherRecurringLessonSlotHandler,
  updateTeacherRecurringLessonSlotHandler,
  deleteTeacherRecurringLessonSlotHandler,
  moveTeacherRecurringLessonOccurrenceHandler,
  addTeacherOneTimeLessonHandler,
  updateTeacherOneTimeLessonHandler,
  deleteTeacherOneTimeLessonHandler,
  listTeacherResourceBooksHandler,
  listTeacherResourceBookTopicsHandler,
  markTeacherResourceBookTopicTestCompletionHandler,
  unmarkTeacherResourceBookTopicTestCompletionHandler,
  submitTeacherManualOpticalAnswersHandler,
  saveTeacherManualWrongQuestionPhotoHandler,
  listTeacherStudentHomeworksHandler,
  createTeacherHomeworkHandler,
  assignTeacherHomeworkTaskHandler,
  updateTeacherHomeworkHandler,
  deleteTeacherHomeworkHandler,
  listTeacherStudentTasksHandler,
  updateTeacherStudentTaskHandler,
  deleteTeacherStudentTaskHandler,
  getTeacherStudentSchoolScheduleHandler,
  getTeacherTaskAnswerSheetHandler,
  getTeacherStudentProgressOverviewHandler,
  listTeacherStudentWrongQuestionsHandler,
  getTeacherStudentWrongQuestionPhotoHandler,
  getTeacherStudentWrongQuestionTopicStatsHandler,
  updateTeacherStudentWrongQuestionHandler,
  grantParentAccessHandler,
  getTeacherEntitlementHandler,
  updateTeacherProfileHandler,
  createTeacherStudentHandler,
}
