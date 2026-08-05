const crypto = require('crypto')
const bcrypt = require('bcryptjs')
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

// Netgsm hesabı kurulana kadar geçici olarak: her kullanıcının şifresi telefon
// numarasının son 6 hanesidir (kayıt anında otomatik atanır). Netgsm bağlandığında
// gerçek SMS/OTP akışına dönülebilir; bu yardımcı yalnızca varsayılan şifreyi türetir,
// kullanıcı isterse şifresini daha sonra değiştirebilir.
function defaultPasswordForPhone(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-6)
}

// bcryptjs is a pure-JS implementation with no libuv thread-pool offload, so
// hashing/comparing blocks the Node.js event loop for the full duration —
// cost 12 runs ~4x longer than cost 10 and directly hurts login throughput
// under concurrent traffic. Old cost-12 hashes keep verifying correctly
// (bcrypt encodes the cost used at hash time in the hash itself); use
// needsPasswordRehash() to migrate them down to BCRYPT_COST on next login.
const BCRYPT_COST = 10

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_COST)
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash)
}

function needsPasswordRehash(hash) {
  const match = /^\$2[aby]\$(\d+)\$/.exec(String(hash || ''))
  return Boolean(match) && Number(match[1]) > BCRYPT_COST
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

  if (options.actingAdminId) {
    payload.actingAdminId = options.actingAdminId
    payload.actingAdminName = options.actingAdminName
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
  defaultPasswordForPhone,
  generateOtpCode,
  hashOtpCode,
  hashPassword,
  isSessionError,
  needsPasswordRehash,
  normalizeEmail,
  normalizePhone,
  readSessionToken,
  verifyOtpCode,
  verifyPassword,
  verifySessionToken,
}
