const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { clearSessionHeaders, json } = require('./http')
const { isSessionError, readSessionToken, verifySessionToken } = require('./security')

function sanitizeUser(record) {
  return {
    id: record.id,
    fullName: record.full_name,
    email: record.email,
    phone: record.phone_number,
    role: record.role,
    isAdmin: Boolean(record.is_admin),
    lastLoginAt: record.last_login_at,
    createdAt: record.created_at,
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
      SELECT TOP 1
        u.id, u.full_name, u.email, u.phone_number, u.role, u.is_admin, u.last_login_at, u.created_at,
        e.status AS entitlement_status, e.source AS entitlement_source,
        e.current_period_end AS entitlement_current_period_end
      FROM dbo.Users u
      LEFT JOIN dbo.Entitlements e ON e.parent_id = COALESCE(u.parent_id, u.id)
      WHERE u.id = @id;
    `)
    const record = result.recordset[0]

    if (!record) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    const user = sanitizeUser(record)
    if (session.actingParentId) {
      user.actingParent = { id: session.actingParentId, fullName: session.actingParentName }
    }
    user.entitlement = {
      status: record.entitlement_status || 'none',
      source: record.entitlement_source || null,
      currentPeriodEnd: record.entitlement_current_period_end || null,
    }

    return json(200, { user })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    console.error('meHandler failed', error)
    return json(500, { error: 'Kullanıcı bilgileri alınamadı.' })
  }
}

async function logoutHandler() {
  return json(200, { ok: true }, clearSessionHeaders())
}

module.exports = {
  logoutHandler,
  meHandler,
  sanitizeUser,
}
