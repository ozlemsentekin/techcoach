const { sql, withRequest } = require('./db')
const { clearSessionHeaders, createSessionHeaders, getClientIp, json } = require('./http')
const { consumeRateLimit } = require('./rate-limit')
const {
  createSessionToken,
  hashPassword,
  normalizeEmail,
  readSessionToken,
  validateLoginInput,
  validateRegistrationInput,
  verifyPassword,
  verifySessionToken,
} = require('./security')

function sanitizeUser(record) {
  return {
    id: record.id,
    fullName: record.full_name,
    email: record.email,
    lastLoginAt: record.last_login_at,
    createdAt: record.created_at,
  }
}

async function registerHandler(request) {
  const payload = await request.json().catch(() => null)

  if (!payload) {
    return json(400, { error: 'Geçersiz istek gövdesi.' })
  }

  const validationError = validateRegistrationInput(payload)
  if (validationError) {
    return json(400, { error: validationError })
  }

  const email = normalizeEmail(payload.email)
  const ip = getClientIp(request)

  if (!consumeRateLimit(`register:${ip}`)) {
    return json(429, { error: 'Çok fazla kayıt denemesi yapıldı. Lütfen daha sonra tekrar deneyin.' })
  }

  const passwordHash = await hashPassword(payload.password)
  const now = new Date()

  try {
    const requestDb = await withRequest({
      fullName: { type: sql.NVarChar(120), value: payload.fullName.trim() },
      email: { type: sql.NVarChar(320), value: email },
      passwordHash: { type: sql.NVarChar(255), value: passwordHash },
      consentAt: { type: sql.DateTime2, value: now },
    })

    const result = await requestDb.query(`
      INSERT INTO dbo.Users (full_name, email, password_hash, aydinlatma_accepted_at, kvkk_accepted_at)
      OUTPUT inserted.id, inserted.full_name, inserted.email, inserted.last_login_at, inserted.created_at
      VALUES (@fullName, @email, @passwordHash, @consentAt, @consentAt);
    `)

    const user = sanitizeUser(result.recordset[0])
    const token = createSessionToken(user)

    return json(201, { user }, createSessionHeaders(token))
  } catch (error) {
    if (error.number === 2601 || error.number === 2627) {
      return json(409, { error: 'Bu e-posta adresi ile daha önce kayıt oluşturulmuş.' })
    }

    console.error('registerHandler failed', error)
    return json(500, { error: 'Kayıt işlemi sırasında beklenmeyen bir hata oluştu.' })
  }
}

async function loginHandler(request) {
  const payload = await request.json().catch(() => null)

  if (!payload) {
    return json(400, { error: 'Geçersiz istek gövdesi.' })
  }

  const validationError = validateLoginInput(payload)
  if (validationError) {
    return json(400, { error: validationError })
  }

  const email = normalizeEmail(payload.email)
  const ip = getClientIp(request)

  if (!consumeRateLimit(`login:${ip}:${email}`)) {
    return json(429, { error: 'Çok fazla giriş denemesi yapıldı. Lütfen 15 dakika sonra tekrar deneyin.' })
  }

  try {
    const requestDb = await withRequest({
      email: { type: sql.NVarChar(320), value: email },
    })

    const result = await requestDb.query(`
      SELECT TOP 1
        id,
        full_name,
        email,
        password_hash,
        failed_login_count,
        lockout_until,
        last_login_at,
        created_at
      FROM dbo.Users
      WHERE email = @email;
    `)

    const record = result.recordset[0]
    if (!record) {
      return json(401, { error: 'E-posta veya şifre hatalı.' })
    }

    if (record.lockout_until && new Date(record.lockout_until) > new Date()) {
      return json(423, { error: 'Hesap geçici olarak kilitlendi. Lütfen daha sonra tekrar deneyin.' })
    }

    const isPasswordValid = await verifyPassword(payload.password, record.password_hash)
    if (!isPasswordValid) {
      const failedCount = record.failed_login_count + 1
      const lockoutUntil = failedCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null
      const failedRequest = await withRequest({
        id: { type: sql.UniqueIdentifier, value: record.id },
        failedLoginCount: { type: sql.Int, value: failedCount >= 5 ? 5 : failedCount },
        lockoutUntil: { type: sql.DateTime2, value: lockoutUntil },
      })

      await failedRequest.query(`
        UPDATE dbo.Users
        SET failed_login_count = @failedLoginCount,
            lockout_until = @lockoutUntil
        WHERE id = @id;
      `)

      return json(401, { error: 'E-posta veya şifre hatalı.' })
    }

    const successRequest = await withRequest({
      id: { type: sql.UniqueIdentifier, value: record.id },
    })

    await successRequest.query(`
      UPDATE dbo.Users
      SET failed_login_count = 0,
          lockout_until = NULL,
          last_login_at = SYSUTCDATETIME()
      WHERE id = @id;
    `)

    const user = sanitizeUser({
      ...record,
      last_login_at: new Date().toISOString(),
    })
    const token = createSessionToken(user)

    return json(200, { user }, createSessionHeaders(token))
  } catch (error) {
    console.error('loginHandler failed', error)
    return json(500, { error: 'Giriş sırasında beklenmeyen bir hata oluştu.' })
  }
}

async function meHandler(request) {
  try {
    const token = readSessionToken(request)
    if (!token) {
      return json(401, { error: 'Oturum bulunamadı.' })
    }

    const session = verifySessionToken(token)
    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: session.sub },
    })
    const result = await requestDb.query(`
      SELECT TOP 1 id, full_name, email, last_login_at, created_at
      FROM dbo.Users
      WHERE id = @id;
    `)
    const record = result.recordset[0]

    if (!record) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    return json(200, { user: sanitizeUser(record) })
  } catch {
    return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
  }
}

async function logoutHandler() {
  return json(200, { ok: true }, clearSessionHeaders())
}

module.exports = {
  loginHandler,
  logoutHandler,
  meHandler,
  registerHandler,
}
