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
const { fetchTeacherResourceBooks, verifySubjectExists } = require('./students')
const { extractLibraryTocFromImages } = require('./libraryTocExtraction')
const { getTeacherQuota, hasActiveParentEntitlement } = require('./entitlements')
const {
  SELECT_HOMEWORK,
  sanitizeHomework,
  getAssignedResourceBook,
  createTaskForHomework,
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
const {
  fetchResourceBookTopicsWithTests,
  LIBRARY_GRADES,
  RESOURCE_SOURCES,
  fetchLibraryResourceBooks,
  createLibraryResourceBookSubmission,
  deleteLibraryResourceBookSubmission,
  addLibraryResourceBookTopicsSubmission,
  fetchResourceBookById,
  fetchLibraryResourceBookDetail,
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
  MISTAKE_REASONS,
} = require('./progress')
const { gradeTestAnswers } = require('./testGrading')
const { sanitizeMistakePhoto, WRONG_QUESTION_OUTPUT_COLUMNS } = require('./mistakePhoto')

const TEACHER_TYPE_LABELS = {
  ozel_ogretmen: 'Özel Öğretmen',
  okul_ogretmeni: 'Okul Öğretmeni',
}

const STUDENT_STATUS_FILTERS = new Set(['active', 'inactive', 'all'])

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
      AND t.task_type = 'ders-calisma' AND t.created_by = 'ogretmen'
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
             st.subject_id, s.name AS subject_name, st.teacher_type, st.schedule_json, st.access_granted_at,
             st.is_active,
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
        resourceCount: Number(record.resource_count) || 0,
        accessGrantedAt: record.access_granted_at || null,
      },
    })
  } catch (error) {
    return handleError(error, 'getTeacherStudentHandler', 'Öğrenci yüklenemedi.')
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

const LIBRARY_GRADE_ORDER = ['5', '6', '7', '8', '9', '10', '11', '12']

function sortLibraryGrades(grades) {
  return LIBRARY_GRADE_ORDER.filter((grade) => grades.has(grade))
}

// Kütüphanede gösterilecek sınıflar iki kaynaktan gelir: öğretmenin öğrencilerinin sınıfları
// (otomatik) ve öğretmenin elle eklediği sınıflar (TeacherLibraryGrades). manualGrades, hangi
// sınıfların elle eklendiğini (dolayısıyla kaldırılabilir olduğunu) belirtmek için ayrıca döner.
async function fetchTeacherLibraryGrades(teacherUserId) {
  const requestDb = await withRequest({ teacherUserId: { type: sql.UniqueIdentifier, value: teacherUserId } })
  const result = await requestDb.query(`
    SELECT sp.grade FROM dbo.StudentTeachers st
    INNER JOIN dbo.StudentProfiles sp ON sp.student_id = st.student_id
    WHERE st.teacher_user_id = @teacherUserId AND st.is_active = 1 AND sp.grade IS NOT NULL;

    SELECT grade FROM dbo.TeacherLibraryGrades WHERE teacher_user_id = @teacherUserId;
  `)

  const [studentGradeRows, manualGradeRows] = result.recordsets
  const manualGrades = new Set(manualGradeRows.map((row) => row.grade).filter((grade) => LIBRARY_GRADES.has(grade)))
  const allGrades = new Set([
    ...studentGradeRows.map((row) => row.grade).filter((grade) => LIBRARY_GRADES.has(grade)),
    ...manualGrades,
  ])

  return { grades: sortLibraryGrades(allGrades), manualGrades: sortLibraryGrades(manualGrades) }
}

async function listTeacherLibraryGradesHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) return error

    const data = await fetchTeacherLibraryGrades(teacherUserId)
    return json(200, data)
  } catch (error) {
    return handleError(error, 'listTeacherLibraryGradesHandler', 'Kütüphane sınıfları yüklenemedi.')
  }
}

async function addTeacherLibraryGradeHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) return error

    const payload = await request.json().catch(() => ({}))
    const grade = String(payload?.grade || '').trim()
    if (!LIBRARY_GRADES.has(grade)) {
      return json(400, { error: 'Geçersiz sınıf.' })
    }

    const requestDb = await withRequest({
      teacherUserId: { type: sql.UniqueIdentifier, value: teacherUserId },
      grade: { type: sql.NVarChar(20), value: grade },
    })
    await requestDb.query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.TeacherLibraryGrades WHERE teacher_user_id = @teacherUserId AND grade = @grade)
        INSERT INTO dbo.TeacherLibraryGrades (teacher_user_id, grade) VALUES (@teacherUserId, @grade);
    `)

    const data = await fetchTeacherLibraryGrades(teacherUserId)
    return json(200, data)
  } catch (error) {
    return handleError(error, 'addTeacherLibraryGradeHandler', 'Sınıf eklenemedi.')
  }
}

async function removeTeacherLibraryGradeHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) return error

    const grade = String(request.params.grade || '').trim()
    if (!LIBRARY_GRADES.has(grade)) {
      return json(400, { error: 'Geçersiz sınıf.' })
    }

    const requestDb = await withRequest({
      teacherUserId: { type: sql.UniqueIdentifier, value: teacherUserId },
      grade: { type: sql.NVarChar(20), value: grade },
    })
    await requestDb.query(`
      DELETE FROM dbo.TeacherLibraryGrades WHERE teacher_user_id = @teacherUserId AND grade = @grade;
    `)

    const data = await fetchTeacherLibraryGrades(teacherUserId)
    return json(200, data)
  } catch (error) {
    return handleError(error, 'removeTeacherLibraryGradeHandler', 'Sınıf kaldırılamadı.')
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
      parentId: { type: sql.UniqueIdentifier, value: parentId },
      fundedByTeacherId: { type: sql.UniqueIdentifier, value: consumesQuota ? teacherUserId : null },
      aydinlatmaAcceptedAt: { type: sql.DateTime2, value: parentConsent?.aydinlatma_accepted_at || null },
      kvkkAcceptedAt: { type: sql.DateTime2, value: parentConsent?.kvkk_accepted_at || null },
    })
    const studentResult = await insertStudentDb.query(`
      INSERT INTO dbo.Users (full_name, role, parent_id, funded_by_teacher_id, aydinlatma_accepted_at, kvkk_accepted_at)
      OUTPUT inserted.id
      VALUES (@fullName, @role, @parentId, @fundedByTeacherId, @aydinlatmaAcceptedAt, @kvkkAcceptedAt);
    `)
    const studentId = studentResult.recordset[0].id

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
    SELECT st.id AS student_teacher_id, u.full_name AS student_full_name, s.name AS subject_name, st.schedule_json
    FROM dbo.StudentTeachers st
    INNER JOIN dbo.Users u ON u.id = st.student_id
    LEFT JOIN dbo.Subjects s ON s.id = st.subject_id
    WHERE st.teacher_user_id = @teacherUserId
      AND st.is_active = 1
      AND st.teacher_type = 'ozel_ogretmen'
      AND st.schedule_json IS NOT NULL;
  `)

  return result.recordset.flatMap((record) =>
    parseScheduleJson(record.schedule_json).map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      studentTeacherId: record.student_teacher_id,
      studentFullName: record.student_full_name,
      subjectName: record.subject_name || null,
    })),
  )
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
      AND t.task_type = 'ders-calisma' AND t.created_by = 'ogretmen'
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
        AND task_type = 'ders-calisma' AND created_by = 'ogretmen';
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
        AND task_type = 'ders-calisma' AND created_by = 'ogretmen';
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

async function listLibraryResourceBooksForTeacherHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) return error

    const grade = request.query.get('grade')
    const subjectId = request.query.get('subjectId')
    const source = request.query.get('source')
    if (!LIBRARY_GRADES.has(grade)) {
      return json(400, { error: 'Geçersiz sınıf.' })
    }
    if (!subjectId) {
      return json(400, { error: 'Ders belirtilmeli.' })
    }
    if (source && !RESOURCE_SOURCES.includes(source)) {
      return json(400, { error: 'Geçersiz kaynak türü.' })
    }

    const resourceBooks = await fetchLibraryResourceBooks({ grade, subjectId, actorUserId: teacherUserId, source })
    return json(200, { resourceBooks })
  } catch (error) {
    return handleError(error, 'listLibraryResourceBooksForTeacherHandler', 'Kütüphane kaynakları yüklenemedi.')
  }
}

async function createLibraryResourceBookForTeacherHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) return error

    const payload = await request.json().catch(() => null)
    const result = await createLibraryResourceBookSubmission({ actorUserId: teacherUserId, role: 'ogretmen', payload })
    if (result.error) {
      return json(400, { error: result.error })
    }

    return json(201, { resourceBook: result.resourceBook })
  } catch (error) {
    if (error.number === 547) {
      return json(400, { error: 'Seçilen yayın evi veya ders bulunamadı.' })
    }
    return handleError(error, 'createLibraryResourceBookForTeacherHandler', 'Kaynak gönderilemedi.')
  }
}

async function getLibraryResourceBookDetailForTeacherHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) return error

    const resourceBookId = request.params.resourceBookId
    const detail = await fetchLibraryResourceBookDetail({ resourceBookId, actorUserId: teacherUserId })
    if (!detail) {
      return json(404, { error: 'Kaynak bulunamadı.' })
    }

    return json(200, detail)
  } catch (error) {
    return handleError(error, 'getLibraryResourceBookDetailForTeacherHandler', 'Kaynak detayı yüklenemedi.')
  }
}

async function deleteLibraryResourceBookForTeacherHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) return error

    const resourceBookId = request.params.resourceBookId
    const result = await deleteLibraryResourceBookSubmission({
      actorUserId: teacherUserId,
      role: 'ogretmen',
      resourceBookId,
    })
    if (result.error) {
      return json(404, { error: result.error })
    }

    return json(200, { success: true })
  } catch (error) {
    return handleError(error, 'deleteLibraryResourceBookForTeacherHandler', 'Kaynak silinemedi.')
  }
}

async function addLibraryResourceBookTopicsForTeacherHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) return error

    const resourceBookId = request.params.resourceBookId
    const payload = await request.json().catch(() => null)
    const result = await addLibraryResourceBookTopicsSubmission({
      actorUserId: teacherUserId,
      role: 'ogretmen',
      resourceBookId,
      payload,
    })
    if (result.error) {
      return json(400, { error: result.error })
    }

    return json(200, result.detail)
  } catch (error) {
    return handleError(error, 'addLibraryResourceBookTopicsForTeacherHandler', 'İçerik kaydedilemedi.')
  }
}

async function extractLibraryTocForTeacherHandler(request) {
  try {
    const { error } = await requireTeacherSession(request)
    if (error) return error

    const payload = await request.json().catch(() => null)
    const result = await extractLibraryTocFromImages(payload?.images)
    if (result.error) {
      return json(400, { error: result.error })
    }

    return json(200, { topics: result.topics })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Yapay zeka servisi yapılandırması eksik.' })
    }
    return handleError(error, 'extractLibraryTocForTeacherHandler', 'İçindekiler okunamadı.')
  }
}

async function listAssignableStudentsForLibraryResourceHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) return error

    const resourceBookId = request.params.resourceBookId
    const resourceBook = await fetchResourceBookById(resourceBookId)
    if (!resourceBook) {
      return json(404, { error: 'Kaynak bulunamadı.' })
    }

    const requestDb = await withRequest({
      teacherUserId: { type: sql.UniqueIdentifier, value: teacherUserId },
      subjectId: { type: sql.UniqueIdentifier, value: resourceBook.subjectId },
      grade: { type: sql.NVarChar(20), value: resourceBook.grade },
      resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId },
    })
    const result = await requestDb.query(`
      SELECT st.id AS student_teacher_id, st.student_id, u.full_name AS student_full_name,
             CASE WHEN srb.resource_book_id IS NULL THEN 0 ELSE 1 END AS assigned
      FROM dbo.StudentTeachers st
      INNER JOIN dbo.Users u ON u.id = st.student_id
      INNER JOIN dbo.StudentProfiles sp ON sp.student_id = st.student_id
      LEFT JOIN dbo.StudentResourceBooks srb ON srb.student_id = st.student_id AND srb.resource_book_id = @resourceBookId
      WHERE st.teacher_user_id = @teacherUserId AND st.is_active = 1 AND st.subject_id = @subjectId AND sp.grade = @grade
      ORDER BY u.full_name ASC;
    `)

    return json(200, {
      students: result.recordset.map((record) => ({
        studentTeacherId: record.student_teacher_id,
        studentId: record.student_id,
        fullName: record.student_full_name,
        assigned: Boolean(record.assigned),
      })),
    })
  } catch (error) {
    return handleError(error, 'listAssignableStudentsForLibraryResourceHandler', 'Öğrenciler yüklenemedi.')
  }
}

async function assignLibraryResourceBookHandler(request) {
  try {
    const { error, studentId, subjectId, studentTeacherId } = await requireTeacherStudentContext(request)
    if (error) return error

    const resourceBookId = request.params.resourceBookId
    const resourceBook = await fetchResourceBookById(resourceBookId)
    if (!resourceBook) {
      return json(404, { error: 'Kaynak bulunamadı.' })
    }
    if (resourceBook.subjectId !== subjectId) {
      return json(400, { error: 'Bu kaynak, bu öğrenciyle olan dersinize ait değil.' })
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      studentTeacherId: { type: sql.UniqueIdentifier, value: studentTeacherId },
      resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId },
    })
    await requestDb.query(`
      INSERT INTO dbo.StudentResourceBooks (student_id, resource_book_id)
      SELECT @studentId, @resourceBookId
      WHERE NOT EXISTS (
        SELECT 1 FROM dbo.StudentResourceBooks WHERE student_id = @studentId AND resource_book_id = @resourceBookId
      );

      INSERT INTO dbo.StudentTeacherResourceBooks (teacher_id, student_id, resource_book_id)
      SELECT @studentTeacherId, @studentId, @resourceBookId
      WHERE NOT EXISTS (
        SELECT 1 FROM dbo.StudentTeacherResourceBooks WHERE teacher_id = @studentTeacherId AND resource_book_id = @resourceBookId
      );
    `)

    return json(200, { success: true })
  } catch (error) {
    if (error.number === 547) {
      return json(400, { error: 'Kaynak bulunamadı.' })
    }
    return handleError(error, 'assignLibraryResourceBookHandler', 'Kaynak atanamadı.')
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
      WHERE h.student_id = @studentId AND h.subject_id = @subjectId
        AND (h.resource_book_id IS NULL OR EXISTS (
          SELECT 1 FROM dbo.StudentTeacherResourceBooks strb
          WHERE strb.teacher_id = @studentTeacherId AND strb.resource_book_id = h.resource_book_id
        ))
      ORDER BY h.due_date ASC;
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

    const resourceBookId = payload?.resourceBookId || null
    const testIds = Array.isArray(payload?.testIds) ? payload.testIds : []
    const title = payload?.title?.trim()
    const description = payload?.description?.trim() || null
    const assignedDate = payload?.assignedDate
    const dueDate = payload?.dueDate
    const totalQuestionCount = Number(payload?.totalQuestionCount) || 0
    const totalPageCount = payload?.totalPageCount != null ? Number(payload.totalPageCount) || 0 : null
    const priority = payload?.priority || 'orta'
    const dayPlans = Array.isArray(payload?.dayPlans) ? payload.dayPlans : []
    const taskDate = payload?.taskDate || null
    const taskTime = payload?.taskTime || null
    const taskDurationMinutes = Number(payload?.taskDurationMinutes) || null

    if (!resourceBookId) {
      return json(400, { error: 'Ödev için takip ettiğiniz bir kaynak seçilmeli.' })
    }
    if (!title || title.length < 2) {
      return json(400, { error: 'Ödev başlığı en az 2 karakter olmalı.' })
    }
    if (!assignedDate || !dueDate) {
      return json(400, { error: 'Tarih bilgileri zorunludur.' })
    }

    const assignedResource = await getAssignedResourceBook(studentId, subjectId, resourceBookId, {
      studentTeacherId,
    })
    if (!assignedResource) {
      return json(400, { error: 'Seçilen kaynak sizin takip ettiğiniz kaynaklardan değil.' })
    }

    if (assignedResource.resourceType !== 'okuma_kitabi') {
      const duplicateCheckDb = await withRequest({
        studentId: { type: sql.UniqueIdentifier, value: studentId },
        subjectId: { type: sql.UniqueIdentifier, value: subjectId },
        resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId },
        description: { type: sql.NVarChar(1000), value: description },
        dueDate: { type: sql.Date, value: dueDate },
      })
      const duplicateResult = await duplicateCheckDb.query(`
        SELECT TOP 1 h.id
        FROM dbo.Homeworks h
        WHERE h.student_id = @studentId
          AND h.subject_id = @subjectId
          AND h.resource_book_id = @resourceBookId
          AND h.description = @description
          AND h.due_date = @dueDate;
      `)
      if (duplicateResult.recordset.length) {
        return json(409, { error: 'Bu kaynak ve test için zaten bir ödev eklenmiş.' })
      }
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      subjectId: { type: sql.UniqueIdentifier, value: subjectId },
      resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId },
      title: { type: sql.NVarChar(200), value: title },
      description: { type: sql.NVarChar(1000), value: description },
      assignedDate: { type: sql.Date, value: assignedDate },
      dueDate: { type: sql.Date, value: dueDate },
      totalQuestionCount: { type: sql.Int, value: totalQuestionCount },
      totalPageCount: { type: sql.Int, value: totalPageCount },
      priority: { type: sql.NVarChar(20), value: priority },
      isSplit: { type: sql.Bit, value: dayPlans.length > 1 },
      dayPlansJson: { type: sql.NVarChar(sql.MAX), value: dayPlans.length ? JSON.stringify(dayPlans) : null },
    })

    const result = await requestDb.query(`
      INSERT INTO dbo.Homeworks (
        student_id, subject_id, resource_book_id, title, description, assigned_date, due_date,
        total_question_count, total_page_count, priority, is_split, day_plans_json
      )
      OUTPUT inserted.id
      VALUES (
        @studentId, @subjectId, @resourceBookId, @title, @description, @assignedDate, @dueDate,
        @totalQuestionCount, @totalPageCount, @priority, @isSplit, @dayPlansJson
      );
    `)

    const insertedId = result.recordset[0].id

    const fetchDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: insertedId } })
    const fetchResult = await fetchDb.query(`
      ${SELECT_HOMEWORK}
      WHERE h.id = @id;
    `)

    const homework = sanitizeHomework(fetchResult.recordset[0])
    if (taskDate) {
      await createTaskForHomework(studentId, homework, taskDate, resourceBookId, testIds, taskTime, taskDurationMinutes)
    }

    return json(201, { homework })
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
    const { error, studentId, subjectId } = await requireTeacherStudentContext(request, {
      studentTeacherId: payload?.studentTeacherId,
    })
    if (error) return error

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

    const hwDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: homeworkId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      subjectId: { type: sql.UniqueIdentifier, value: subjectId },
    })
    const hwResult = await hwDb.query(`
      SELECT h.id, h.resource_book_id, rb.resource_type, s.name AS subject_name,
             h.title, h.total_question_count, h.completed_question_count, h.total_page_count, h.status
      FROM dbo.Homeworks h
      INNER JOIN dbo.Subjects s ON s.id = h.subject_id
      LEFT JOIN dbo.ResourceBooks rb ON rb.id = h.resource_book_id
      WHERE h.id = @id AND h.student_id = @studentId AND h.subject_id = @subjectId;
    `)
    const homework = hwResult.recordset[0]
    if (!homework) {
      return json(404, { error: 'Ödev bulunamadı.' })
    }

    const endTime = computeEndTime(startTime, durationMinutes)

    const existingDb = await withRequest({ homeworkId: { type: sql.UniqueIdentifier, value: homeworkId } })
    const existingResult = await existingDb.query(`
      SELECT TOP 1 id FROM dbo.Tasks WHERE homework_id = @homeworkId ORDER BY created_at DESC;
    `)
    const existingTaskId = existingResult.recordset[0]?.id

    if (existingTaskId) {
      const updateDb = await withRequest({
        id: { type: sql.UniqueIdentifier, value: existingTaskId },
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
    } else {
      const insertDb = await withRequest({
        studentId: { type: sql.UniqueIdentifier, value: studentId },
        date: { type: sql.Date, value: date },
        title: { type: sql.NVarChar(200), value: `${homework.subject_name} Ödevi` },
        description: { type: sql.NVarChar(1000), value: homework.title },
        subject: { type: sql.NVarChar(100), value: homework.subject_name },
        taskType: { type: sql.NVarChar(40), value: 'odev' },
        startTime: { type: sql.Char(5), value: startTime },
        endTime: { type: sql.Char(5), value: endTime },
        durationMinutes: { type: sql.Int, value: durationMinutes },
        targetQuestionCount: { type: sql.Int, value: homework.total_question_count || null },
        completedQuestionCount: { type: sql.Int, value: homework.completed_question_count || 0 },
        status: { type: sql.NVarChar(30), value: homework.status || 'bekliyor' },
        resourceBookId: { type: sql.UniqueIdentifier, value: homework.resource_book_id || null },
        targetPageCount: {
          type: sql.Int,
          value: homework.resource_type === 'okuma_kitabi' ? homework.total_page_count || null : null,
        },
        homeworkId: { type: sql.UniqueIdentifier, value: homeworkId },
      })
      await insertDb.query(`
        INSERT INTO dbo.Tasks (
          student_id, date, title, description, subject, task_type, start_time, end_time,
          duration_minutes, target_question_count, completed_question_count, status,
          is_draft, resource_book_id, target_page_count, completed_page_count, homework_id
        )
        VALUES (
          @studentId, @date, @title, @description, @subject, @taskType, @startTime, @endTime,
          @durationMinutes, @targetQuestionCount, @completedQuestionCount, @status,
          0, @resourceBookId, @targetPageCount, 0, @homeworkId
        );
      `)
    }

    const fetchDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: homeworkId } })
    const fetchResult = await fetchDb.query(`
      ${SELECT_HOMEWORK}
      WHERE h.id = @id;
    `)

    return json(200, { homework: sanitizeHomework(fetchResult.recordset[0]) })
  } catch (error) {
    return handleError(error, 'assignTeacherHomeworkTaskHandler', 'Görev oluşturulamadı.')
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
      WHERE t.student_id = @studentId AND t.date = @date AND t.is_draft = 0
        AND (
          t.student_teacher_id = @studentTeacherId
          OR (
            t.homework_id IN (SELECT id FROM dbo.Homeworks WHERE student_id = @studentId AND subject_id = @subjectId)
            AND (t.resource_book_id IS NULL OR EXISTS (
              SELECT 1 FROM dbo.StudentTeacherResourceBooks strb
              WHERE strb.teacher_id = @studentTeacherId AND strb.resource_book_id = t.resource_book_id
            ))
          )
        )
      ORDER BY t.start_time ASC;
    `)

    return json(200, { tasks: result.recordset.map(sanitizeTask) })
  } catch (error) {
    return handleError(error, 'listTeacherStudentTasksHandler', 'Görevler yüklenemedi.')
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
      WHERE t.id = @id AND t.student_id = @studentId
        AND t.homework_id IN (SELECT id FROM dbo.Homeworks WHERE student_id = @studentId AND subject_id = @subjectId)
        AND (t.resource_book_id IS NULL OR EXISTS (
          SELECT 1 FROM dbo.StudentTeacherResourceBooks strb
          WHERE strb.teacher_id = @studentTeacherId AND strb.resource_book_id = t.resource_book_id
        ));
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
                   rb.name, rb.page_count, rb.resource_type, rb.has_answer_key
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
                   rb.resource_type, rb.image_url, p.name AS publisher_name, rb.subject_id AS resource_subject_id,
                   s.name AS resource_subject_name, t.created_at, t.updated_at
            FROM dbo.Tasks t
            LEFT JOIN dbo.ResourceBooks rb ON rb.id = t.resource_book_id
            LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
            LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
            WHERE t.student_id = @studentId AND t.is_draft = 0
              AND t.homework_id IN (SELECT id FROM dbo.Homeworks WHERE student_id = @studentId AND subject_id = @subjectId)
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
                   rb.resource_type, rb.image_url, p.name AS publisher_name, rb.subject_id AS resource_subject_id,
                   s.name AS resource_subject_name
            FROM dbo.StudySessions ss
            LEFT JOIN dbo.Tasks t ON t.id = ss.task_id
            LEFT JOIN dbo.ResourceBooks rb ON rb.id = t.resource_book_id
            LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
            LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
            WHERE ss.student_id = @studentId
              AND ss.task_id IN (SELECT id FROM dbo.Tasks WHERE homework_id IN (
                SELECT id FROM dbo.Homeworks WHERE student_id = @studentId AND subject_id = @subjectId
              ))
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
                   rb.name AS resource_book_name, rb.resource_type, rb.image_url, p.name AS publisher_name,
                   h.title, h.description, h.assigned_date, h.due_date,
                   h.total_question_count, h.completed_question_count, h.total_page_count,
                   h.status, h.created_at, h.updated_at
            FROM dbo.Homeworks h
            INNER JOIN dbo.Subjects s ON s.id = h.subject_id
            LEFT JOIN dbo.ResourceBooks rb ON rb.id = h.resource_book_id
            LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
            WHERE h.student_id = @studentId AND h.subject_id = @subjectId
              AND (h.resource_book_id IS NULL OR EXISTS (
                SELECT 1 FROM dbo.StudentTeacherResourceBooks strb
                WHERE strb.teacher_id = @studentTeacherId AND strb.resource_book_id = h.resource_book_id
              ))
            ORDER BY h.due_date DESC;
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
                   rb.id AS resource_book_id, rb.name AS resource_book_name, rb.resource_type, rb.image_url,
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

    return json(200, {
      resourceBooks: resourceBooksResult.recordset.map(sanitizeProgressResourceBook),
      tests: testsResult.recordset.map(sanitizeProgressTest),
      tasks: tasksResult.recordset.map(sanitizeProgressTask),
      sessions: sessionsResult.recordset.map(sanitizeProgressSession),
      homeworks: homeworksResult.recordset.map(sanitizeProgressHomework),
      wrongQuestions: wrongQuestionsResult.recordset.map(sanitizeWrongQuestion),
      manualTestCompletions: manualTestCompletionsResult.recordset.map(sanitizeManualTestCompletion),
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
    const result = await requestDb.query(`
      SELECT wq.id, wq.student_id, wq.task_id, wq.test_id, wq.subject, wq.test_name,
             wq.question_number, wq.error_type, wq.student_note, wq.mistake_reason,
             wq.review_status, wq.resolved_at,
             CAST(1 AS bit) AS has_photo, wq.created_at,
             COALESCE(tp.name, wq.topic) AS topic,
             COALESCE(rb.name, wq.book_name) AS book_name,
             COALESCE(pub.name, wq.publisher_name) AS publisher_name,
             rb.image_url AS book_image_url
      FROM dbo.WrongQuestions wq
      LEFT JOIN dbo.ResourceBookTopicTests t ON t.id = wq.test_id
      LEFT JOIN dbo.ResourceBookTopics tp ON tp.id = t.topic_id
      LEFT JOIN dbo.ResourceBooks rb ON rb.id = tp.resource_book_id
      LEFT JOIN dbo.Publishers pub ON pub.id = rb.publisher_id
      WHERE wq.student_id = @studentId AND wq.subject = @subject AND wq.test_id IS NOT NULL
      ${resourceBookId ? 'AND tp.resource_book_id = @resourceBookId' : ''}
      ORDER BY wq.created_at DESC;
    `)

    return json(200, { wrongQuestions: result.recordset.map(sanitizeWrongQuestion) })
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

    if (!payload || payload.mistakeReason === undefined || !MISTAKE_REASONS.includes(payload.mistakeReason)) {
      return json(400, { error: 'Geçersiz hata nedeni.' })
    }

    const subjectName = await resolveTeacherSubjectName(subjectId)

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: wrongQuestionId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      subject: { type: sql.NVarChar(100), value: subjectName },
      mistakeReason: { type: sql.NVarChar(30), value: payload.mistakeReason },
    })
    const result = await requestDb.query(`
      UPDATE dbo.WrongQuestions SET mistake_reason = @mistakeReason
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
  updateTeacherStudentStatusHandler,
  deleteTeacherStudentHandler,
  listTeacherParentsHandler,
  getTeacherLessonPlanHandler,
  addTeacherRecurringLessonSlotHandler,
  updateTeacherRecurringLessonSlotHandler,
  deleteTeacherRecurringLessonSlotHandler,
  addTeacherOneTimeLessonHandler,
  updateTeacherOneTimeLessonHandler,
  deleteTeacherOneTimeLessonHandler,
  listTeacherResourceBooksHandler,
  listTeacherResourceBookTopicsHandler,
  markTeacherResourceBookTopicTestCompletionHandler,
  unmarkTeacherResourceBookTopicTestCompletionHandler,
  submitTeacherManualOpticalAnswersHandler,
  saveTeacherManualWrongQuestionPhotoHandler,
  listLibraryResourceBooksForTeacherHandler,
  createLibraryResourceBookForTeacherHandler,
  getLibraryResourceBookDetailForTeacherHandler,
  deleteLibraryResourceBookForTeacherHandler,
  addLibraryResourceBookTopicsForTeacherHandler,
  extractLibraryTocForTeacherHandler,
  listAssignableStudentsForLibraryResourceHandler,
  assignLibraryResourceBookHandler,
  listTeacherStudentHomeworksHandler,
  createTeacherHomeworkHandler,
  assignTeacherHomeworkTaskHandler,
  listTeacherStudentTasksHandler,
  getTeacherTaskAnswerSheetHandler,
  getTeacherStudentProgressOverviewHandler,
  listTeacherStudentWrongQuestionsHandler,
  getTeacherStudentWrongQuestionPhotoHandler,
  getTeacherStudentWrongQuestionTopicStatsHandler,
  updateTeacherStudentWrongQuestionHandler,
  grantParentAccessHandler,
  getTeacherEntitlementHandler,
  createTeacherStudentHandler,
  listTeacherLibraryGradesHandler,
  addTeacherLibraryGradeHandler,
  removeTeacherLibraryGradeHandler,
}
