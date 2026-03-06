const { config } = require('./config')

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
  const parts = [
    `${config.cookieName}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
  ]

  if (config.cookieSecure) {
    parts.push('Secure')
  }

  return parts.join('; ')
}

function createSessionHeaders(token) {
  return {
    'Set-Cookie': serializeSessionCookie(token, config.tokenTtlSeconds),
  }
}

function clearSessionHeaders() {
  return {
    'Set-Cookie': serializeSessionCookie('', 0),
  }
}

module.exports = {
  clearSessionHeaders,
  createSessionHeaders,
  getClientIp,
  json,
}
