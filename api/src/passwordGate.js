const { sql, withRequest } = require('./db')
const { readSessionToken, verifySessionToken, isSessionError } = require('./security')
const { requiresPasswordChange } = require('./passwordPolicy')
const { json } = require('./http')

function withPasswordGate(route, handler) {
  // Login/session recovery, consent, sign-out and payment callbacks stay available.
  if (/^(auth\/|payments\/|billing\/|health(?:\/|$))/.test(route)) return handler
  return async (request, context) => {
    try {
      const token = readSessionToken(request)
      if (token) {
        let session
        try { session = verifySessionToken(token) } catch (error) { if (!isSessionError(error)) throw error }
        // Delegated student/admin views do not change the viewed user's password.
        if (session && !session.actingParentId && !session.actingAdminId) {
          // Modern token'lar durumu claim olarak taşır (DB'ye gerek yok). Claim yoksa
          // (bu özellikten önce üretilmiş token) hash'ten canlı kontrol ederiz.
          let mustChange = session.mustChangePassword
          if (mustChange === undefined) {
            const db = await withRequest({ id: { type: sql.UniqueIdentifier, value: session.sub } })
            const result = await db.query('SELECT TOP 1 phone_number, password_hash FROM dbo.Users WHERE id = @id;')
            mustChange = await requiresPasswordChange(result.recordset[0])
          }
          if (mustChange) {
            return json(403, { code: 'PASSWORD_CHANGE_REQUIRED', error: 'Devam etmek için başlangıç şifrenizi değiştirin.' })
          }
        }
      }
    } catch (error) {
      context.error('Password gate failed', error)
      return json(503, { error: 'Hesap güvenliği kontrol edilemedi. Lütfen tekrar deneyin.' })
    }
    return handler(request, context)
  }
}
module.exports = { withPasswordGate }
