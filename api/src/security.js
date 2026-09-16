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

  const payload = jwt.verify(token, jwtSecret, {
    issuer: 'techcoach-api',
    audience: 'techcoach-web',
  })
  // Oturum token'larında `purpose` claim'i bulunmaz — kısa ömürlü handoff token'ı (bkz.
  // createHandoffToken) doğrudan oturum çerezi olarak kullanılamasın.
  if (payload.purpose) {
    throw new jwt.JsonWebTokenError('not a session token')
  }
  return payload
}

// iyzico ödeme callback'i, tarayıcının çapraz-site (iyzico → callback) yönlendirme zincirinde
// SameSite=Strict oturum çerezini SAKLAMAMASI nedeniyle, yeni açılan veli hesabını doğrudan
// giriş yaptıramıyor. Bunun yerine kısa ömürlü (2 dk) tek kullanımlık bir "handoff" token'ı
// URL'de taşınır; frontend bunu aynı-origin bir istekle gerçek oturum çerezine çevirir.
function createHandoffToken(userId) {
  const { jwtSecret } = getAuthConfig()
  return jwt.sign({ sub: userId, purpose: 'payment-handoff' }, jwtSecret, {
    expiresIn: 120,
    issuer: 'techcoach-api',
    audience: 'techcoach-web',
  })
}

function verifyHandoffToken(token) {
  const { jwtSecret } = getAuthConfig()
  const payload = jwt.verify(token, jwtSecret, {
    issuer: 'techcoach-api',
    audience: 'techcoach-web',
  })
  if (payload.purpose !== 'payment-handoff' || !payload.sub) {
    throw new jwt.JsonWebTokenError('invalid handoff token')
  }
  return payload
}

// Kayıt akışında OTP ile telefon sahipliği doğrulandıktan sonra, formun geri kalanını
// (ad/rol/branş/kupon/onay) doldurmak için kısa ömürlü (10 dk) tek amaçlı token — tam oturum
// değil, sadece "bu telefonu doğruladın" kanıtı. createHandoffToken ile aynı desen: purpose
// claim'i sayesinde normal oturum çerezi olarak kullanılamaz (bkz. verifySessionToken).
function createPhoneVerifiedToken(phone) {
  const { jwtSecret } = getAuthConfig()
  return jwt.sign({ phone, purpose: 'phone-verified' }, jwtSecret, {
    expiresIn: 10 * 60,
    issuer: 'techcoach-api',
    audience: 'techcoach-web',
  })
}

function verifyPhoneVerifiedToken(token) {
  const { jwtSecret } = getAuthConfig()
  const payload = jwt.verify(token, jwtSecret, {
    issuer: 'techcoach-api',
    audience: 'techcoach-web',
  })
  if (payload.purpose !== 'phone-verified' || !payload.phone) {
    throw new jwt.JsonWebTokenError('invalid phone-verified token')
  }
  return payload
}

// True for a rejected/expired/malformed JWT (jsonwebtoken's own error types) — i.e. an
// actually invalid session, as opposed to an unrelated failure (DB error, etc.) that
// happened to occur while handling an otherwise-valid session.
function isSessionError(error) {
  return error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError || error instanceof jwt.NotBeforeError
}

module.exports = {
  createSessionToken,
  createHandoffToken,
  verifyHandoffToken,
  createPhoneVerifiedToken,
  verifyPhoneVerifiedToken,
  generateOtpCode,
  hashOtpCode,
  isSessionError,
  normalizeEmail,
  normalizePhone,
  readSessionToken,
  verifyOtpCode,
  verifySessionToken,
}
