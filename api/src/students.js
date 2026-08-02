const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { clearSessionHeaders, createSessionHeaders, json } = require('./http')
const {
  createSessionToken,
  hashPassword,
  isSessionError,
  normalizeEmail,
  readSessionToken,
  validateRegistrationInput,
  verifySessionToken,
} = require('./security')
const { sanitizeUser } = require('./auth')

function sanitizeStudent(record) {
  return {
    id: record.id,
    fullName: record.full_name,
    email: record.email,
    role: record.role,
    createdAt: record.created_at,
    resourceCount: Number(record.resource_count) || 0,
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
             COUNT(rb.id) AS resource_count
      FROM dbo.Users u
      LEFT JOIN dbo.StudentResourceBooks srb ON srb.student_id = u.id
      LEFT JOIN dbo.ResourceBooks rb ON rb.id = srb.resource_book_id AND rb.is_active = 1
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

    const acceptConsent = payload.acceptConsent === true
    const validationError = validateRegistrationInput({
      ...payload,
      acceptAydinlatma: acceptConsent,
      acceptKvkk: acceptConsent,
    })
    if (validationError) {
      return json(400, { error: validationError })
    }

    const email = normalizeEmail(payload.email)
    const passwordHash = await hashPassword(payload.password)
    const now = new Date()

    const requestDb = await withRequest({
      fullName: { type: sql.NVarChar(120), value: payload.fullName.trim() },
      email: { type: sql.NVarChar(320), value: email },
      passwordHash: { type: sql.NVarChar(255), value: passwordHash },
      role: { type: sql.NVarChar(20), value: 'ogrenci' },
      parentId: { type: sql.UniqueIdentifier, value: parentId },
      consentAt: { type: sql.DateTime2, value: now },
    })

    const result = await requestDb.query(`
      INSERT INTO dbo.Users (full_name, email, password_hash, role, parent_id, aydinlatma_accepted_at, kvkk_accepted_at)
      OUTPUT inserted.id, inserted.full_name, inserted.email, inserted.role, inserted.created_at, 0 AS resource_count
      VALUES (@fullName, @email, @passwordHash, @role, @parentId, @consentAt, @consentAt);
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

module.exports = {
  listStudentsHandler,
  createStudentHandler,
  enterStudentHandler,
  exitStudentHandler,
  listStudentResourceBooksHandler,
  updateStudentResourceBooksHandler,
}
