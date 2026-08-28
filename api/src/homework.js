const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { json } = require('./http')
const { isSessionError } = require('./security')
const { requireStudentContext, requireStudentWriteContext } = require('./studentScope')

function toISODate(value) {
  if (!value) return null
  return value instanceof Date ? value.toISOString().slice(0, 10) : value
}

function sanitizeHomework(record) {
  return {
    id: record.id,
    studentId: record.student_id,
    subjectId: record.subject_id,
    subject: record.subject_name,
    resourceBookId: record.resource_book_id,
    resourceBookName: record.resource_book_name || null,
    resourceType: record.resource_book_type || null,
    publisherName: record.publisher_name || null,
    schoolResourceId: record.school_resource_id || null,
    schoolResourceName: record.school_resource_name || null,
    schoolResourceImageUrl: record.school_resource_image_url || null,
    homeworkType: record.school_resource_id ? 'okul-odevi' : 'soru-bankasi-odevi',
    title: record.title,
    description: record.description || '',
    assignedDate: toISODate(record.assigned_date),
    dueDate: record.task_id ? toISODate(record.due_date) : null,
    totalQuestionCount: record.total_question_count,
    completedQuestionCount: record.completed_question_count,
    totalPageCount: record.total_page_count,
    priority: record.priority,
    status: record.status,
    isSplit: Boolean(record.is_split),
    dayPlans: record.day_plans_json ? JSON.parse(record.day_plans_json) : [],
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    hasTask: Boolean(record.task_id),
    taskId: record.task_id || null,
    taskDate: toISODate(record.task_date),
    taskStartTime: record.task_start_time || null,
    taskEndTime: record.task_end_time || null,
    taskDurationMinutes: record.task_duration_minutes ?? null,
  }
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')
}

function computeEndTime(startTime, durationMinutes) {
  const [startHour, startMinute] = startTime.split(':').map(Number)
  const startMinutes = startHour * 60 + startMinute
  const endMinutes = (startMinutes + durationMinutes) % (24 * 60)
  return `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`
}

// studentTeacherId verilirse (öğretmen tarafı çağrısı), kaynak ayrıca öğretmenin
// StudentTeacherResourceBooks'ta takip ettiği kaynaklardan olmalı — öğretmen sadece
// kendi eklediği/takip ettiği kaynaktan ödev verebilir.
async function getAssignedResourceBook(studentId, subjectId, resourceBookId, { studentTeacherId } = {}) {
  const requestDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    subjectId: { type: sql.UniqueIdentifier, value: subjectId },
    resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId },
    ...(studentTeacherId ? { studentTeacherId: { type: sql.UniqueIdentifier, value: studentTeacherId } } : {}),
  })
  const result = await requestDb.query(`
    SELECT TOP 1 rb.id, rb.resource_type
    FROM dbo.StudentResourceBooks srb
    INNER JOIN dbo.ResourceBooks rb ON rb.id = srb.resource_book_id
    WHERE srb.student_id = @studentId
      AND srb.resource_book_id = @resourceBookId
      AND rb.subject_id = @subjectId
      AND rb.is_active = 1
      ${
        studentTeacherId
          ? `AND EXISTS (
               SELECT 1 FROM dbo.StudentTeacherResourceBooks strb
               WHERE strb.teacher_id = @studentTeacherId AND strb.resource_book_id = @resourceBookId
             )`
          : ''
      };
  `)

  const record = result.recordset[0]
  if (!record) return null

  return {
    id: record.id,
    resourceType: record.resource_type,
  }
}

// Okul Ödevi için: seçilen okul kaynağı, öğrencinin okulu + sınıfı + bu ders için
// tanımlı aktif bir SchoolClassResources kaydı olmalı (bkz. getPanelSchoolResourcesHandler).
async function getAssignedSchoolResource(studentId, subjectId, schoolResourceId) {
  const requestDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    subjectId: { type: sql.UniqueIdentifier, value: subjectId },
    schoolResourceId: { type: sql.UniqueIdentifier, value: schoolResourceId },
  })
  const result = await requestDb.query(`
    SELECT TOP 1 scr.id, scr.name
    FROM dbo.SchoolClassResources scr
    INNER JOIN dbo.StudentProfiles sp ON sp.school_id = scr.school_id AND sp.grade = scr.grade
    WHERE sp.student_id = @studentId
      AND scr.id = @schoolResourceId
      AND scr.subject_id = @subjectId
      AND scr.is_active = 1;
  `)

  const record = result.recordset[0]
  if (!record) return null

  return { id: record.id, name: record.name }
}

// Parent bir tarih seçtiyse, öğrencinin o güne ait canlı plan görev listesinde de görünmesi için
// dbo.Homeworks satırına eşlik eden bir dbo.Tasks satırı oluşturur (taslak değil, canlı).
// resourceBookId + testIds burada aktarılır ki soru bankası görevlerinde dijital cevap kağıdı
// (bkz. tasks.js getTaskAnswerSheetHandler) gerçek test/soru sayısına ve cevap anahtarına erişebilsin.
async function createTaskForHomework(
  studentId,
  homework,
  taskDate,
  resourceBookId,
  testIds,
  taskTime,
  durationMinutesOverride,
  { schoolResourceId = null } = {},
) {
  try {
    const isSchoolHomework = Boolean(schoolResourceId)
    const durationMinutes = Number.isFinite(durationMinutesOverride) && durationMinutesOverride > 0
      ? durationMinutesOverride
      : Math.min(60, Math.max(20, homework.totalQuestionCount || 20))
    const startTime = isValidTime(taskTime) ? taskTime : null
    let endTime = null
    if (startTime) {
      const [startHour, startMinute] = startTime.split(':').map(Number)
      const startMinutes = startHour * 60 + startMinute
      const endMinutes = (startMinutes + durationMinutes) % (24 * 60)
      endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`
    }
    const sanitizedTestIds = Array.isArray(testIds) ? testIds.filter((id) => typeof id === 'string' && id) : []

    const requestDb = await withRequest({
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      date: { type: sql.Date, value: taskDate },
      title: { type: sql.NVarChar(200), value: `${homework.subject} Ödevi` },
      description: { type: sql.NVarChar(1000), value: homework.title },
      subject: { type: sql.NVarChar(100), value: homework.subject },
      taskType: { type: sql.NVarChar(40), value: isSchoolHomework ? 'okul-odevi' : 'odev' },
      startTime: { type: sql.Char(5), value: startTime },
      endTime: { type: sql.Char(5), value: endTime },
      durationMinutes: { type: sql.Int, value: durationMinutes },
      targetQuestionCount: { type: sql.Int, value: homework.totalQuestionCount || null },
      resourceBookId: { type: sql.UniqueIdentifier, value: isSchoolHomework ? null : resourceBookId || null },
      schoolResourceId: { type: sql.UniqueIdentifier, value: schoolResourceId || null },
      selectedTestIdsJson: { type: sql.NVarChar(sql.MAX), value: sanitizedTestIds.length ? JSON.stringify(sanitizedTestIds) : null },
      targetPageCount: { type: sql.Int, value: homework.resourceType === 'okuma_kitabi' ? homework.totalPageCount || null : null },
      homeworkId: { type: sql.UniqueIdentifier, value: homework.id },
    })

    await requestDb.query(`
      INSERT INTO dbo.Tasks (
        student_id, date, title, description, subject, task_type, start_time, end_time,
        duration_minutes, target_question_count, completed_question_count, is_draft,
        resource_book_id, school_resource_id, selected_test_ids_json, target_page_count, completed_page_count, homework_id
      )
      VALUES (
        @studentId, @date, @title, @description, @subject, @taskType, @startTime, @endTime,
        @durationMinutes, @targetQuestionCount, 0, 0,
        @resourceBookId, @schoolResourceId, @selectedTestIdsJson, @targetPageCount, 0, @homeworkId
      );
    `)
  } catch (error) {
    console.error('createTaskForHomework failed', error)
  }
}

// h.due_date is always populated (falls back to assigned_date when the parent
// doesn't pick a day), so it alone can't tell an actually-scheduled homework
// apart from one that only lives in this list. Whether a dbo.Tasks row is
// linked back via homework_id is the real signal of "assigned to a day"; the
// OUTER APPLY also surfaces that task's own date/time/duration so the UI can
// show and edit the actual schedule instead of just a yes/no flag.
const SELECT_HOMEWORK = `
  SELECT h.id, h.student_id, h.subject_id, s.name AS subject_name, h.resource_book_id, rb.name AS resource_book_name,
         rb.resource_type AS resource_book_type, p.name AS publisher_name,
         h.school_resource_id, scr.name AS school_resource_name, scr.image_url AS school_resource_image_url,
         h.title, h.description, h.assigned_date, h.due_date, h.total_question_count, h.completed_question_count,
         h.total_page_count,
         h.priority, h.status, h.is_split, h.day_plans_json, h.created_at, h.updated_at,
         t.id AS task_id, t.date AS task_date, t.start_time AS task_start_time, t.end_time AS task_end_time,
         t.duration_minutes AS task_duration_minutes
  FROM dbo.Homeworks h
  INNER JOIN dbo.Subjects s ON s.id = h.subject_id
  LEFT JOIN dbo.ResourceBooks rb ON rb.id = h.resource_book_id
  LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
  LEFT JOIN dbo.SchoolClassResources scr ON scr.id = h.school_resource_id
  OUTER APPLY (
    SELECT TOP 1 tk.id, tk.date, tk.start_time, tk.end_time, tk.duration_minutes
    FROM dbo.Tasks tk
    WHERE tk.homework_id = h.id
    ORDER BY tk.created_at DESC
  ) t
`

// task_type = 'odev' olup hiçbir Homeworks kaydına bağlı olmayan (homework_id NULL) canlı
// görevler: örn. "Geçen Haftayı Kopyala" ile çoğaltılmış bir görev, kopyalama sırasında
// homework_id alanını taşımadığı için sahipsiz kalır (bkz. weeklyPlanService.js
// copyPreviousWeek); benzer şekilde resource_book_id de kopyalanan görevde zaten boşsa
// (örn. zincirleme kopyalarda) sahipsiz kalmaya devam eder. Bu yüzden resource_book_id
// şartı aranmıyor: task_type = 'odev' tek başına yeterli sinyal. Bu görevler öğrencinin
// Bugün planında görünmeye devam eder ama aksi halde Ödevlerim listesinde hiç görünmez;
// burada onları ödev benzeri bir kayıt olarak listeye ekliyoruz.
const SELECT_ORPHAN_TASK_HOMEWORK = `
  SELECT t.id, t.student_id, t.subject, rb.name AS resource_book_name, rb.resource_type AS resource_book_type,
         p.name AS publisher_name, t.title, t.description, t.date, t.target_question_count,
         t.completed_question_count, t.target_page_count, t.priority, t.status, t.created_at, t.updated_at
  FROM dbo.Tasks t
  LEFT JOIN dbo.ResourceBooks rb ON rb.id = t.resource_book_id
  LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
  WHERE t.student_id = @studentId AND t.task_type = 'odev' AND t.homework_id IS NULL AND t.is_draft = 0
`

// createTaskForHomework, görev listesinde kısa görünsün diye Tasks.title alanına hep
// "{ders} Ödevi" gibi genel bir başlık yazar; asıl ödev başlığı (kaynak/test adları) ise
// Tasks.description'a konur. homework_id bağlantısı koptuğunda (bkz. yukarıdaki sorgu)
// h.title artık okunamadığı için, bu genel kalıba denk gelen görevlerde description'ı
// başlık olarak kullanıyoruz; aksi halde Ödevlerim'de anlamsız "Fen Bilimleri Ödevi" gibi
// bir satır görünür. Elle eklenmiş (AddTaskDrawer) 'odev' görevlerinde başlık zaten
// anlamlı olduğundan bu kalıba denk gelmez ve dokunulmaz.
function sanitizeOrphanTaskAsHomework(record) {
  const genericTaskTitle = record.subject ? `${record.subject} Ödevi` : null
  const isGenericTitle = genericTaskTitle && record.title === genericTaskTitle && record.description
  const title = isGenericTitle ? record.description : record.title

  return {
    id: record.id,
    studentId: record.student_id,
    subjectId: null,
    subject: record.subject,
    resourceBookId: null,
    resourceBookName: record.resource_book_name || null,
    resourceType: record.resource_book_type || null,
    publisherName: record.publisher_name || null,
    title,
    description: isGenericTitle ? '' : record.description || '',
    assignedDate: toISODate(record.date),
    dueDate: toISODate(record.date),
    totalQuestionCount: record.target_question_count || 0,
    completedQuestionCount: record.completed_question_count || 0,
    totalPageCount: record.target_page_count,
    priority: record.priority,
    status: record.status,
    isSplit: false,
    dayPlans: [],
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    isTaskOnly: true,
  }
}

async function listHomeworksHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const [result, orphanTaskResult] = await Promise.all([
      withRequest({ studentId: { type: sql.UniqueIdentifier, value: studentId } }).then((requestDb) =>
        requestDb.query(`
          ${SELECT_HOMEWORK}
          WHERE h.student_id = @studentId
          ORDER BY h.due_date ASC;
        `),
      ),
      withRequest({ studentId: { type: sql.UniqueIdentifier, value: studentId } }).then((requestDb) =>
        requestDb.query(SELECT_ORPHAN_TASK_HOMEWORK),
      ),
    ])

    const homeworks = [
      ...result.recordset.map(sanitizeHomework),
      ...orphanTaskResult.recordset.map(sanitizeOrphanTaskAsHomework),
    ].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))

    return json(200, { homeworks })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('listHomeworksHandler failed', error)
    return json(500, { error: 'Ödevler yüklenemedi.' })
  }
}

async function createHomeworkHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentWriteContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

    const subjectId = payload?.subjectId
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
    const dayPlans = Array.isArray(payload?.dayPlans) ? payload.dayPlans : []
    const taskDate = payload?.taskDate || null
    const taskTime = payload?.taskTime || null
    const taskDurationMinutes = Number(payload?.taskDurationMinutes) || null

    if (!subjectId) {
      return json(400, { error: 'Ders seçilmeli.' })
    }
    if (isSchoolHomework) {
      if (!schoolResourceId) {
        return json(400, { error: 'Okul ödevi için bir okul kaynağı seçilmeli.' })
      }
    } else if (!resourceBookId) {
      return json(400, { error: 'Ödev için öğrenciye atanmış bir kaynak seçilmeli.' })
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
      assignedResource = await getAssignedResourceBook(studentId, subjectId, resourceBookId)
      if (!assignedResource) {
        return json(400, { error: 'Seçilen kaynak bu öğrenciye bu ders için atanmamış.' })
      }
    }

    if (isSchoolHomework) {
      const duplicateCheckDb = await withRequest({
        studentId: { type: sql.UniqueIdentifier, value: studentId },
        subjectId: { type: sql.UniqueIdentifier, value: subjectId },
        schoolResourceId: { type: sql.UniqueIdentifier, value: schoolResourceId },
        description: { type: sql.NVarChar(1000), value: description },
        dueDate: { type: sql.Date, value: dueDate },
      })
      const duplicateResult = await duplicateCheckDb.query(`
        SELECT TOP 1 h.id
        FROM dbo.Homeworks h
        WHERE h.student_id = @studentId
          AND h.subject_id = @subjectId
          AND h.school_resource_id = @schoolResourceId
          AND h.description = @description
          AND h.due_date = @dueDate;
      `)
      if (duplicateResult.recordset.length) {
        return json(409, { error: 'Bu okul kaynağı için o güne zaten bir ödev eklenmiş.' })
      }
    } else if (assignedResource.resourceType !== 'okuma_kitabi') {
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
      schoolResourceId: { type: sql.UniqueIdentifier, value: schoolResourceId },
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
        student_id, subject_id, resource_book_id, school_resource_id, title, description, assigned_date, due_date,
        total_question_count, total_page_count, priority, is_split, day_plans_json
      )
      OUTPUT inserted.id
      VALUES (
        @studentId, @subjectId, @resourceBookId, @schoolResourceId, @title, @description, @assignedDate, @dueDate,
        @totalQuestionCount, @totalPageCount, @priority, @isSplit, @dayPlansJson
      );
    `)

    const insertedId = result.recordset[0].id

    const fetchDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: insertedId },
    })
    const fetchResult = await fetchDb.query(`
      ${SELECT_HOMEWORK}
      WHERE h.id = @id;
    `)

    const homework = sanitizeHomework(fetchResult.recordset[0])
    if (taskDate) {
      await createTaskForHomework(studentId, homework, taskDate, resourceBookId, testIds, taskTime, taskDurationMinutes, {
        schoolResourceId,
      })
    }

    return json(201, { homework })
  } catch (error) {
    if (error.number === 547) {
      return json(400, { error: 'Seçilen ders veya kaynak bulunamadı.' })
    }

    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('createHomeworkHandler failed', error)
    return json(500, { error: 'Ödev oluşturulamadı.' })
  }
}

async function updateHomeworkHandler(request) {
  try {
    const homeworkId = request.params.homeworkId
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentWriteContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

    const updates = []
    const bindings = {
      id: { type: sql.UniqueIdentifier, value: homeworkId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    }

    if (payload?.completedQuestionCount !== undefined) {
      updates.push('completed_question_count = @completedQuestionCount')
      bindings.completedQuestionCount = { type: sql.Int, value: Number(payload.completedQuestionCount) || 0 }
    }
    if (payload?.status !== undefined) {
      updates.push('status = @status')
      bindings.status = { type: sql.NVarChar(20), value: payload.status }
    }
    if (payload?.title !== undefined) {
      updates.push('title = @title')
      bindings.title = { type: sql.NVarChar(200), value: payload.title.trim() }
    }
    if (payload?.dueDate !== undefined) {
      updates.push('due_date = @dueDate')
      bindings.dueDate = { type: sql.Date, value: payload.dueDate }
    }
    if (payload?.totalQuestionCount !== undefined) {
      updates.push('total_question_count = @totalQuestionCount')
      bindings.totalQuestionCount = { type: sql.Int, value: Number(payload.totalQuestionCount) || 0 }
    }
    if (payload?.totalPageCount !== undefined) {
      updates.push('total_page_count = @totalPageCount')
      bindings.totalPageCount = { type: sql.Int, value: Number(payload.totalPageCount) || 0 }
    }
    if (payload?.schoolResourceId !== undefined) {
      if (!payload?.subjectId || !payload?.schoolResourceId) {
        return json(400, { error: 'Ders ve okul kaynağı birlikte gönderilmeli.' })
      }
      const schoolResource = await getAssignedSchoolResource(studentId, payload.subjectId, payload.schoolResourceId)
      if (!schoolResource) {
        return json(400, { error: 'Seçilen okul kaynağı bu öğrencinin okulu/sınıfı için tanımlı değil.' })
      }
      updates.push('subject_id = @subjectId', 'school_resource_id = @schoolResourceId', 'resource_book_id = NULL')
      bindings.subjectId = { type: sql.UniqueIdentifier, value: payload.subjectId }
      bindings.schoolResourceId = { type: sql.UniqueIdentifier, value: payload.schoolResourceId }
    } else if (payload?.subjectId !== undefined || payload?.resourceBookId !== undefined) {
      if (!payload?.subjectId || !payload?.resourceBookId) {
        return json(400, { error: 'Ders ve kaynak birlikte gönderilmeli.' })
      }
      const assignedResource = await getAssignedResourceBook(studentId, payload.subjectId, payload.resourceBookId)
      if (!assignedResource) {
        return json(400, { error: 'Seçilen kaynak bu öğrenciye bu ders için atanmamış.' })
      }
      updates.push('subject_id = @subjectId', 'resource_book_id = @resourceBookId', 'school_resource_id = NULL')
      bindings.subjectId = { type: sql.UniqueIdentifier, value: payload.subjectId }
      bindings.resourceBookId = { type: sql.UniqueIdentifier, value: payload.resourceBookId }
    }

    if (updates.length === 0) {
      return json(400, { error: 'Güncellenecek alan bulunamadı.' })
    }

    const requestDb = await withRequest(bindings)
    const result = await requestDb.query(`
      UPDATE dbo.Homeworks
      SET ${updates.join(', ')}
      WHERE id = @id AND student_id = @studentId;
    `)

    if (!result.rowsAffected[0]) {
      return json(404, { error: 'Ödev bulunamadı.' })
    }

    const fetchDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: homeworkId },
    })
    const fetchResult = await fetchDb.query(`
      ${SELECT_HOMEWORK}
      WHERE h.id = @id;
    `)

    return json(200, { homework: sanitizeHomework(fetchResult.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('updateHomeworkHandler failed', error)
    return json(500, { error: 'Ödev güncellenemedi.' })
  }
}

// Ödevlerim listesinde "Atama yapılmadı" altında kalan (henüz Tasks satırı
// olmayan) ödevlere sonradan bir gün/saat/süre atamak veya var olan görevin
// zamanlamasını düzenlemek için kullanılır. createTaskForHomework'ten farklı
// olarak burada testIds bilgisi yok (ödev oluşturulduğunda seçilmemiş olabilir),
// bu yüzden selected_test_ids_json boş bırakılır; bu sadece takvime yerleştirme
// içindir, dijital cevap kağıdı testId eşlemesine dokunmaz.
async function assignHomeworkTaskHandler(request) {
  try {
    const homeworkId = request.params.homeworkId
    const payload = await request.json().catch(() => null)
    const { error, studentId } = await requireStudentWriteContext(request, { studentId: payload?.studentId })
    if (error) {
      return error
    }

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

    const hwDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: homeworkId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const hwResult = await hwDb.query(`
      SELECT h.id, h.resource_book_id, h.school_resource_id, rb.resource_type, s.name AS subject_name,
             h.title, h.total_question_count, h.completed_question_count, h.total_page_count, h.status
      FROM dbo.Homeworks h
      INNER JOIN dbo.Subjects s ON s.id = h.subject_id
      LEFT JOIN dbo.ResourceBooks rb ON rb.id = h.resource_book_id
      WHERE h.id = @id AND h.student_id = @studentId;
    `)
    const homework = hwResult.recordset[0]
    if (!homework) {
      return json(404, { error: 'Ödev bulunamadı.' })
    }

    const endTime = startTime ? computeEndTime(startTime, durationMinutes) : null

    const existingDb = await withRequest({
      homeworkId: { type: sql.UniqueIdentifier, value: homeworkId },
    })
    const existingResult = await existingDb.query(`
      SELECT TOP 1 id FROM dbo.Tasks WHERE homework_id = @homeworkId ORDER BY created_at DESC;
    `)
    const existingTaskId = existingResult.recordset[0]?.id

    if (existingTaskId) {
      const updateDb = await withRequest({
        id: { type: sql.UniqueIdentifier, value: existingTaskId },
        studentId: { type: sql.UniqueIdentifier, value: studentId },
        date: { type: sql.Date, value: date },
        startTime: { type: sql.Char(5), value: startTime || null },
        endTime: { type: sql.Char(5), value: endTime || null },
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
        taskType: { type: sql.NVarChar(40), value: homework.school_resource_id ? 'okul-odevi' : 'odev' },
        startTime: { type: sql.Char(5), value: startTime || null },
        endTime: { type: sql.Char(5), value: endTime || null },
        durationMinutes: { type: sql.Int, value: durationMinutes },
        targetQuestionCount: { type: sql.Int, value: homework.total_question_count || null },
        completedQuestionCount: { type: sql.Int, value: homework.completed_question_count || 0 },
        status: { type: sql.NVarChar(30), value: homework.status || 'bekliyor' },
        resourceBookId: { type: sql.UniqueIdentifier, value: homework.school_resource_id ? null : homework.resource_book_id || null },
        schoolResourceId: { type: sql.UniqueIdentifier, value: homework.school_resource_id || null },
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
          is_draft, resource_book_id, school_resource_id, target_page_count, completed_page_count, homework_id
        )
        VALUES (
          @studentId, @date, @title, @description, @subject, @taskType, @startTime, @endTime,
          @durationMinutes, @targetQuestionCount, @completedQuestionCount, @status,
          0, @resourceBookId, @schoolResourceId, @targetPageCount, 0, @homeworkId
        );
      `)
    }

    const fetchDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: homeworkId },
    })
    const fetchResult = await fetchDb.query(`
      ${SELECT_HOMEWORK}
      WHERE h.id = @id;
    `)

    return json(200, { homework: sanitizeHomework(fetchResult.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('assignHomeworkTaskHandler failed', error)
    return json(500, { error: 'Görev oluşturulamadı.' })
  }
}

async function deleteHomeworkHandler(request) {
  try {
    const homeworkId = request.params.homeworkId
    const { error, studentId } = await requireStudentWriteContext(request)
    if (error) {
      return error
    }

    // Ödev silindiğinde eşlik eden dbo.Tasks satırı FK_Tasks_Homeworks (ON DELETE SET NULL)
    // yüzünden otomatik silinmiyor, sadece homework_id NULL'a çekiliyor; bu da görevin öğrenci
    // panelinde ödev silinmiş olsa bile görünmeye devam etmesine yol açıyordu. Bu yüzden bağlı
    // görevi (ve ona referans veren yanlış soru/çalışma kaydı gibi satırları) burada elle temizliyoruz.
    const cleanupDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: homeworkId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    await cleanupDb.query(`
      DECLARE @taskId UNIQUEIDENTIFIER;
      SELECT @taskId = id FROM dbo.Tasks WHERE homework_id = @id AND student_id = @studentId;

      IF @taskId IS NOT NULL
      BEGIN
        UPDATE dbo.WrongQuestions SET task_id = NULL WHERE task_id = @taskId;
        UPDATE dbo.StudySessions SET task_id = NULL WHERE task_id = @taskId;
        UPDATE dbo.ParentMotivationMessages SET linked_task_id = NULL WHERE linked_task_id = @taskId;
        DELETE FROM dbo.Tasks WHERE id = @taskId;
      END
    `)

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: homeworkId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
    })
    const result = await requestDb.query(`
      DELETE FROM dbo.Homeworks WHERE id = @id AND student_id = @studentId;
    `)

    if (!result.rowsAffected[0]) {
      return json(404, { error: 'Ödev bulunamadı.' })
    }

    return json(200, { success: true })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('deleteHomeworkHandler failed', error)
    return json(500, { error: 'Ödev silinemedi.' })
  }
}

module.exports = {
  listHomeworksHandler,
  createHomeworkHandler,
  updateHomeworkHandler,
  assignHomeworkTaskHandler,
  deleteHomeworkHandler,
  SELECT_HOMEWORK,
  sanitizeHomework,
  getAssignedResourceBook,
  getAssignedSchoolResource,
  createTaskForHomework,
  isValidTime,
  computeEndTime,
}
