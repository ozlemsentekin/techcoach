const { sql, withRequest } = require('./db')
const { isCaptchaConfigured, isConfigError } = require('./config')
const { accountDisabledResponse, createSessionHeaders, getClientIp, json } = require('./http')
const { consumeRateLimit } = require('./rate-limit')
const { sendOtpSms } = require('./sms')
const { verifyTurnstileToken } = require('./turnstile')
const { sanitizeUser } = require('./auth')
const { buildSessionEntitlement } = require('./entitlements')
const {
  createPhoneVerifiedToken,
  createSessionToken,
  generateOtpCode,
  hashOtpCode,
  normalizePhone,
  verifyOtpCode,
} = require('./security')

const OTP_CODE_RULE = /^\d{6}$/
const PURPOSES = new Set(['login', 'register'])
const OTP_TTL_MS = 60 * 1000
const MAX_VERIFY_ATTEMPTS = 5

// Test/geliştirme sırasında sık OTP denemesi yapılan bu numara için rate limit kontrolleri
// atlanır. Eskiden auth.js (login) ve otp.js (password-reset) içinde ayrı ayrı tanımlıydı,
// artık tüm telefon-doğrulama akışları (giriş + kayıt) burada tek liste.
const OTP_RATE_LIMIT_EXEMPT_PHONES = new Set(['+905353816943'])

// SMS gönderimi (Netgsm) canlıda aktif — rastgele kod üretimi ve gerçek SMS gönderimi devrede.
const SMS_ENABLED = true

function codeForPhone(phone) {
  if (!SMS_ENABLED) {
    return phone.replace('+90', '').slice(-6)
  }
  return generateOtpCode()
}

function otpServiceErrorResponse(error, fallbackMessage) {
  if (isConfigError(error)) {
    return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
  }

  console.error(fallbackMessage, error)
  return json(500, { error: 'Kimlik doğrulama servisi şu anda kullanılamıyor.' })
}

// Girişte kullanılan zengin SELECT (StudentProfiles + Entitlements dahil) — loginHandler'ın
// eskiden yaptığıyla aynı, böylece OTP ile giriş de aynı zengin `user` nesnesini (grade,
// entitlement vb.) döner. Kayıt/çakışma kontrolü gibi sadece varlık kontrolü gereken
// yerlerde bunun yerine hafif findUserByPhoneBasic kullanılır.
async function findUserForLogin(phone) {
  const requestDb = await withRequest({ phone: { type: sql.NVarChar(20), value: phone } })
  const result = await requestDb.query(`
    SELECT TOP 1
      u.id, u.full_name, u.email, u.phone_number, u.role, u.is_admin, u.can_manage_library,
      u.is_active, u.has_panel_access, u.last_login_at, u.created_at,
      u.aydinlatma_accepted_at, u.kvkk_accepted_at, u.teacher_subject_ids_json, u.parent_type,
      sp.theme_id, sp.grade,
      e.status AS entitlement_status, e.source AS entitlement_source,
      e.current_period_end AS entitlement_current_period_end
    FROM dbo.Users u
    LEFT JOIN dbo.StudentProfiles sp ON sp.student_id = u.id
    LEFT JOIN dbo.Entitlements e ON e.parent_id = COALESCE(u.parent_id, u.id)
    WHERE u.phone_number = @phone;
  `)
  return result.recordset[0] || null
}

async function findUserByPhoneBasic(phone) {
  const requestDb = await withRequest({ phone: { type: sql.NVarChar(20), value: phone } })
  const result = await requestDb.query(`
    SELECT TOP 1 id FROM dbo.Users WHERE phone_number = @phone;
  `)
  return result.recordset[0] || null
}

// Giriş/kayıt OTP'si ister — "login" mevcut bir kullanıcı için, "register" henüz kayıtlı
// olmayan bir telefon için. Kayıtta artık ad/e-posta/onay toplanmıyor (bkz. verifyOtpHandler'ın
// register dalı) — sadece telefon sahipliği doğrulanıp auth/register'ın ikinci adımına
// devredilen bir token üretilir; form verisi orada toplanır.
async function requestOtpHandler(request) {
  const payload = await request.json().catch(() => null)
  if (!payload) {
    return json(400, { error: 'Geçersiz istek gövdesi.' })
  }

  const purpose = payload.purpose
  if (!PURPOSES.has(purpose)) {
    return json(400, { error: 'Geçersiz işlem türü.' })
  }

  const phone = normalizePhone(payload.phone)
  if (!phone) {
    return json(400, { error: 'Geçerli bir telefon numarası girin.' })
  }

  const ip = getClientIp(request)
  const isRateLimitExempt = OTP_RATE_LIMIT_EXEMPT_PHONES.has(phone)

  if (isCaptchaConfigured()) {
    const turnstileResult = await verifyTurnstileToken(payload.turnstileToken, ip)
    if (!turnstileResult.success) {
      return json(403, { error: 'Doğrulama başarısız. Lütfen sayfayı yenileyip tekrar deneyin.' })
    }
  } else {
    console.warn('[otp] TURNSTILE_SECRET_KEY yapılandırılmadı, Turnstile doğrulaması atlanıyor.')
  }

  if (!isRateLimitExempt) {
    if (!(await consumeRateLimit(`otp-request-ip:${ip}`))) {
      return json(429, { error: 'Çok fazla istek yapıldı. Lütfen daha sonra tekrar deneyin.' })
    }
    if (!(await consumeRateLimit(`otp-request:${phone}`, { windowMs: 10 * 60 * 1000, maxRequests: 3 }))) {
      return json(429, { error: 'Bu numaraya çok fazla kod istendi. Lütfen birkaç dakika sonra tekrar deneyin.' })
    }
  }

  try {
    const existingUser = await findUserByPhoneBasic(phone)

    if (purpose === 'login' && !existingUser) {
      return json(404, { error: 'Bu numara ile kayıtlı bir üyelik bulunamadı. Üye olun.' })
    }
    if (purpose === 'register' && existingUser) {
      return json(409, { error: 'Bu numara zaten kayıtlı. Giriş yapın.' })
    }

    const code = codeForPhone(phone)
    const codeHash = hashOtpCode(code)
    const expiresAt = new Date(Date.now() + OTP_TTL_MS)

    const insertDb = await withRequest({
      phone: { type: sql.NVarChar(20), value: phone },
      purpose: { type: sql.NVarChar(20), value: purpose },
      codeHash: { type: sql.NVarChar(128), value: codeHash },
      expiresAt: { type: sql.DateTime2, value: expiresAt },
    })
    await insertDb.query(`
      INSERT INTO dbo.OtpCodes (phone_number, purpose, code_hash, expires_at)
      VALUES (@phone, @purpose, @codeHash, @expiresAt);
    `)

    if (SMS_ENABLED) {
      await sendOtpSms(phone, code)
    } else {
      console.warn(`[otp] SMS gönderimi kapalı: ${phone} için kod telefonun son 6 hanesi (${code}).`)
    }

    return json(200, { ok: true, expiresInSeconds: OTP_TTL_MS / 1000, smsDisabled: !SMS_ENABLED })
  } catch (error) {
    return otpServiceErrorResponse(error, 'requestOtpHandler failed')
  }
}

async function consumeOtp(phone, purpose) {
  const otpDb = await withRequest({
    phone: { type: sql.NVarChar(20), value: phone },
    purpose: { type: sql.NVarChar(20), value: purpose },
  })
  const otpResult = await otpDb.query(`
    SELECT TOP 1 id, code_hash, attempt_count, expires_at, consumed_at
    FROM dbo.OtpCodes
    WHERE phone_number = @phone AND purpose = @purpose AND consumed_at IS NULL
    ORDER BY created_at DESC;
  `)
  return otpResult.recordset[0] || null
}

// Girilen kodu doğrular; başarılıysa OtpCodes satırını tüketir ve null döner (devam
// edilebilir). Başarısızsa uygun bir HTTP yanıtı döner (çağıran bunu doğrudan return etmeli).
async function verifyOtpCodeOrRespond(otpRecord, code) {
  if (!otpRecord) {
    return json(400, { error: 'Kod bulunamadı. Lütfen yeni bir kod isteyin.' })
  }
  if (new Date(otpRecord.expires_at) < new Date()) {
    return json(400, { error: 'Kodun süresi doldu. Lütfen yeni bir kod isteyin.' })
  }
  if (otpRecord.attempt_count >= MAX_VERIFY_ATTEMPTS) {
    return json(429, { error: 'Çok fazla hatalı deneme yapıldı. Lütfen yeni bir kod isteyin.' })
  }
  if (!verifyOtpCode(code, otpRecord.code_hash)) {
    const failDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: otpRecord.id },
      attemptCount: { type: sql.Int, value: otpRecord.attempt_count + 1 },
    })
    await failDb.query(`UPDATE dbo.OtpCodes SET attempt_count = @attemptCount WHERE id = @id;`)
    return json(401, { error: 'Kod hatalı.' })
  }

  const consumeDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: otpRecord.id } })
  await consumeDb.query(`UPDATE dbo.OtpCodes SET consumed_at = SYSUTCDATETIME() WHERE id = @id;`)
  return null
}

// Kodu doğrular; purpose='login' ise doğrudan gerçek oturum açar, purpose='register' ise
// (henüz hesap yok, sadece telefon sahipliği kanıtlandı) auth/register'a geçirilecek kısa
// ömürlü bir token döner — kayıt formunun geri kalanı (ad/rol/branş/kupon/onay) orada toplanır.
async function verifyOtpHandler(request) {
  const payload = await request.json().catch(() => null)
  if (!payload) {
    return json(400, { error: 'Geçersiz istek gövdesi.' })
  }

  const purpose = payload.purpose
  if (!PURPOSES.has(purpose)) {
    return json(400, { error: 'Geçersiz işlem türü.' })
  }

  const phone = normalizePhone(payload.phone)
  const code = String(payload.code || '').trim()
  if (!phone || !OTP_CODE_RULE.test(code)) {
    return json(400, { error: 'Geçerli bir telefon numarası ve 6 haneli kod girin.' })
  }

  const ip = getClientIp(request)
  if (
    !OTP_RATE_LIMIT_EXEMPT_PHONES.has(phone) &&
    !(await consumeRateLimit(`otp-verify:${phone}:${ip}`, { windowMs: 10 * 60 * 1000, maxRequests: 15 }))
  ) {
    return json(429, { error: 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.' })
  }

  try {
    const otpRecord = await consumeOtp(phone, purpose)
    const failureResponse = await verifyOtpCodeOrRespond(otpRecord, code)
    if (failureResponse) {
      return failureResponse
    }

    if (purpose === 'register') {
      const phoneVerifiedToken = createPhoneVerifiedToken(phone)
      return json(200, { ok: true, phoneVerifiedToken, expiresInSeconds: 10 * 60 })
    }

    const record = await findUserForLogin(phone)
    if (!record) {
      return json(404, { error: 'Bu numara ile kayıtlı bir üyelik bulunamadı.' })
    }
    if (record.is_active === false) {
      return accountDisabledResponse()
    }
    if (!record.has_panel_access) {
      return json(403, {
        error: 'Bu telefon numarasına panel erişimi henüz tanımlanmamış. Öğretmeninizle iletişime geçin.',
        code: 'PANEL_ACCESS_NOT_GRANTED',
      })
    }

    const touchDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: record.id } })
    await touchDb.query(`
      UPDATE dbo.Users SET last_login_at = SYSUTCDATETIME(), last_seen_at = SYSUTCDATETIME() WHERE id = @id;
    `)

    const user = sanitizeUser({ ...record, last_login_at: new Date().toISOString() })
    user.entitlement = await buildSessionEntitlement({
      userId: record.id,
      role: record.role,
      status: record.entitlement_status,
      source: record.entitlement_source,
      currentPeriodEnd: record.entitlement_current_period_end,
    })
    const token = createSessionToken(user)

    return json(200, { user }, createSessionHeaders(token))
  } catch (error) {
    return otpServiceErrorResponse(error, 'verifyOtpHandler failed')
  }
}

module.exports = {
  requestOtpHandler,
  verifyOtpHandler,
}
