const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { clearSessionHeaders, createSessionHeaders, json } = require('./http')
const {
  createSessionToken,
  hashPassword,
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
      SELECT id, full_name, email, role, last_login_at, created_at
      FROM dbo.Users
      WHERE parent_id = @parentId
      ORDER BY created_at ASC;
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

    console.error('listStudentsHandler failed', error)
    return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
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
      OUTPUT inserted.id, inserted.full_name, inserted.email, inserted.role, inserted.created_at
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
      SELECT TOP 1 id, full_name, email, role, last_login_at, created_at
      FROM dbo.Users
      WHERE id = @studentId AND parent_id = @parentId;
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

    const user = { ...student, actingParent: { id: parentId, fullName: parentFullName } }
    return json(200, { user }, createSessionHeaders(token))
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('enterStudentHandler failed', error)
    return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
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
      SELECT TOP 1 id, full_name, email, role, is_admin, last_login_at, created_at
      FROM dbo.Users WHERE id = @id;
    `)
    const record = result.recordset[0]
    if (!record || record.role !== 'ebeveyn') {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    const user = sanitizeUser(record)
    const newToken = createSessionToken(user)
    return json(200, { user }, createSessionHeaders(newToken))
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('exitStudentHandler failed', error)
    return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
  }
}

module.exports = {
  listStudentsHandler,
  createStudentHandler,
  enterStudentHandler,
  exitStudentHandler,
}
