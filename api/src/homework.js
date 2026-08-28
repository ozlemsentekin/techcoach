const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { json } = require('./http')
const { isSessionError } = require('./security')
const { requireStudentContext, requireStudentWriteContext } = require('./studentScope')

// ── Ödev/Görev tekilleştirme (Faz 1) ──────────────────────────────────────────
// "Ödev" artık ayrı bir tablo değil, ders-tipi bir dbo.Tasks satırıdır.
//  - is_unscheduled = 1  → henüz bir güne/saate atanmamış ("Atama yapılmadı"); takvimde
//    görünmez, sadece "Ödevlerim"de. Bir güne atanınca is_unscheduled = 0 olur.
//  - Tasks.title genel kalıp ("{ders} Ödevi"), gerçek başlık Tasks.description'da.
// Bu modül eski /api/panel/homeworks* cevap şeklini koruyarak dbo.Tasks üzerinde çalışır.
const HOMEWORK_TASK_TYPES = ['odev', 'soru-bankasi-odevi', 'okul-odevi', 'etkinlik-odevi']
const HOMEWORK_TASK_TYPES_SQL = HOMEWORK_TASK_TYPES.map((type) => `'${type}'`).join(', ')

function toISODate(value) {
  if (!value) return null
  return value instanceof Date ? value.toISOString().slice(0, 10) : value
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

// Tasks.title genel kalıba ("{ders} Ödevi") denk geliyorsa asıl başlığı description'dan al.
function resolveHomeworkTitle(record, subject) {
  const genericTitle = subject ? `${subject} Ödevi` : null
  const isGeneric = genericTitle && record.title === genericTitle && record.description
  return {
    title: isGeneric ? record.description : record.title,
    description: isGeneric ? '' : record.description || '',
  }
}

function sanitizeHomework(record) {
  const subject = record.subject_name || record.task_subject || null
  const { title, description } = resolveHomeworkTitle(record, subject)
  const scheduled = !record.is_unscheduled

  return {
    id: record.id,
    studentId: record.student_id,
    subjectId: record.subject_id || null,
    subject,
    resourceBookId: record.resource_book_id || null,
    resourceBookName: record.resource_book_name || null,
    resourceType: record.resource_book_type || null,
    publisherName: record.publisher_name || null,
    schoolResourceId: record.school_resource_id || null,
    schoolResourceName: record.school_resource_name || null,
    schoolResourceImageUrl: record.school_resource_image_url || null,
    homeworkType: record.school_resource_id ? 'okul-odevi' : 'soru-bankasi-odevi',
    title,
    description,
    assignedDate: toISODate(record.assigned_date),
    dueDate: scheduled ? toISODate(record.date) : null,
    totalQuestionCount: record.total_question_count ?? 0,
    completedQuestionCount: record.completed_question_count ?? 0,
    totalPageCount: record.total_page_count ?? null,
    priority: record.priority,
    status: record.status,
    isSplit: false,
    dayPlans: [],
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    hasTask: scheduled,
    taskId: record.id,
    taskDate: scheduled ? toISODate(record.date) : null,
    taskStartTime: record.start_time || null,
    taskEndTime: record.end_time || null,
    taskDurationMinutes: record.duration_minutes ?? null,
  }
}

// Alias `h` = dbo.Tasks (eski dbo.Homeworks yerine). Ödev-tipi + taslak-olmayan filtre
// buraya gömülü; çağıranlar `AND h.<...>` ile devam eder.
const SELECT_HOMEWORK = `
  SELECT h.id, h.student_id, h.subject_id, s.name AS subject_name, h.subject AS task_subject,
         h.resource_book_id, rb.name AS resource_book_name, rb.resource_type AS resource_book_type,
         p.name AS publisher_name,
         h.school_resource_id, scr.name AS school_resource_name, scr.image_url AS school_resource_image_url,
         h.title, h.description, h.assigned_date, h.date, h.is_unscheduled,
         h.target_question_count AS total_question_count, h.completed_question_count,
         h.target_page_count AS total_page_count,
         h.start_time, h.end_time, h.duration_minutes,
         h.priority, h.status, h.created_at, h.updated_at
  FROM dbo.Tasks h
  LEFT JOIN dbo.Subjects s ON s.id = h.subject_id
  LEFT JOIN dbo.ResourceBooks rb ON rb.id = h.resource_book_id
  LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
  LEFT JOIN dbo.SchoolClassResources scr ON scr.id = h.school_resource_id
  WHERE h.task_type IN (${HOMEWORK_TASK_TYPES_SQL}) AND h.is_draft = 0
`

async function fetchHomeworkById(taskId) {
  const db = await withRequest({ id: { type: sql.UniqueIdentifier, value: taskId } })
  const result = await db.query(`${SELECT_HOMEWORK} AND h.id = @id;`)
  return result.recordset[0] ? sanitizeHomework(result.recordset[0]) : null
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

async function resolveSubjectName(subjectId) {
  const db = await withRequest({ subjectId: { type: sql.UniqueIdentifier, value: subjectId } })
  const result = await db.query(`SELECT TOP 1 name FROM dbo.Subjects WHERE id = @subjectId;`)
  return result.recordset[0]?.name || null
}

/**
 * Ödev = tek bir dbo.Tasks satırı. `taskDate` verilmezse "atanmamış" (is_unscheduled = 1)
 * olarak oluşturulur: takvimde görünmez, "Ödevlerim"de "Atama yapılmadı" grubunda durur.
 * Döner: eklenen görevin id'si.
 */
async function createHomeworkTask(
  studentId,
  {
    subjectId,
    subjectName,
    resourceBookId = null,
    schoolResourceId = null,
    resourceType = null,
    title,
    assignedDate = null,
    dueDate = null,
    totalQuestionCount = 0,
    totalPageCount = null,
    priority = 'orta',
    testIds = [],
    taskDate = null,
    taskTime = null,
    taskDurationMinutes = null,
    createdBy = 'ebeveyn',
  },
) {
  const resolvedSubjectName = subjectName || (subjectId ? await resolveSubjectName(subjectId) : null)
  const isSchoolHomework = Boolean(schoolResourceId)
  const scheduled = Boolean(taskDate)
  const date = taskDate || dueDate || assignedDate
  const durationMinutes =
    Number.isFinite(taskDurationMinutes) && taskDurationMinutes > 0
      ? taskDurationMinutes
      : Math.min(60, Math.max(20, totalQuestionCount || 20))
  const startTime = scheduled && isValidTime(taskTime) ? taskTime : null
  const endTime = startTime ? computeEndTime(startTime, durationMinutes) : null
  const sanitizedTestIds = Array.isArray(testIds) ? testIds.filter((id) => typeof id === 'string' && id) : []
  const taskType = isSchoolHomework ? 'okul-odevi' : resourceBookId ? 'soru-bankasi-odevi' : 'odev'
  const isReading = resourceType === 'okuma_kitabi'

  const requestDb = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    isUnscheduled: { type: sql.Bit, value: !scheduled },
    date: { type: sql.Date, value: date },
    assignedDate: { type: sql.Date, value: assignedDate || null },
    title: { type: sql.NVarChar(200), value: resolvedSubjectName ? `${resolvedSubjectName} Ödevi` : 'Ödev' },
    description: { type: sql.NVarChar(1000), value: title },
    subject: { type: sql.NVarChar(100), value: resolvedSubjectName || null },
    subjectId: { type: sql.UniqueIdentifier, value: subjectId || null },
    taskType: { type: sql.NVarChar(40), value: taskType },
    startTime: { type: sql.Char(5), value: startTime },
    endTime: { type: sql.Char(5), value: endTime },
    durationMinutes: { type: sql.Int, value: durationMinutes },
    targetQuestionCount: { type: sql.Int, value: totalQuestionCount || null },
    targetPageCount: { type: sql.Int, value: isReading ? totalPageCount || null : null },
    priority: { type: sql.NVarChar(20), value: priority || 'orta' },
    createdBy: { type: sql.NVarChar(20), value: createdBy },
    resourceBookId: { type: sql.UniqueIdentifier, value: isSchoolHomework ? null : resourceBookId || null },
    schoolResourceId: { type: sql.UniqueIdentifier, value: schoolResourceId || null },
    selectedTestIdsJson: {
      type: sql.NVarChar(sql.MAX),
      value: sanitizedTestIds.length ? JSON.stringify(sanitizedTestIds) : null,
    },
  })

  const result = await requestDb.query(`
    INSERT INTO dbo.Tasks (
      student_id, is_draft, is_unscheduled, date, assigned_date, title, description, subject, subject_id,
      task_type, start_time, end_time, duration_minutes, target_question_count, completed_question_count,
      target_page_count, completed_page_count, priority, status, created_by,
      resource_book_id, school_resource_id, selected_test_ids_json
    )
    OUTPUT inserted.id
    VALUES (
      @studentId, 0, @isUnscheduled, @date, @assignedDate, @title, @description, @subject, @subjectId,
      @taskType, @startTime, @endTime, @durationMinutes, @targetQuestionCount, 0,
      @targetPageCount, 0, @priority, N'bekliyor', @createdBy,
      @resourceBookId, @schoolResourceId, @selectedTestIdsJson
    );
  `)

  return result.recordset[0].id
}

// Aynı kaynak/okul-kaynağı + aynı açıklama + aynı gün için zaten bir ödev-görevi var mı?
async function checkDuplicateHomework({ studentId, subjectId, resourceBookId, schoolResourceId, description, dueDate }) {
  const db = await withRequest({
    studentId: { type: sql.UniqueIdentifier, value: studentId },
    subjectId: { type: sql.UniqueIdentifier, value: subjectId },
    resourceBookId: { type: sql.UniqueIdentifier, value: resourceBookId || null },
    schoolResourceId: { type: sql.UniqueIdentifier, value: schoolResourceId || null },
    description: { type: sql.NVarChar(1000), value: description || null },
    dueDate: { type: sql.Date, value: dueDate },
  })
  const result = await db.query(`
    SELECT TOP 1 h.id
    FROM dbo.Tasks h
    WHERE h.student_id = @studentId AND h.subject_id = @subjectId
      AND h.task_type IN (${HOMEWORK_TASK_TYPES_SQL}) AND h.is_draft = 0
      AND ISNULL(h.description, '') = ISNULL(@description, '')
      AND h.date = @dueDate
      AND (
        (@schoolResourceId IS NOT NULL AND h.school_resource_id = @schoolResourceId)
        OR (@resourceBookId IS NOT NULL AND h.resource_book_id = @resourceBookId)
      );
  `)
  return result.recordset.length > 0
}

// Bir ödev-görevini siler; ona referans veren yanlış soru / çalışma seansı / motivasyon
// mesajı satırlarını da temizler (FK ihlali olmasın diye).
async function deleteHomeworkTask(taskId, studentId) {
  const db = await withRequest({
    id: { type: sql.UniqueIdentifier, value: taskId },
    studentId: { type: sql.UniqueIdentifier, value: studentId },
  })
  const result = await db.query(`
    DECLARE @exists BIT = 0;
    IF EXISTS (
      SELECT 1 FROM dbo.Tasks
      WHERE id = @id AND student_id = @studentId
        AND task_type IN (${HOMEWORK_TASK_TYPES_SQL}) AND is_draft = 0
    )
    BEGIN
      SET @exists = 1;
      UPDATE dbo.WrongQuestions SET task_id = NULL WHERE task_id = @id;
      UPDATE dbo.StudySessions SET task_id = NULL WHERE task_id = @id;
      UPDATE dbo.ParentMotivationMessages SET linked_task_id = NULL WHERE linked_task_id = @id;
      DELETE FROM dbo.Tasks WHERE id = @id AND student_id = @studentId;
    END
    SELECT @exists AS affected;
  `)
  return Boolean(result.recordset[0]?.affected)
}

async function listHomeworksHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({ studentId: { type: sql.UniqueIdentifier, value: studentId } })
    const result = await requestDb.query(`
      ${SELECT_HOMEWORK}
        AND h.student_id = @studentId
      ORDER BY h.date ASC;
    `)

    const homeworks = result.recordset
      .map(sanitizeHomework)
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))

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
    const { error, studentId, actorRole } = await requireStudentWriteContext(request, { studentId: payload?.studentId })
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

    let resourceType = null
    if (isSchoolHomework) {
      const schoolResource = await getAssignedSchoolResource(studentId, subjectId, schoolResourceId)
      if (!schoolResource) {
        return json(400, { error: 'Seçilen okul kaynağı bu öğrencinin okulu/sınıfı için tanımlı değil.' })
      }
    } else {
      const assignedResource = await getAssignedResourceBook(studentId, subjectId, resourceBookId)
      if (!assignedResource) {
        return json(400, { error: 'Seçilen kaynak bu öğrenciye bu ders için atanmamış.' })
      }
      resourceType = assignedResource.resourceType
    }

    if (isSchoolHomework || resourceType !== 'okuma_kitabi') {
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
      resourceType,
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
      createdBy: actorRole === 'ogrenci' ? 'ogrenci' : 'ebeveyn',
    })

    return json(201, { homework: await fetchHomeworkById(homeworkId) })
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
      bindings.status = { type: sql.NVarChar(30), value: payload.status }
    }
    if (payload?.title !== undefined) {
      // Gerçek ödev başlığı Tasks.description'da (Tasks.title genel kalıp).
      updates.push('description = @description')
      bindings.description = { type: sql.NVarChar(1000), value: payload.title.trim() }
    }
    if (payload?.dueDate !== undefined) {
      updates.push('date = @dueDate')
      bindings.dueDate = { type: sql.Date, value: payload.dueDate }
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
      if (!payload?.subjectId || !payload?.schoolResourceId) {
        return json(400, { error: 'Ders ve okul kaynağı birlikte gönderilmeli.' })
      }
      const schoolResource = await getAssignedSchoolResource(studentId, payload.subjectId, payload.schoolResourceId)
      if (!schoolResource) {
        return json(400, { error: 'Seçilen okul kaynağı bu öğrencinin okulu/sınıfı için tanımlı değil.' })
      }
      updates.push(
        'subject_id = @subjectId',
        'school_resource_id = @schoolResourceId',
        'resource_book_id = NULL',
        "task_type = 'okul-odevi'",
      )
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
      updates.push(
        'subject_id = @subjectId',
        'resource_book_id = @resourceBookId',
        'school_resource_id = NULL',
        "task_type = 'soru-bankasi-odevi'",
      )
      bindings.subjectId = { type: sql.UniqueIdentifier, value: payload.subjectId }
      bindings.resourceBookId = { type: sql.UniqueIdentifier, value: payload.resourceBookId }
    }

    if (updates.length === 0) {
      return json(400, { error: 'Güncellenecek alan bulunamadı.' })
    }

    const requestDb = await withRequest(bindings)
    const result = await requestDb.query(`
      UPDATE dbo.Tasks
      SET ${updates.join(', ')}
      WHERE id = @id AND student_id = @studentId
        AND task_type IN (${HOMEWORK_TASK_TYPES_SQL}) AND is_draft = 0;
    `)

    if (!result.rowsAffected[0]) {
      return json(404, { error: 'Ödev bulunamadı.' })
    }

    return json(200, { homework: await fetchHomeworkById(homeworkId) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('updateHomeworkHandler failed', error)
    return json(500, { error: 'Ödev güncellenemedi.' })
  }
}

// "Atama yapılmadı" bir ödeve gün/saat/süre atar ya da var olan planı düzenler.
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

    const endTime = startTime ? computeEndTime(startTime, durationMinutes) : null

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: homeworkId },
      studentId: { type: sql.UniqueIdentifier, value: studentId },
      date: { type: sql.Date, value: date },
      startTime: { type: sql.Char(5), value: startTime || null },
      endTime: { type: sql.Char(5), value: endTime || null },
      durationMinutes: { type: sql.Int, value: durationMinutes },
    })
    const result = await requestDb.query(`
      UPDATE dbo.Tasks
      SET date = @date, start_time = @startTime, end_time = @endTime, duration_minutes = @durationMinutes,
          is_unscheduled = 0
      WHERE id = @id AND student_id = @studentId
        AND task_type IN (${HOMEWORK_TASK_TYPES_SQL}) AND is_draft = 0;
    `)

    if (!result.rowsAffected[0]) {
      return json(404, { error: 'Ödev bulunamadı.' })
    }

    return json(200, { homework: await fetchHomeworkById(homeworkId) })
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

    const deleted = await deleteHomeworkTask(homeworkId, studentId)
    if (!deleted) {
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
  HOMEWORK_TASK_TYPES,
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
}
