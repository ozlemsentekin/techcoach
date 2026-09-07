const { sql, withRequest } = require('./db')
const { readSessionToken, verifySessionToken, isSessionError } = require('./security')
const { requiresPasswordChange } = require('./passwordPolicy')
const { json } = require('./http')

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// Kullanıcının "son işlem" (last_seen_at) zamanını günceller. Her yazma isteğinde
// çağrılır ama DB'yi (Basic tier) yormamak için kullanıcı başına 10 dakikada bir
// yazar (WHERE koşulu). Impersonate durumunda gerçek kişiye (veli/admin) yazılır.
// Hata bastırılır — asıl isteğin akışını hiçbir şekilde etkilemez.
async function touchLastSeen(session) {
  try {
    const userId = session.actingAdminId || session.actingParentId || session.sub
    if (!userId) return
    const db = await withRequest({ id: { type: sql.UniqueIdentifier, value: userId } })
    await db.query(`
      UPDATE dbo.Users
      SET last_seen_at = SYSUTCDATETIME()
      WHERE id = @id
        AND (last_seen_at IS NULL OR last_seen_at < DATEADD(MINUTE, -10, SYSUTCDATETIME()));
    `)
  } catch {
    // yut
  }
}

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
        if (session && MUTATING_METHODS.has((request.method || '').toUpperCase())) {
          await touchLastSeen(session)
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
