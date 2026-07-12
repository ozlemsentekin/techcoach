const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { clearSessionHeaders, json } = require('./http')
const { readSessionToken, verifySessionToken } = require('./security')

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

async function listUsersHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const requestDb = await withRequest({})
    const result = await requestDb.query(`
      SELECT u.id, u.full_name, u.email, u.role, u.is_admin, u.parent_id,
             p.full_name AS parent_full_name, u.last_login_at, u.created_at
      FROM dbo.Users u
      LEFT JOIN dbo.Users p ON p.id = u.parent_id
      ORDER BY u.created_at ASC;
    `)

    const users = result.recordset.map((record) => ({
      id: record.id,
      fullName: record.full_name,
      email: record.email,
      role: record.role,
      isAdmin: Boolean(record.is_admin),
      parentId: record.parent_id,
      parentName: record.parent_full_name,
      lastLoginAt: record.last_login_at,
      createdAt: record.created_at,
    }))

    return json(200, { users })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }

    console.error('listUsersHandler failed', error)
    return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
  }
}

module.exports = {
  listUsersHandler,
}
