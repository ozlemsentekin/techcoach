const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { clearSessionHeaders, json } = require('./http')
const {
  defaultPasswordForPhone,
  hashPassword,
  isSessionError,
  normalizeEmail,
  normalizePhone,
  readSessionToken,
  verifySessionToken,
} = require('./security')

async function requireAdmin(request) {
  const token = readSessionToken(request)
  if (!token) {
    return { error: json(401, { error: 'Oturum bulunamadı.' }) }
  }

  const session = verifySessionToken(token)
  const requestDb = await withRequest({
    id: { type: sql.UniqueIdentifier, value: session.sub },
  })
  const result = await requestDb.query(`
    SELECT TOP 1 is_admin FROM dbo.Users WHERE id = @id;
  `)
  const record = result.recordset[0]

  if (!record) {
    return { error: json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders()) }
  }

  if (!record.is_admin) {
    return { error: json(403, { error: 'Bu alana erişim yetkiniz yok.' }) }
  }

  return { session }
}

function sanitizeUser(record) {
  return {
    id: record.id,
    fullName: record.full_name,
    email: record.email,
    phone: record.phone_number,
    role: record.role,
    isAdmin: Boolean(record.is_admin),
    parentId: record.parent_id,
    parentName: record.parent_full_name,
    lastLoginAt: record.last_login_at,
    createdAt: record.created_at,
  }
}

async function listUsersHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({})
    const result = await requestDb.query(`
      SELECT u.id, u.full_name, u.email, u.phone_number, u.role, u.is_admin, u.parent_id,
             p.full_name AS parent_full_name, u.last_login_at, u.created_at
      FROM dbo.Users u
      LEFT JOIN dbo.Users p ON p.id = u.parent_id
      ORDER BY u.created_at ASC;
    `)

    return json(200, { users: result.recordset.map(sanitizeUser) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('listUsersHandler failed', error)
    return json(500, { error: 'Kullanıcılar yüklenemedi.' })
  }
}

async function updateUserHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const userId = request.params.userId
    const payload = await request.json().catch(() => null)
    const fullName = payload?.fullName?.trim()
    const isAdmin = payload?.isAdmin

    if (!fullName || fullName.length < 2) {
      return json(400, { error: 'Ad soyad en az 2 karakter olmalı.' })
    }
    if (typeof isAdmin !== 'boolean') {
      return json(400, { error: 'Admin bilgisi geçersiz.' })
    }

    let email = null
    if (payload?.email && payload.email.trim()) {
      email = normalizeEmail(payload.email)
    }

    let phone = null
    if (payload?.phone && payload.phone.trim()) {
      phone = normalizePhone(payload.phone)
      if (!phone) {
        return json(400, { error: 'Telefon numarası geçersiz.' })
      }
    }

    if (!email && !phone) {
      return json(400, { error: 'E-posta veya telefon numarasından en az biri girilmeli.' })
    }

    // Telefon numarası (yeniden) girildiğinde, kullanıcının bağımsız giriş şifresini
    // de (telefonun son 6 hanesi) günceller.
    const passwordHash = phone ? await hashPassword(defaultPasswordForPhone(phone)) : null

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: userId },
      fullName: { type: sql.NVarChar(120), value: fullName },
      email: { type: sql.NVarChar(320), value: email },
      phone: { type: sql.NVarChar(20), value: phone },
      passwordHash: { type: sql.NVarChar(255), value: passwordHash },
      isAdmin: { type: sql.Bit, value: isAdmin },
    })

    const result = await requestDb.query(`
      UPDATE dbo.Users
      SET full_name = @fullName, email = @email, phone_number = @phone, is_admin = @isAdmin,
          password_hash = CASE WHEN @phone IS NOT NULL THEN @passwordHash ELSE password_hash END
      WHERE id = @id;

      SELECT u.id, u.full_name, u.email, u.phone_number, u.role, u.is_admin, u.parent_id,
             p.full_name AS parent_full_name, u.last_login_at, u.created_at
      FROM dbo.Users u
      LEFT JOIN dbo.Users p ON p.id = u.parent_id
      WHERE u.id = @id;
    `)

    const updated = result.recordset[0]
    if (!updated) {
      return json(404, { error: 'Kullanıcı bulunamadı.' })
    }

    if (updated.role === 'ogrenci') {
      const profileDb = await withRequest({
        studentId: { type: sql.UniqueIdentifier, value: userId },
        phone: { type: sql.NVarChar(30), value: phone },
      })
      await profileDb.query(`
        MERGE dbo.StudentProfiles AS target
        USING (SELECT @studentId AS student_id) AS src
        ON target.student_id = src.student_id
        WHEN MATCHED THEN UPDATE SET phone = @phone
        WHEN NOT MATCHED THEN INSERT (student_id, phone) VALUES (@studentId, @phone);
      `)
    }

    return json(200, { user: sanitizeUser(updated) })
  } catch (error) {
    if (error.number === 2601 || error.number === 2627) {
      return json(409, { error: 'Bu e-posta veya telefon numarası başka bir kullanıcı tarafından kullanılıyor.' })
    }

    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('updateUserHandler failed', error)
    return json(500, { error: 'Kullanıcı güncellenemedi.' })
  }
}

module.exports = {
  listUsersHandler,
  requireAdmin,
  updateUserHandler,
}
