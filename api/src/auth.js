const { sql, withRequest, withTransaction } = require('./db')
const { isCaptchaConfigured, isConfigError } = require('./config')
const { clearSessionHeaders, createSessionHeaders, getClientIp, json } = require('./http')
const { consumeRateLimit } = require('./rate-limit')
const { verifyTurnstileToken } = require('./turnstile')
const { normalizeTeacherSubjectIds, parseTeacherSubjectIdsJson } = require('./subjectIds')
const {
  createSessionToken,
  defaultPasswordForPhone,
  hashPassword,
  isSessionError,
  needsPasswordRehash,
  normalizePhone,
  readSessionToken,
  verifyPassword,
  verifySessionToken,
} = require('./security')

const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// "DENEME" kupon kodu (yalnızca büyük harf, tam eşleşme): veliye ücretsiz + 2 öğrenci
// hakkı, öğretmene ücretsiz + 10 öğrenci hakkı tanır. Bkz. registerHandler.
const TRIAL_COUPON_CODE = 'DENEME'
const TRIAL_COUPON_PARENT_MAX_STUDENTS = 2
const TRIAL_COUPON_TEACHER_SEATS = 10

// Test/geliştirme sırasında sık giriş denemesi yapılan bu numara için giriş rate limit kontrolü atlanır.
const LOGIN_RATE_LIMIT_EXEMPT_PHONES = new Set(['+905353816943'])

function sanitizeUser(record) {
  return {
    id: record.id,
    fullName: record.full_name,
    email: record.email,
    phone: record.phone_number,
    role: record.role,
    isAdmin: Boolean(record.is_admin),
    canManageLibrary: Boolean(record.can_manage_library),
    lastLoginAt: record.last_login_at,
    createdAt: record.created_at,
    needsConsent: !record.aydinlatma_accepted_at || !record.kvkk_accepted_at,
    themeId: record.theme_id || null,
    teacherSubjectIds: record.role === 'ogretmen' ? parseTeacherSubjectIdsJson(record.teacher_subject_ids_json) : undefined,
  }
}

function createAuthServiceErrorResponse(error, fallbackMessage) {
  if (isConfigError(error)) {
    return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
  }

  console.error(fallbackMessage, error)
  return json(500, { error: 'Kimlik doğrulama servisi şu anda kullanılamıyor.' })
}

async function registerHandler(request) {
  const payload = await request.json().catch(() => null)
  if (!payload) {
    return json(400, { error: 'Geçersiz istek gövdesi.' })
  }

  const fullName = String(payload.fullName || '').trim()
  if (fullName.length < 3 || fullName.length > 120) {
    return json(400, { error: 'Ad soyad 3 ile 120 karakter arasında olmalı.' })
  }

  const phone = normalizePhone(payload.phone)
  if (!phone) {
    return json(400, { error: 'Geçerli bir telefon numarası girin.' })
  }

  let email = null
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

  const ip = getClientIp(request)

  if (isCaptchaConfigured()) {
    const turnstileResult = await verifyTurnstileToken(payload.turnstileToken, ip)
    if (!turnstileResult.success) {
      return json(403, { error: 'Doğrulama başarısız. Lütfen sayfayı yenileyip tekrar deneyin.' })
    }
  } else {
    console.warn('[auth] TURNSTILE_SECRET_KEY yapılandırılmadı, Turnstile doğrulaması atlanıyor.')
  }

  if (!(await consumeRateLimit(`register:${ip}`))) {
    return json(429, { error: 'Çok fazla kayıt denemesi yapıldı. Lütfen daha sonra tekrar deneyin.' })
  }

  const passwordHash = await hashPassword(defaultPasswordForPhone(phone))
  const now = new Date()
  // Herkese açık kayıt formu yalnızca ebeveyn veya öğretmen hesabı oluşturur; öğrenciler
  // yalnızca bir ebeveynin "Öğrenci Profillerim" ekranından eklenebilir.
  const role = payload.role === 'ogretmen' ? 'ogretmen' : 'ebeveyn'
  const hasTrialCoupon = String(payload.couponCode || '').trim() === TRIAL_COUPON_CODE

  let teacherSubjectIds = []
  if (role === 'ogretmen') {
    const subjectIdsResult = normalizeTeacherSubjectIds(payload.subjectIds)
    if (subjectIdsResult.error) {
      return json(400, { error: subjectIdsResult.error })
    }
    if (subjectIdsResult.value.length === 0) {
      return json(400, { error: 'Öğretmen branşınızı seçmelisiniz.' })
    }
    teacherSubjectIds = subjectIdsResult.value
  }

  try {
    const { user, entitlement } = await withTransaction(async (requestInTransaction) => {
      const insertUserDb = requestInTransaction({
        fullName: { type: sql.NVarChar(120), value: fullName },
        email: { type: sql.NVarChar(320), value: email },
        phone: { type: sql.NVarChar(20), value: phone },
        passwordHash: { type: sql.NVarChar(255), value: passwordHash },
        role: { type: sql.NVarChar(20), value: role },
        consentAt: { type: sql.DateTime2, value: now },
        teacherSubjectIdsJson: {
          type: sql.NVarChar(sql.MAX),
          value: teacherSubjectIds.length ? JSON.stringify(teacherSubjectIds) : null,
        },
      })

      const result = await insertUserDb.query(`
        INSERT INTO dbo.Users (full_name, email, phone_number, password_hash, role, aydinlatma_accepted_at, kvkk_accepted_at, teacher_subject_ids_json)
        OUTPUT inserted.id, inserted.full_name, inserted.email, inserted.phone_number, inserted.role,
               inserted.is_admin, inserted.can_manage_library, inserted.last_login_at, inserted.created_at,
               inserted.aydinlatma_accepted_at, inserted.kvkk_accepted_at, inserted.teacher_subject_ids_json
        VALUES (@fullName, @email, @phone, @passwordHash, @role, @consentAt, @consentAt, @teacherSubjectIdsJson);
      `)

      const insertedUser = sanitizeUser(result.recordset[0])
      let insertedEntitlement = { status: 'none', source: null, currentPeriodEnd: null }

      if (role === 'ogretmen') {
        // Web üzerinden kart tahsilatı henüz entegre değil; öğretmen deneme durumuyla
        // kaydolur, gerçek ödeme altyapısı eklendiğinde bu durum güncellenecek.
        // "DENEME" kupon kodu girildiyse hesap doğrudan ücretsiz + 10 öğrenci koltuğuyla aktif olur.
        const teacherStatus = hasTrialCoupon ? 'active' : 'trial'
        const teacherBaseSeats = hasTrialCoupon ? TRIAL_COUPON_TEACHER_SEATS : 4
        const teacherGrantedReason = hasTrialCoupon ? 'coupon:DENEME' : 'self_service_signup'
        const entitlementDb = requestInTransaction({
          teacherId: { type: sql.UniqueIdentifier, value: insertedUser.id },
          status: { type: sql.NVarChar(20), value: teacherStatus },
          baseSeats: { type: sql.Int, value: teacherBaseSeats },
          grantedReason: { type: sql.NVarChar(255), value: teacherGrantedReason },
        })
        await entitlementDb.query(`
          INSERT INTO dbo.TeacherEntitlements (teacher_id, status, source, base_seats, purchased_seats, granted_reason)
          VALUES (@teacherId, @status, 'comp', @baseSeats, 0, @grantedReason);
        `)
      } else if (hasTrialCoupon) {
        // "DENEME" kupon kodu girildiyse veli hesabı ücretsiz aktif olur ve 2 öğrenci ekleme
        // hakkı tanınır (kota kontrolü createStudentHandler içinde uygulanır).
        const entitlementDb = requestInTransaction({
          parentId: { type: sql.UniqueIdentifier, value: insertedUser.id },
          maxStudents: { type: sql.Int, value: TRIAL_COUPON_PARENT_MAX_STUDENTS },
        })
        await entitlementDb.query(`
          INSERT INTO dbo.Entitlements (parent_id, status, source, max_students, granted_reason)
          VALUES (@parentId, 'active', 'comp', @maxStudents, 'coupon:DENEME');
        `)
        insertedEntitlement = { status: 'active', source: 'comp', currentPeriodEnd: null }
      }

      return { user: insertedUser, entitlement: insertedEntitlement }
    })

    // Kayıt anında verilen aboneliği (kupon vb.) yanıta ekliyoruz; aksi halde frontend'deki
    // route guard (App.jsx) taze kaydolan kullanıcıyı bir sonraki /me çağrısına kadar
    // entitlement bilgisi eksik zannedip paywall'a yönlendirebilir.
    user.entitlement = entitlement
    const token = createSessionToken(user)

    return json(201, { user }, createSessionHeaders(token))
  } catch (error) {
    if (error.number === 2601 || error.number === 2627) {
      return json(409, { error: 'Bu telefon numarası veya e-posta adresi ile daha önce kayıt oluşturulmuş.' })
    }

    return createAuthServiceErrorResponse(error, 'registerHandler failed')
  }
}

async function loginHandler(request) {
  const payload = await request.json().catch(() => null)
  if (!payload) {
    return json(400, { error: 'Geçersiz istek gövdesi.' })
  }

  const phone = normalizePhone(payload.phone)
  const password = String(payload.password || '')
  if (!phone || !password) {
    return json(400, { error: 'Telefon numarası ve şifre girin.' })
  }

  const ip = getClientIp(request)

  if (
    !LOGIN_RATE_LIMIT_EXEMPT_PHONES.has(phone) &&
    !(await consumeRateLimit(`login:${ip}:${phone}`))
  ) {
    return json(429, { error: 'Çok fazla giriş denemesi yapıldı. Lütfen 15 dakika sonra tekrar deneyin.' })
  }

  try {
    const requestDb = await withRequest({
      phone: { type: sql.NVarChar(20), value: phone },
    })

    const result = await requestDb.query(`
      SELECT TOP 1
        u.id,
        u.full_name,
        u.email,
        u.phone_number,
        u.role,
        u.is_admin,
        u.can_manage_library,
        u.password_hash,
        u.failed_login_count,
        u.lockout_until,
        u.last_login_at,
        u.created_at,
        u.aydinlatma_accepted_at,
        u.kvkk_accepted_at,
        u.teacher_subject_ids_json,
        sp.theme_id,
        e.status AS entitlement_status, e.source AS entitlement_source,
        e.current_period_end AS entitlement_current_period_end
      FROM dbo.Users u
      LEFT JOIN dbo.StudentProfiles sp ON sp.student_id = u.id
      LEFT JOIN dbo.Entitlements e ON e.parent_id = COALESCE(u.parent_id, u.id)
      WHERE u.phone_number = @phone;
    `)

    const record = result.recordset[0]
    if (!record || !record.password_hash) {
      return json(401, { error: 'Telefon numarası veya şifre hatalı.' })
    }

    if (record.lockout_until && new Date(record.lockout_until) > new Date()) {
      return json(423, { error: 'Hesap geçici olarak kilitlendi. Lütfen daha sonra tekrar deneyin.' })
    }

    const isPasswordValid = await verifyPassword(password, record.password_hash)
    if (!isPasswordValid) {
      const failedCount = record.failed_login_count + 1
      const lockoutUntil = failedCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null
      const failedRequest = await withRequest({
        id: { type: sql.UniqueIdentifier, value: record.id },
        failedLoginCount: { type: sql.Int, value: failedCount >= 5 ? 5 : failedCount },
        lockoutUntil: { type: sql.DateTime2, value: lockoutUntil },
      })

      await failedRequest.query(`
        UPDATE dbo.Users
        SET failed_login_count = @failedLoginCount,
            lockout_until = @lockoutUntil
        WHERE id = @id;
      `)

      return json(401, { error: 'Telefon numarası veya şifre hatalı.' })
    }

    const rehashedPassword = needsPasswordRehash(record.password_hash)
      ? await hashPassword(password)
      : null

    const successRequest = await withRequest({
      id: { type: sql.UniqueIdentifier, value: record.id },
      ...(rehashedPassword
        ? { passwordHash: { type: sql.NVarChar(255), value: rehashedPassword } }
        : {}),
    })

    await successRequest.query(`
      UPDATE dbo.Users
      SET failed_login_count = 0,
          lockout_until = NULL,
          last_login_at = SYSUTCDATETIME()
          ${rehashedPassword ? ', password_hash = @passwordHash' : ''}
      WHERE id = @id;
    `)

    const user = sanitizeUser({
      ...record,
      last_login_at: new Date().toISOString(),
    })
    // registerHandler'daki aynı nedenden: route guard'ın (App.jsx) girişten hemen sonra
    // paywall'a yanlış yönlendirmemesi için entitlement bilgisi yanıta ekleniyor.
    user.entitlement = {
      status: record.entitlement_status || 'none',
      source: record.entitlement_source || null,
      currentPeriodEnd: record.entitlement_current_period_end || null,
    }
    const token = createSessionToken(user)

    return json(200, { user }, createSessionHeaders(token))
  } catch (error) {
    return createAuthServiceErrorResponse(error, 'loginHandler failed')
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
        u.id, u.full_name, u.email, u.phone_number, u.role, u.is_admin, u.can_manage_library, u.last_login_at, u.created_at,
        u.aydinlatma_accepted_at, u.kvkk_accepted_at, u.funded_by_teacher_id, u.teacher_subject_ids_json,
        sp.theme_id,
        e.status AS entitlement_status, e.source AS entitlement_source,
        e.current_period_end AS entitlement_current_period_end
      FROM dbo.Users u
      LEFT JOIN dbo.StudentProfiles sp ON sp.student_id = u.id
      LEFT JOIN dbo.Entitlements e ON e.parent_id = COALESCE(u.parent_id, u.id)
      WHERE u.id = @id;
    `)
    const record = result.recordset[0]

    if (!record) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    const user = sanitizeUser(record)
    if (record.role === 'ogrenci') {
      user.restricted = Boolean(record.funded_by_teacher_id)
    } else if (record.role === 'ebeveyn') {
      // Veli panelindeki sayfalar (Dashboard, Haftalık Plan) bir studentId belirtmeden çalışır ve
      // arka planda requireStudentContext bu veliye ait İLK öğrenciyi (created_at ASC) varsayılan
      // olarak kullanır — burada da aynı öğrenciyi çözüp kısıtlı olup olmadığını aynı alanda taşırız.
      const defaultStudentDb = await withRequest({ parentId: { type: sql.UniqueIdentifier, value: record.id } })
      const defaultStudentResult = await defaultStudentDb.query(`
        SELECT TOP 1 funded_by_teacher_id FROM dbo.Users WHERE parent_id = @parentId ORDER BY created_at ASC;
      `)
      user.restricted = Boolean(defaultStudentResult.recordset[0]?.funded_by_teacher_id)
    }
    if (session.actingParentId) {
      user.actingParent = { id: session.actingParentId, fullName: session.actingParentName }
    }
    if (session.actingAdminId) {
      user.actingAdmin = { id: session.actingAdminId, fullName: session.actingAdminName }
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

async function changePasswordHandler(request) {
  try {
    const token = readSessionToken(request)
    if (!token) {
      return json(401, { error: 'Oturum bulunamadı.' })
    }

    const session = verifySessionToken(token)
    const payload = await request.json().catch(() => null)
    if (!payload) {
      return json(400, { error: 'Geçersiz istek gövdesi.' })
    }

    const currentPassword = String(payload.currentPassword || '')
    const newPassword = String(payload.newPassword || '')
    if (!currentPassword || !newPassword) {
      return json(400, { error: 'Mevcut ve yeni şifreyi girin.' })
    }

    if (newPassword.length < 6 || newPassword.length > 72) {
      return json(400, { error: 'Yeni şifre 6 ile 72 karakter arasında olmalı.' })
    }

    if (!(await consumeRateLimit(`change-password:${session.sub}`))) {
      return json(429, { error: 'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.' })
    }

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: session.sub },
    })
    const result = await requestDb.query(`
      SELECT TOP 1 password_hash FROM dbo.Users WHERE id = @id;
    `)
    const record = result.recordset[0]
    if (!record) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }

    const isPasswordValid = await verifyPassword(currentPassword, record.password_hash)
    if (!isPasswordValid) {
      return json(401, { error: 'Mevcut şifre hatalı.' })
    }

    const newPasswordHash = await hashPassword(newPassword)
    const updateDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: session.sub },
      passwordHash: { type: sql.NVarChar(255), value: newPasswordHash },
    })
    await updateDb.query(`
      UPDATE dbo.Users
      SET password_hash = @passwordHash,
          failed_login_count = 0,
          lockout_until = NULL
      WHERE id = @id;
    `)

    return json(200, { ok: true })
  } catch (error) {
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }
    return createAuthServiceErrorResponse(error, 'changePasswordHandler failed')
  }
}

async function logoutHandler() {
  return json(200, { ok: true }, clearSessionHeaders())
}

// Öğretmen tarafından oluşturulan veli/öğrenci hesapları "onay bekliyor" durumunda açılır
// (aydinlatma_accepted_at/kvkk_accepted_at NULL). Bu uç, oturum sahibinin KENDİ onayını ve
// o an onayı bekleyen tüm bağlı öğrenci profillerinin onayını tek seferde tamamlar.
async function acceptConsentHandler(request) {
  try {
    const token = readSessionToken(request)
    if (!token) {
      return json(401, { error: 'Oturum bulunamadı.' })
    }

    const session = verifySessionToken(token)
    const payload = await request.json().catch(() => null)
    if (payload?.acceptAydinlatma !== true || payload?.acceptKvkk !== true) {
      return json(400, { error: 'Devam etmek için aydınlatma ve KVKK onaylarını vermelisiniz.' })
    }

    const requestDb = await withRequest({
      id: { type: sql.UniqueIdentifier, value: session.sub },
    })
    await requestDb.query(`
      UPDATE dbo.Users
      SET aydinlatma_accepted_at = SYSUTCDATETIME(), kvkk_accepted_at = SYSUTCDATETIME()
      WHERE (id = @id OR (parent_id = @id AND aydinlatma_accepted_at IS NULL))
        AND aydinlatma_accepted_at IS NULL;
    `)

    return json(200, { ok: true })
  } catch (error) {
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }
    return createAuthServiceErrorResponse(error, 'acceptConsentHandler failed')
  }
}

module.exports = {
  changePasswordHandler,
  loginHandler,
  logoutHandler,
  meHandler,
  registerHandler,
  sanitizeUser,
  acceptConsentHandler,
}
