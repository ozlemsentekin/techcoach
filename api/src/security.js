const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const { getAuthConfig, getRuntimeConfig } = require('./config')

const TR_MOBILE_RULE = /^5\d{9}$/

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

// Kabul edilen girdiler: 5XXXXXXXXX, 05XXXXXXXXX, 905XXXXXXXXX, +905XXXXXXXXX.
// Geçersizse null döner. Depolama biçimi her zaman E.164 (+905XXXXXXXXX).
function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '')

  if (digits.startsWith('90') && digits.length === 12) {
    digits = digits.slice(2)
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1)
  }

  if (!TR_MOBILE_RULE.test(digits)) {
    return null
  }

  return `+90${digits}`
}

function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000))
}

function hashOtpCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex')
}

function verifyOtpCode(code, hash) {
  const candidate = hashOtpCode(code)
  const candidateBuffer = Buffer.from(candidate, 'hex')
  const hashBuffer = Buffer.from(String(hash || ''), 'hex')

  if (candidateBuffer.length !== hashBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(candidateBuffer, hashBuffer)
}

function createSessionToken(user, options = {}) {
  const { jwtSecret, tokenTtlSeconds } = getAuthConfig()

  const payload = {
    sub: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  }

  if (options.actingParentId) {
    payload.actingParentId = options.actingParentId
    payload.actingParentName = options.actingParentName
  }

  return jwt.sign(payload, jwtSecret, {
    expiresIn: tokenTtlSeconds,
    issuer: 'techcoach-api',
    audience: 'techcoach-web',
  })
}

function readSessionToken(request) {
  const { cookieName } = getRuntimeConfig()
  const cookieHeader = request.headers.get('cookie') || ''
  const cookies = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)

  const target = cookies.find((cookie) => cookie.startsWith(`${cookieName}=`))
  return target ? decodeURIComponent(target.slice(cookieName.length + 1)) : null
}

function verifySessionToken(token) {
  const { jwtSecret } = getAuthConfig()

  return jwt.verify(token, jwtSecret, {
    issuer: 'techcoach-api',
    audience: 'techcoach-web',
  })
}

// True for a rejected/expired/malformed JWT (jsonwebtoken's own error types) — i.e. an
// actually invalid session, as opposed to an unrelated failure (DB error, etc.) that
// happened to occur while handling an otherwise-valid session.
function isSessionError(error) {
  return error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError || error instanceof jwt.NotBeforeError
}

module.exports = {
  createSessionToken,
  generateOtpCode,
  hashOtpCode,
  isSessionError,
  normalizeEmail,
  normalizePhone,
  readSessionToken,
  verifyOtpCode,
  verifySessionToken,
}
