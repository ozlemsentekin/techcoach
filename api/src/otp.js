const { sql, withRequest } = require('./db')
const { isCaptchaConfigured, isConfigError } = require('./config')
const { accountDisabledResponse, createSessionHeaders, getClientIp, json } = require('./http')
const { consumeRateLimit } = require('./rate-limit')
const { sendOtpSms } = require('./sms')
const { verifyTurnstileToken } = require('./turnstile')
const { sanitizeUser } = require('./auth')
const { passwordChangeError } = require('./passwordPolicy')
const { buildSessionEntitlement } = require('./entitlements')
const {
  createPasswordResetToken,
  createSessionToken,
  generateOtpCode,
  hashOtpCode,
  hashPassword,
  isSessionError,
  normalizePhone,
  verifyOtpCode,
  verifyPasswordResetToken,
} = require('./security')

const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const OTP_CODE_RULE = /^\d{6}$/
const PURPOSES = new Set(['login', 'register'])
const OTP_TTL_MS = 60 * 1000
const MAX_VERIFY_ATTEMPTS = 5

// Netgsm hesabı bağlandı (şifremi unuttum akışı için) — rastgele kod üretimi ve gerçek SMS
// gönderimi devrede. (Login/register OTP route'ları hâlâ app.js'e kayıtlı değil; bu flag'in
// açık olması onları etkilemez, sadece password-reset uçları gerçek SMS tetikler.)
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

async function findUserByPhone(phone) {
  const requestDb = await withRequest({
    phone: { type: sql.NVarChar(20), value: phone },
  })
  const result = await requestDb.query(`
    SELECT TOP 1 id, full_name, email, phone_number, role, is_admin, can_manage_library, last_login_at, created_at
    FROM dbo.Users
    WHERE phone_number = @phone;
  `)
  return result.recordset[0] || null
}

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

  let fullName = ''
  let email = null

  if (purpose === 'register') {
    fullName = String(payload.fullName || '').trim()
    if (fullName.length < 3 || fullName.length > 120) {
      return json(400, { error: 'Ad soyad 3 ile 120 karakter arasında olmalı.' })
    }

    const rawEmail = String(payload.email || '').trim().toLowerCase()
    if (rawEmail) {
      if (!EMAIL_RULE.test(rawEmail) || rawEmail.length > 320) {
        return json(400, { error: 'Geçerli bir e-posta adresi girin.' })
      }
      email = rawEmail
    }

    if (payload.acceptAydinlatma !== true || payload.acceptKvkk !== true) {
      return json(400, { error: 'Devam etmek için aydınlatma ve KVKK onaylarını vermelisiniz.' })
    }
  }

  const ip = getClientIp(request)

  if (isCaptchaConfigured()) {
    const turnstileResult = await verifyTurnstileToken(payload.turnstileToken, ip)
    if (!turnstileResult.success) {
      return json(403, { error: 'Doğrulama başarısız. Lütfen sayfayı yenileyip tekrar deneyin.' })
    }
  } else {
    console.warn('[otp] TURNSTILE_SECRET_KEY yapılandırılmadı, Turnstile doğrulaması atlanıyor.')
  }

  if (!(await consumeRateLimit(`otp-request-ip:${ip}`))) {
    return json(429, { error: 'Çok fazla istek yapıldı. Lütfen daha sonra tekrar deneyin.' })
  }
  if (!(await consumeRateLimit(`otp-request:${phone}`, { windowMs: 10 * 60 * 1000, maxRequests: 3 }))) {
    return json(429, { error: 'Bu numaraya çok fazla kod istendi. Lütfen birkaç dakika sonra tekrar deneyin.' })
  }

  try {
    const existingUser = await findUserByPhone(phone)

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
      pendingFullName: { type: sql.NVarChar(120), value: purpose === 'register' ? fullName : null },
      pendingEmail: { type: sql.NVarChar(320), value: email },
    })
    await insertDb.query(`
      INSERT INTO dbo.OtpCodes (phone_number, purpose, code_hash, expires_at, pending_full_name, pending_email)
      VALUES (@phone, @purpose, @codeHash, @expiresAt, @pendingFullName, @pendingEmail);
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
  if (!(await consumeRateLimit(`otp-verify:${phone}:${ip}`, { windowMs: 10 * 60 * 1000, maxRequests: 15 }))) {
    return json(429, { error: 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.' })
  }

  try {
    const otpDb = await withRequest({
      phone: { type: sql.NVarChar(20), value: phone },
      purpose: { type: sql.NVarChar(20), value: purpose },
    })
    const otpResult = await otpDb.query(`
      SELECT TOP 1 id, code_hash, attempt_count, expires_at, consumed_at, pending_full_name, pending_email
      FROM dbo.OtpCodes
      WHERE phone_number = @phone AND purpose = @purpose AND consumed_at IS NULL
      ORDER BY created_at DESC;
    `)
    const otpRecord = otpResult.recordset[0]

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
      await failDb.query(`
        UPDATE dbo.OtpCodes SET attempt_count = @attemptCount WHERE id = @id;
      `)
      return json(401, { error: 'Kod hatalı.' })
    }

    const consumeDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: otpRecord.id },
    })
    await consumeDb.query(`
      UPDATE dbo.OtpCodes SET consumed_at = SYSUTCDATETIME() WHERE id = @id;
    `)

    let userRecord
    let status

    if (purpose === 'register') {
      const now = new Date()
      const insertUserDb = await withRequest({
        fullName: { type: sql.NVarChar(120), value: otpRecord.pending_full_name },
        email: { type: sql.NVarChar(320), value: otpRecord.pending_email },
        phone: { type: sql.NVarChar(20), value: phone },
        role: { type: sql.NVarChar(20), value: 'ebeveyn' },
        consentAt: { type: sql.DateTime2, value: now },
      })
      const insertResult = await insertUserDb.query(`
        INSERT INTO dbo.Users (full_name, email, phone_number, role, aydinlatma_accepted_at, kvkk_accepted_at)
        OUTPUT inserted.id, inserted.full_name, inserted.email, inserted.phone_number, inserted.role,
               inserted.is_admin, inserted.can_manage_library, inserted.last_login_at, inserted.created_at
        VALUES (@fullName, @email, @phone, @role, @consentAt, @consentAt);
      `)
      userRecord = insertResult.recordset[0]
      status = 201
    } else {
      userRecord = await findUserByPhone(phone)
      if (!userRecord) {
        return json(404, { error: 'Bu numara ile kayıtlı bir üyelik bulunamadı.' })
      }

      const touchDb = await withRequest({
        id: { type: sql.UniqueIdentifier, value: userRecord.id },
      })
      await touchDb.query(`
        UPDATE dbo.Users SET last_login_at = SYSUTCDATETIME(), last_seen_at = SYSUTCDATETIME() WHERE id = @id;
      `)
      status = 200
    }

    const user = sanitizeUser(userRecord)
    const token = createSessionToken(user)

    return json(status, { user }, createSessionHeaders(token))
  } catch (error) {
    if (error.number === 2601 || error.number === 2627) {
      return json(409, { error: 'Bu numara veya e-posta ile daha önce kayıt oluşturulmuş.' })
    }

    return otpServiceErrorResponse(error, 'verifyOtpHandler failed')
  }
}

const PASSWORD_RESET_PURPOSE = 'password_reset'

async function requestPasswordResetOtpHandler(request) {
  const payload = await request.json().catch(() => null)
  if (!payload) {
    return json(400, { error: 'Geçersiz istek gövdesi.' })
  }

  const phone = normalizePhone(payload.phone)
  if (!phone) {
    return json(400, { error: 'Geçerli bir telefon numarası girin.' })
  }

  const ip = getClientIp(request)

  if (isCaptchaConfigured()) {
    const turnstileResult = await verifyTurnstileToken(payload.turnstileToken, ip)
    if (!turnstileResult.success) {
      return json(403, { error: 'Doğrulama başarısız. Lütfen sayfayı yenileyip tekrar deneyin.' })
    }
  } else {
    console.warn('[otp] TURNSTILE_SECRET_KEY yapılandırılmadı, Turnstile doğrulaması atlanıyor.')
  }

  if (!(await consumeRateLimit(`password-reset-request-ip:${ip}`))) {
    return json(429, { error: 'Çok fazla istek yapıldı. Lütfen daha sonra tekrar deneyin.' })
  }
  if (!(await consumeRateLimit(`password-reset-request:${phone}`, { windowMs: 10 * 60 * 1000, maxRequests: 3 }))) {
    return json(429, { error: 'Bu numaraya çok fazla kod istendi. Lütfen birkaç dakika sonra tekrar deneyin.' })
  }

  try {
    const existingUser = await findUserByPhone(phone)
    if (!existingUser) {
      return json(404, { error: 'Bu numara ile kayıtlı bir üyelik bulunamadı.' })
    }

    const code = codeForPhone(phone)
    const codeHash = hashOtpCode(code)
    const expiresAt = new Date(Date.now() + OTP_TTL_MS)

    const insertDb = await withRequest({
      phone: { type: sql.NVarChar(20), value: phone },
      purpose: { type: sql.NVarChar(20), value: PASSWORD_RESET_PURPOSE },
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

    return json(200, { ok: true, expiresInSeconds: OTP_TTL_MS / 1000 })
  } catch (error) {
    return otpServiceErrorResponse(error, 'requestPasswordResetOtpHandler failed')
  }
}

async function verifyPasswordResetOtpHandler(request) {
  const payload = await request.json().catch(() => null)
  if (!payload) {
    return json(400, { error: 'Geçersiz istek gövdesi.' })
  }

  const phone = normalizePhone(payload.phone)
  const code = String(payload.code || '').trim()
  if (!phone || !OTP_CODE_RULE.test(code)) {
    return json(400, { error: 'Geçerli bir telefon numarası ve 6 haneli kod girin.' })
  }

  const ip = getClientIp(request)
  if (!(await consumeRateLimit(`password-reset-verify:${phone}:${ip}`, { windowMs: 10 * 60 * 1000, maxRequests: 15 }))) {
    return json(429, { error: 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.' })
  }

  try {
    const otpDb = await withRequest({
      phone: { type: sql.NVarChar(20), value: phone },
      purpose: { type: sql.NVarChar(20), value: PASSWORD_RESET_PURPOSE },
    })
    const otpResult = await otpDb.query(`
      SELECT TOP 1 id, code_hash, attempt_count, expires_at, consumed_at
      FROM dbo.OtpCodes
      WHERE phone_number = @phone AND purpose = @purpose AND consumed_at IS NULL
      ORDER BY created_at DESC;
    `)
    const otpRecord = otpResult.recordset[0]

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
      await failDb.query(`
        UPDATE dbo.OtpCodes SET attempt_count = @attemptCount WHERE id = @id;
      `)
      return json(401, { error: 'Kod hatalı.' })
    }

    const consumeDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: otpRecord.id },
    })
    await consumeDb.query(`
      UPDATE dbo.OtpCodes SET consumed_at = SYSUTCDATETIME() WHERE id = @id;
    `)

    const userRecord = await findUserByPhone(phone)
    if (!userRecord) {
      return json(404, { error: 'Bu numara ile kayıtlı bir üyelik bulunamadı.' })
    }

    const resetToken = createPasswordResetToken(userRecord.id)
    return json(200, { ok: true, resetToken, expiresInSeconds: 60 })
  } catch (error) {
    return otpServiceErrorResponse(error, 'verifyPasswordResetOtpHandler failed')
  }
}

async function confirmPasswordResetHandler(request) {
  const payload = await request.json().catch(() => null)
  if (!payload) {
    return json(400, { error: 'Geçersiz istek gövdesi.' })
  }

  const resetToken = String(payload.resetToken || '')
  const newPassword = String(payload.newPassword || '')
  if (!resetToken || !newPassword) {
    return json(400, { error: 'Geçersiz istek.' })
  }

  let claims
  try {
    claims = verifyPasswordResetToken(resetToken)
  } catch (error) {
    if (isSessionError(error)) {
      return json(401, { error: 'Bağlantının süresi doldu, lütfen tekrar deneyin.' })
    }
    return otpServiceErrorResponse(error, 'confirmPasswordResetHandler token verify failed')
  }

  if (!(await consumeRateLimit(`password-reset-confirm:${claims.sub}`))) {
    return json(429, { error: 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.' })
  }

  try {
    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: claims.sub },
    })
    const result = await requestDb.query(`
      SELECT TOP 1
        u.id, u.full_name, u.email, u.phone_number, u.role, u.is_admin, u.can_manage_library, u.is_active,
        u.last_login_at, u.created_at, u.teacher_subject_ids_json, u.parent_type,
        u.aydinlatma_accepted_at, u.kvkk_accepted_at,
        sp.theme_id, sp.grade,
        e.status AS entitlement_status, e.source AS entitlement_source,
        e.current_period_end AS entitlement_current_period_end
      FROM dbo.Users u
      LEFT JOIN dbo.StudentProfiles sp ON sp.student_id = u.id
      LEFT JOIN dbo.Entitlements e ON e.parent_id = COALESCE(u.parent_id, u.id)
      WHERE u.id = @id;
    `)
    const record = result.recordset[0]
    if (!record) {
      return json(401, { error: 'Bağlantının süresi doldu, lütfen tekrar deneyin.' })
    }
    if (record.is_active === false) {
      return accountDisabledResponse()
    }

    const validationError = passwordChangeError(null, newPassword, record.phone_number)
    if (validationError) {
      return json(400, { error: validationError })
    }

    const newPasswordHash = await hashPassword(newPassword)
    const updateDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: record.id },
      passwordHash: { type: sql.NVarChar(255), value: newPasswordHash },
    })
    await updateDb.query(`
      UPDATE dbo.Users
      SET password_hash = @passwordHash,
          failed_login_count = 0,
          lockout_until = NULL,
          last_login_at = SYSUTCDATETIME(),
          last_seen_at = SYSUTCDATETIME()
      WHERE id = @id;
    `)

    const user = sanitizeUser({ ...record, last_login_at: new Date().toISOString() })
    user.mustChangePassword = false
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
    return otpServiceErrorResponse(error, 'confirmPasswordResetHandler failed')
  }
}

module.exports = {
  requestOtpHandler,
  verifyOtpHandler,
  requestPasswordResetOtpHandler,
  verifyPasswordResetOtpHandler,
  confirmPasswordResetHandler,
}
