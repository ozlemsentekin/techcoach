const { sql, withRequest } = require('./db')
const { json, clearSessionHeaders } = require('./http')
const { readSessionToken, verifySessionToken, isSessionError } = require('./security')
const { requireStudentContext } = require('./studentScope')

// "Okul Ödevleri" menüsü: task_type = 'okul-odevi' görevlerin ders bazlı listesi.
// Menü yalnızca en az bir okul ödevi görevi olan öğrencide / çocuğu olan velide görünür
// (?access=1 → { enabled, studentIds }).

function toISODate(value) {
  if (!value) return null
  return value instanceof Date ? value.toISOString().slice(0, 10) : value
}

// Ödev akışından eklenen okul ödevlerinde Tasks.title genel kalıptır ("{ders} Ödevi"), asıl
// metin description'dadır (bkz. homework.js resolveHomeworkTitle).
function resolveTitle(row) {
  const genericTitle = row.subject_name ? `${row.subject_name} Ödevi` : null
  const isGeneric = row.description && (row.title === genericTitle || row.title === 'Ödev')
  return {
    title: isGeneric ? row.description : row.title,
    description: isGeneric ? '' : row.description || '',
  }
}

function sanitizeSchoolHomework(row) {
  const { title, description } = resolveTitle(row)
  return {
    id: row.id,
    subjectName: row.subject_name || 'Diğer',
    title,
    description,
    resourceName: row.school_resource_name || row.resource_book_name || null,
    publisherName: row.school_resource_name ? null : row.publisher_name || null,
    assignedDate: toISODate(row.assigned_date) || toISODate(row.created_at),
    dueDate: row.is_unscheduled ? null : toISODate(row.date),
    completedAt: row.completed_at || null,
    status: row.status,
    createdAt: row.created_at,
  }
}

async function accessResponse(request, studentId) {
  const session = verifySessionToken(readSessionToken(request))
  const ownerId = session.role === 'ebeveyn' ? session.sub : studentId
  const db = await withRequest({ id: { type: sql.UniqueIdentifier, value: ownerId } })
  const result = await db.query(`
    SELECT DISTINCT t.student_id
    FROM dbo.Tasks t
    INNER JOIN dbo.Users u ON u.id = t.student_id
    WHERE (u.id = @id OR u.parent_id = @id)
      AND t.task_type = N'okul-odevi' AND t.is_draft = 0;
  `)
  const studentIds = result.recordset.map((row) => row.student_id)
  return json(200, { enabled: studentIds.length > 0, studentIds })
}

async function listSchoolHomeworksHandler(request) {
  try {
    const { error, studentId } = await requireStudentContext(request)
    if (error) return error

    if (request.query.get('access') === '1') return await accessResponse(request, studentId)

    const db = await withRequest({ studentId: { type: sql.UniqueIdentifier, value: studentId } })
    const result = await db.query(`
      SELECT t.id, t.title, t.description, t.status, t.date, t.is_unscheduled,
             t.assigned_date, t.created_at, t.completed_at,
             COALESCE(s.name, t.subject) AS subject_name,
             scr.name AS school_resource_name, rb.name AS resource_book_name, p.name AS publisher_name
      FROM dbo.Tasks t
      LEFT JOIN dbo.Subjects s ON s.id = t.subject_id
      LEFT JOIN dbo.SchoolClassResources scr ON scr.id = t.school_resource_id
      LEFT JOIN dbo.ResourceBooks rb ON rb.id = t.resource_book_id
      LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
      WHERE t.student_id = @studentId AND t.task_type = N'okul-odevi' AND t.is_draft = 0
      ORDER BY COALESCE(t.assigned_date, CAST(t.created_at AS DATE)) DESC, t.created_at DESC;
    `)
    return json(200, { items: result.recordset.map(sanitizeSchoolHomework) })
  } catch (error) {
    if (isSessionError(error)) return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    console.error('listSchoolHomeworksHandler failed', error)
    return json(500, { error: 'Okul ödevleri yüklenemedi.' })
  }
}

module.exports = { listSchoolHomeworksHandler, sanitizeSchoolHomework }
