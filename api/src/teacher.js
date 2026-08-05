const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { clearSessionHeaders, json } = require('./http')
const { isSessionError } = require('./security')
const { requireTeacherSession, requireTeacherStudentContext } = require('./teacherScope')
const { fetchTeacherResourceBooks } = require('./students')
const {
  SELECT_HOMEWORK,
  sanitizeHomework,
  getAssignedResourceBook,
  createTaskForHomework,
  isValidTime,
  computeEndTime,
} = require('./homework')
const { SELECT_TASK, sanitizeTask } = require('./tasks')
const { fetchResourceBookTopicsWithTests } = require('./catalog')
const {
  sanitizeProgressResourceBook,
  sanitizeProgressTest,
  sanitizeProgressTask,
  sanitizeProgressSession,
  sanitizeProgressHomework,
  sanitizeWrongQuestion,
} = require('./progress')

const TEACHER_TYPE_LABELS = {
  ozel_ogretmen: 'Özel Öğretmen',
  okul_ogretmeni: 'Okul Öğretmeni',
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

async function listTeacherStudentsHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) return error

    const requestDb = await withRequest({ teacherUserId: { type: sql.UniqueIdentifier, value: teacherUserId } })
    const result = await requestDb.query(`
      SELECT st.id AS student_teacher_id, st.student_id, u.full_name AS student_full_name,
             st.subject_id, s.name AS subject_name, st.teacher_type, st.schedule_json, st.access_granted_at,
             (SELECT COUNT(*) FROM dbo.StudentTeacherResourceBooks strb WHERE strb.teacher_id = st.id) AS resource_count
      FROM dbo.StudentTeachers st
      INNER JOIN dbo.Users u ON u.id = st.student_id
      LEFT JOIN dbo.Subjects s ON s.id = st.subject_id
      WHERE st.teacher_user_id = @teacherUserId
      ORDER BY u.full_name ASC, s.name ASC;
    `)

    const students = result.recordset.map((record) => ({
      studentTeacherId: record.student_teacher_id,
      studentId: record.student_id,
      studentFullName: record.student_full_name,
      subjectId: record.subject_id,
      subjectName: record.subject_name || null,
      teacherType: record.teacher_type,
      typeLabel: TEACHER_TYPE_LABELS[record.teacher_type] || record.teacher_type,
      schedule: parseScheduleJson(record.schedule_json),
      resourceCount: Number(record.resource_count) || 0,
      accessGrantedAt: record.access_granted_at || null,
    }))

    return json(200, { students })
  } catch (error) {
    return handleError(error, 'listTeacherStudentsHandler', 'Öğrenciler yüklenemedi.')
  }
}

async function listTeacherParentsHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) return error

    const requestDb = await withRequest({ teacherUserId: { type: sql.UniqueIdentifier, value: teacherUserId } })
    const result = await requestDb.query(`
      SELECT p.id AS parent_id, p.full_name AS parent_full_name, p.phone_number AS parent_phone,
             u.id AS student_id, u.full_name AS student_full_name
      FROM dbo.StudentTeachers st
      INNER JOIN dbo.Users u ON u.id = st.student_id
      INNER JOIN dbo.Users p ON p.id = u.parent_id
      WHERE st.teacher_user_id = @teacherUserId
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
          students: [student],
        })
      }
    })

    return json(200, { parents: Array.from(parentsById.values()) })
  } catch (error) {
    return handleError(error, 'listTeacherParentsHandler', 'Veliler yüklenemedi.')
  }
}

async function getTeacherLessonPlanHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) return error

    const requestDb = await withRequest({ teacherUserId: { type: sql.UniqueIdentifier, value: teacherUserId } })
    const result = await requestDb.query(`
      SELECT st.id AS student_teacher_id, u.full_name AS student_full_name, s.name AS subject_name, st.schedule_json
      FROM dbo.StudentTeachers st
      INNER JOIN dbo.Users u ON u.id = st.student_id
      LEFT JOIN dbo.Subjects s ON s.id = st.subject_id
      WHERE st.teacher_user_id = @teacherUserId
        AND st.teacher_type = 'ozel_ogretmen'
        AND st.schedule_json IS NOT NULL;
    `)

    const entries = result.recordset.flatMap((record) =>
      parseScheduleJson(record.schedule_json).map((slot) => ({
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        studentTeacherId: record.student_teacher_id,
        studentFullName: record.student_full_name,
        subjectName: record.subject_name || null,
      })),
    )

    return json(200, { entries })
  } catch (error) {
    return handleError(error, 'getTeacherLessonPlanHandler', 'Ders planı yüklenemedi.')
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

async function listTeacherStudentHomeworksHandler(request) {
  try {
    const { error, studentId, subjectId } = await requireTeacherStudentContext(request)
    if (error) return error

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      subjectId: { type: sql.UniqueIdentifier, value: subjectId },
    })
    const result = await requestDb.query(`
      ${SELECT_HOMEWORK}
      WHERE h.student_id = @studentId AND h.subject_id = @subjectId
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
      await createTaskForHomework(studentId, homework, taskDate, resourceBookId, testIds, taskTime)
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
    const { error, studentId, subjectId } = await requireTeacherStudentContext(request)
    if (error) return error

    const date = request.query.get('date')
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json(400, { error: 'Geçerli bir tarih belirtilmeli.' })
    }

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      subjectId: { type: sql.UniqueIdentifier, value: subjectId },
      date: { type: sql.Date, value: date },
    })
    const result = await requestDb.query(`
      ${SELECT_TASK}
      WHERE t.student_id = @studentId AND t.date = @date AND t.is_draft = 0
        AND t.homework_id IN (SELECT id FROM dbo.Homeworks WHERE student_id = @studentId AND subject_id = @subjectId)
      ORDER BY t.start_time ASC;
    `)

    return json(200, { tasks: result.recordset.map(sanitizeTask) })
  } catch (error) {
    return handleError(error, 'listTeacherStudentTasksHandler', 'Görevler yüklenemedi.')
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

    const [resourceBooksResult, testsResult, tasksResult, sessionsResult, homeworksResult, wrongQuestionsResult] =
      await Promise.all([
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
                   rb.resource_type, p.name AS publisher_name, rb.subject_id AS resource_subject_id,
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
                   rb.resource_type, p.name AS publisher_name, rb.subject_id AS resource_subject_id,
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
                   rb.name AS resource_book_name, rb.resource_type, p.name AS publisher_name,
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
            SELECT id, student_id, task_id, subject, topic, question_number, error_type, student_note,
                   review_status, resolved_at, created_at
            FROM dbo.WrongQuestions
            WHERE student_id = @studentId AND subject = @subject
            ORDER BY created_at DESC;
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
    })
  } catch (error) {
    return handleError(error, 'getTeacherStudentProgressOverviewHandler', 'Gelişim verileri yüklenemedi.')
  }
}

module.exports = {
  listTeacherStudentsHandler,
  listTeacherParentsHandler,
  getTeacherLessonPlanHandler,
  listTeacherResourceBooksHandler,
  listTeacherResourceBookTopicsHandler,
  listTeacherStudentHomeworksHandler,
  createTeacherHomeworkHandler,
  assignTeacherHomeworkTaskHandler,
  listTeacherStudentTasksHandler,
  getTeacherStudentProgressOverviewHandler,
}
