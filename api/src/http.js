const { getRuntimeConfig } = require('./config')

function json(status, body, extraHeaders = {}) {
  return {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
    jsonBody: body,
  }
}

function getClientIp(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-client-ip') ||
    'unknown'
  )
}

function serializeSessionCookie(token, maxAgeSeconds) {
  const { cookieName, cookieSecure } = getRuntimeConfig()
  const parts = [
    `${cookieName}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
  ]

  if (cookieSecure) {
    parts.push('Secure')
  }

  return parts.join('; ')
}

function createSessionHeaders(token) {
  const { tokenTtlSeconds } = getRuntimeConfig()
  return {
    'Set-Cookie': serializeSessionCookie(token, tokenTtlSeconds),
  }
}

function clearSessionHeaders() {
  return {
    'Set-Cookie': serializeSessionCookie('', 0),
  }
}

// Admin panelinden pasife alınmış (is_active = 0) bir kullanıcının açık oturumuyla
// yaptığı isteklere verilen ortak yanıt. code: 'ACCOUNT_DISABLED' istemcide global
// olarak yakalanıp oturumu kapatır; Set-Cookie ile çerez de hemen temizlenir.
function accountDisabledResponse() {
  return json(
    403,
    {
      error: 'Hesabınız pasife alınmış. Erişim için site yöneticisiyle iletişime geçin.',
      code: 'ACCOUNT_DISABLED',
    },
    clearSessionHeaders(),
  )
}

module.exports = {
  accountDisabledResponse,
  clearSessionHeaders,
  createSessionHeaders,
  getClientIp,
  json,
}
