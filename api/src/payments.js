const crypto = require('crypto')
const { sql, withRequest, withTransaction } = require('./db')
const { isConfigError, getIyzicoConfig } = require('./config')
const { createSessionHeaders, json } = require('./http')
const { createSessionToken, defaultPasswordForPhone, hashPassword, isSessionError } = require('./security')
const { requireParentSession } = require('./students')
const { requireTeacherSession } = require('./teacherScope')
const {
  sanitizeUser,
  validateParentRegistrationPayload,
  runRegistrationAntiAbuseChecks,
  createCompParentAccount,
  TRIAL_COUPON_CODE,
} = require('./auth')
const {
  hasActiveParentEntitlement,
  upsertParentEntitlementFromIyzico,
  updateParentEntitlementStatus,
  findParentIdBySubscriptionReferenceCode,
  getParentStudentQuota,
  insertChildSeatSubscription,
  findParentIdByChildSeatSubscriptionReferenceCode,
  updateChildSeatSubscriptionFromIyzico,
  getTeacherQuota,
  insertTeacherSeatSubscription,
  findTeacherIdByTeacherSeatSubscriptionReferenceCode,
  updateTeacherSeatSubscriptionFromIyzico,
} = require('./entitlements')
const {
  Iyzipay,
  initializeSubscriptionCheckoutForm,
  retrieveSubscriptionCheckoutForm,
  retrieveSubscription,
} = require('./iyzicoClient')

const BILLING_CYCLES = {
  monthly: (config) => config.parentMonthlyPlanRef,
  yearly: (config) => config.parentYearlyPlanRef,
}

// Ek çocuk (çocuk-koltuğu) paketi pricing plan referansları.
const CHILD_SEAT_BILLING_CYCLES = {
  monthly: (config) => config.childMonthlyPlanRef,
  yearly: (config) => config.childYearlyPlanRef,
}

function isChildSeatPlanRef(config, pricingPlanReferenceCode) {
  if (!pricingPlanReferenceCode) {
    return false
  }
  return (
    pricingPlanReferenceCode === config.childMonthlyPlanRef ||
    pricingPlanReferenceCode === config.childYearlyPlanRef
  )
}

// Öğretmen ek öğrenci koltuğu (öğrenci başı aylık 299 TL / yıllık 2.990 TL) paketi.
const TEACHER_SEAT_BILLING_CYCLES = {
  monthly: (config) => config.teacherSeatMonthlyPlanRef,
  yearly: (config) => config.teacherSeatYearlyPlanRef,
}

function isTeacherSeatPlanRef(config, pricingPlanReferenceCode) {
  if (!pricingPlanReferenceCode) {
    return false
  }
  return (
    pricingPlanReferenceCode === config.teacherSeatMonthlyPlanRef ||
    pricingPlanReferenceCode === config.teacherSeatYearlyPlanRef
  )
}

function splitFullName(fullName) {
  const trimmed = String(fullName || '').trim()
  const lastSpace = trimmed.lastIndexOf(' ')
  if (lastSpace === -1) {
    return { name: trimmed, surname: trimmed }
  }
  return { name: trimmed.slice(0, lastSpace), surname: trimmed.slice(lastSpace + 1) }
}

function isValidIdentityNumber(value) {
  return /^\d{11}$/.test(String(value || ''))
}

const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(value) {
  return EMAIL_RULE.test(String(value || '').trim())
}

async function getParentProfile(parentId) {
  const requestDb = await withRequest({ parentId: { type: sql.UniqueIdentifier, value: parentId } })
  const result = await requestDb.query(`
    SELECT TOP 1 full_name, email, phone_number FROM dbo.Users WHERE id = @parentId;
  `)
  return result.recordset[0] || null
}

// initiateIyzicoCheckoutHandler (mevcut veli) ve initiateIyzicoCheckoutForNewParentHandler (henüz
// hesabı olmayan yeni veli) tarafından ortak kullanılır.
function validatePaymentFields(payload) {
  const billingCycle = payload?.billingCycle
  const identityNumber = payload?.identityNumber
  const address = payload?.address || {}
  const email = String(payload?.email || '').trim().toLowerCase()

  if (!BILLING_CYCLES[billingCycle]) {
    return { error: 'Geçerli bir ödeme periyodu seçin.' }
  }
  if (!isValidIdentityNumber(identityNumber)) {
    return { error: 'Geçerli bir TC Kimlik No girin.' }
  }
  if (!address.addressLine || !address.city || !address.zipCode) {
    return { error: 'Adres, il ve posta kodu bilgilerini girin.' }
  }
  // iyzico'nun abonelik checkout formu email olmadan "Sistem hatası" ile başarısız oluyor —
  // bu yüzden burada da (TC no/adres gibi) zorunlu tutuyoruz.
  if (!isValidEmail(email)) {
    return { error: 'Geçerli bir e-posta adresi girin.' }
  }

  return { billingCycle, identityNumber, address, email }
}

async function initializeParentSubscriptionCheckout({
  conversationId,
  billingCycle,
  identityNumber,
  address,
  fullName,
  email,
  phone,
  planKind = 'parent',
}) {
  const config = getIyzicoConfig()
  const cycles =
    planKind === 'teacherSeat'
      ? TEACHER_SEAT_BILLING_CYCLES
      : planKind === 'childSeat'
        ? CHILD_SEAT_BILLING_CYCLES
        : BILLING_CYCLES
  const pricingPlanReferenceCode = cycles[billingCycle](config)
  const { name, surname } = splitFullName(fullName)

  const billingAddress = {
    contactName: fullName,
    city: address.city,
    district: address.district || address.city,
    country: 'Turkey',
    address: address.addressLine,
    zipCode: address.zipCode,
  }

  return initializeSubscriptionCheckoutForm({
    locale: Iyzipay.LOCALE.TR,
    conversationId,
    callbackUrl: config.callbackUrl,
    pricingPlanReferenceCode,
    subscriptionInitialStatus: Iyzipay.SUBSCRIPTION_INITIAL_STATUS.ACTIVE,
    customer: {
      name,
      surname,
      identityNumber,
      email: email || undefined,
      gsmNumber: phone || undefined,
      billingAddress,
      shippingAddress: billingAddress,
    },
  })
}

async function initiateIyzicoCheckoutHandler(request) {
  try {
    const { error, parentId } = await requireParentSession(request)
    if (error) {
      return error
    }

    const payload = await request.json().catch(() => null)
    const fields = validatePaymentFields(payload)
    if (fields.error) {
      return json(400, { error: fields.error })
    }

    if (await hasActiveParentEntitlement(parentId)) {
      return json(409, { error: 'Zaten aktif bir aboneliğiniz var.' })
    }

    const parent = await getParentProfile(parentId)
    if (!parent) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    const result = await initializeParentSubscriptionCheckout({
      conversationId: parentId,
      ...fields,
      fullName: parent.full_name,
      phone: parent.phone_number,
    })

    return json(200, { checkoutFormContent: result.checkoutFormContent, token: result.token })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Ödeme servisi yapılandırması eksik.' })
    }
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('initiateIyzicoCheckoutHandler failed', error)
    return json(500, { error: `Ödeme başlatılamadı. (${error.message})` })
  }
}

// Mevcut bir veli için EK çocuk (çocuk-koltuğu) paketi satın alma akışını başlatır. Velinin
// kendi aktif aboneliği olsun olmasın çalışır; sadece çocuk ekleme kotası dolu olduğunda izin
// verir. conversationId = velinin Users.id'si; ödeme onaylanınca iyzicoCheckoutCallbackHandler
// içinde ChildSeatSubscriptions'a bir satır yazılır.
async function initiateChildSeatCheckoutHandler(request) {
  try {
    const { error, parentId } = await requireParentSession(request)
    if (error) {
      return error
    }

    const payload = await request.json().catch(() => null)
    const fields = validatePaymentFields(payload)
    if (fields.error) {
      return json(400, { error: fields.error })
    }

    const config = getIyzicoConfig()
    if (!CHILD_SEAT_BILLING_CYCLES[fields.billingCycle](config)) {
      return json(503, { error: 'Ek çocuk paketi şu anda satın alınamıyor. Lütfen daha sonra tekrar deneyin.' })
    }

    const quota = await getParentStudentQuota(parentId)
    if (quota.hasRemaining) {
      return json(409, { error: 'Zaten kullanabileceğiniz bir çocuk profili hakkınız var.' })
    }

    const parent = await getParentProfile(parentId)
    if (!parent) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    const result = await initializeParentSubscriptionCheckout({
      conversationId: parentId,
      ...fields,
      planKind: 'childSeat',
      fullName: parent.full_name,
      phone: parent.phone_number,
    })

    return json(200, { checkoutFormContent: result.checkoutFormContent, token: result.token })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Ödeme servisi yapılandırması eksik.' })
    }
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('initiateChildSeatCheckoutHandler failed', error)
    return json(500, { error: `Ödeme başlatılamadı. (${error.message})` })
  }
}

// Bir öğretmen için ek öğrenci koltuğu (öğrenci başı aylık 299 TL / yıllık 2.990 TL) satın alma
// akışını başlatır. Öğretmenin taban paneli olsun olmasın çalışır; sadece kullanılabilir öğrenci
// hakkı kalmadığında izin verir. conversationId = öğretmenin Users.id'si; ödeme onaylanınca
// iyzicoCheckoutCallbackHandler içinde TeacherSeatSubscriptions'a bir satır yazılır.
async function initiateTeacherSeatCheckoutHandler(request) {
  try {
    const { error, teacherUserId, teacherFullName, teacherPhone } = await requireTeacherSession(request)
    if (error) {
      return error
    }

    const payload = await request.json().catch(() => null)
    const fields = validatePaymentFields(payload)
    if (fields.error) {
      return json(400, { error: fields.error })
    }

    const config = getIyzicoConfig()
    if (!TEACHER_SEAT_BILLING_CYCLES[fields.billingCycle](config)) {
      return json(503, { error: 'Ek öğrenci paketi şu anda satın alınamıyor. Lütfen daha sonra tekrar deneyin.' })
    }

    const quota = await getTeacherQuota(teacherUserId)
    if (quota.isActive && quota.remainingSeats > 0) {
      return json(409, { error: 'Zaten kullanabileceğiniz bir öğrenci hakkınız var.' })
    }

    const result = await initializeParentSubscriptionCheckout({
      conversationId: teacherUserId,
      ...fields,
      planKind: 'teacherSeat',
      fullName: teacherFullName,
      phone: teacherPhone,
    })

    return json(200, { checkoutFormContent: result.checkoutFormContent, token: result.token })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Ödeme servisi yapılandırması eksik.' })
    }
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    console.error('initiateTeacherSeatCheckoutHandler failed', error)
    return json(500, { error: `Ödeme başlatılamadı. (${error.message})` })
  }
}

// Henüz hiçbir hesabı olmayan bir veli için: kayıt bilgilerini + ödeme bilgilerini birlikte alır.
// "DENEME" kupon kodu varsa iyzico'ya hiç gitmeden hesabı anında ücretsiz açar; aksi halde hesabı
// dbo.Users'a YAZMADAN dbo.PendingParentRegistrations'a bekleyen bir kayıt bırakır ve iyzico
// checkout formunu bu bekleyen kaydın id'sini conversationId olarak kullanarak başlatır — gerçek
// hesap yalnızca ödeme onaylandığında iyzicoCheckoutCallbackHandler içinde oluşturulur.
async function initiateIyzicoCheckoutForNewParentHandler(request) {
  try {
    const payload = await request.json().catch(() => null)
    if (!payload) {
      return json(400, { error: 'Geçersiz istek gövdesi.' })
    }

    const registration = validateParentRegistrationPayload(payload)
    if (registration.error) {
      return json(400, { error: registration.error })
    }
    const { fullName, phone } = registration

    const fields = validatePaymentFields(payload)
    if (fields.error) {
      return json(400, { error: fields.error })
    }

    const antiAbuse = await runRegistrationAntiAbuseChecks(request, payload)
    if (antiAbuse.error) {
      return json(antiAbuse.status, { error: antiAbuse.error })
    }

    const existingDb = await withRequest({ phone: { type: sql.NVarChar(20), value: phone } })
    const existingResult = await existingDb.query('SELECT TOP 1 id FROM dbo.Users WHERE phone_number = @phone;')
    if (existingResult.recordset[0]) {
      return json(409, { error: 'Bu telefon numarasıyla zaten bir hesabınız var. Giriş yapın.' })
    }

    const hasTrialCoupon = String(payload.couponCode || '').trim().toUpperCase() === TRIAL_COUPON_CODE
    if (hasTrialCoupon) {
      const user = await createCompParentAccount({ fullName, phone, email: fields.email })
      const token = createSessionToken(user)
      return json(201, { user }, createSessionHeaders(token))
    }

    const passwordHash = await hashPassword(defaultPasswordForPhone(phone))
    const now = new Date()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    const insertDb = await withRequest({
      fullName: { type: sql.NVarChar(120), value: fullName },
      phone: { type: sql.NVarChar(20), value: phone },
      email: { type: sql.NVarChar(320), value: fields.email },
      passwordHash: { type: sql.NVarChar(255), value: passwordHash },
      aydinlatmaAt: { type: sql.DateTime2, value: now },
      kvkkAt: { type: sql.DateTime2, value: now },
      expiresAt: { type: sql.DateTime2, value: expiresAt },
    })
    const insertResult = await insertDb.query(`
      INSERT INTO dbo.PendingParentRegistrations
        (full_name, phone_number, email, password_hash, aydinlatma_accepted_at, kvkk_accepted_at, expires_at)
      OUTPUT inserted.id
      VALUES (@fullName, @phone, @email, @passwordHash, @aydinlatmaAt, @kvkkAt, @expiresAt);
    `)
    const pendingId = insertResult.recordset[0].id

    const result = await initializeParentSubscriptionCheckout({
      conversationId: pendingId,
      ...fields,
      fullName,
      phone,
    })

    return json(200, { checkoutFormContent: result.checkoutFormContent, token: result.token })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Ödeme servisi yapılandırması eksik.' })
    }
    if (error.number === 2601 || error.number === 2627) {
      return json(409, { error: 'Bu telefon numarasıyla zaten bir hesabınız var. Giriş yapın.' })
    }

    console.error('initiateIyzicoCheckoutForNewParentHandler failed', error)
    return json(500, { error: `Ödeme başlatılamadı. (${error.message})` })
  }
}

async function readCallbackToken(request) {
  const queryToken = request.query.get('token')
  if (queryToken) {
    return queryToken
  }

  try {
    const form = await request.formData()
    return form.get('token')
  } catch {
    return null
  }
}

async function recordEntitlementEvent({ providerEventId, eventType, appUserId, rawPayload }) {
  const eventDb = await withRequest({
    provider: { type: sql.NVarChar(20), value: 'iyzico' },
    providerEventId: { type: sql.NVarChar(200), value: String(providerEventId) },
    eventType: { type: sql.NVarChar(60), value: eventType },
    appUserId: { type: sql.NVarChar(120), value: String(appUserId) },
    rawPayload: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(rawPayload) },
  })

  try {
    await eventDb.query(`
      INSERT INTO dbo.EntitlementEvents (provider, provider_event_id, event_type, app_user_id, raw_payload)
      VALUES (@provider, @providerEventId, @eventType, @appUserId, @rawPayload);
    `)
    return true
  } catch (error) {
    if (error.number === 2601 || error.number === 2627) {
      return false
    }
    throw error
  }
}

function redirectTo(url, extraHeaders = {}) {
  return { status: 302, headers: { Location: url, ...extraHeaders } }
}

async function findExistingParent(id) {
  const requestDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: id } })
  const result = await requestDb.query(`
    SELECT TOP 1 id, full_name, email, phone_number, role, is_admin, can_manage_library, last_login_at,
           created_at, aydinlatma_accepted_at, kvkk_accepted_at, teacher_subject_ids_json
    FROM dbo.Users WHERE id = @id;
  `)
  return result.recordset[0] || null
}

async function findExistingTeacher(id) {
  const requestDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: id } })
  const result = await requestDb.query(`
    SELECT TOP 1 id FROM dbo.Users WHERE id = @id AND role = 'ogretmen';
  `)
  return result.recordset[0] || null
}

async function consumePendingParentRegistration(id) {
  const requestDb = await withRequest({ id: { type: sql.UniqueIdentifier, value: id } })
  const result = await requestDb.query(`
    SELECT TOP 1 id, full_name, phone_number, email, password_hash, aydinlatma_accepted_at, kvkk_accepted_at
    FROM dbo.PendingParentRegistrations
    WHERE id = @id AND consumed_at IS NULL AND expires_at > SYSUTCDATETIME();
  `)
  return result.recordset[0] || null
}

// Bekleyen kaydı gerçek dbo.Users satırına dönüştürür ve pending satırı tüketildi olarak işaretler
// — tek transaction, ödeme onaylandıktan sonra iyzicoCheckoutCallbackHandler'dan çağrılır.
async function createParentFromPendingRegistration(pending) {
  return withTransaction(async (requestInTransaction) => {
    const insertUserDb = requestInTransaction({
      fullName: { type: sql.NVarChar(120), value: pending.full_name },
      phone: { type: sql.NVarChar(20), value: pending.phone_number },
      email: { type: sql.NVarChar(320), value: pending.email },
      passwordHash: { type: sql.NVarChar(255), value: pending.password_hash },
      aydinlatmaAt: { type: sql.DateTime2, value: pending.aydinlatma_accepted_at },
      kvkkAt: { type: sql.DateTime2, value: pending.kvkk_accepted_at },
    })
    const result = await insertUserDb.query(`
      INSERT INTO dbo.Users (full_name, phone_number, email, password_hash, role, aydinlatma_accepted_at, kvkk_accepted_at)
      OUTPUT inserted.id, inserted.full_name, inserted.email, inserted.phone_number, inserted.role,
             inserted.is_admin, inserted.can_manage_library, inserted.last_login_at, inserted.created_at,
             inserted.aydinlatma_accepted_at, inserted.kvkk_accepted_at, inserted.teacher_subject_ids_json
      VALUES (@fullName, @phone, @email, @passwordHash, 'ebeveyn', @aydinlatmaAt, @kvkkAt);
    `)
    const insertedUser = sanitizeUser(result.recordset[0])

    const consumeDb = requestInTransaction({ id: { type: sql.UniqueIdentifier, value: pending.id } })
    await consumeDb.query(`
      UPDATE dbo.PendingParentRegistrations SET consumed_at = SYSUTCDATETIME() WHERE id = @id;
    `)

    return insertedUser
  })
}

async function iyzicoCheckoutCallbackHandler(request) {
  const config = getIyzicoConfig()
  const failureUrl = `${config.webRedirectBaseUrl}/odeme/sonuc?durum=hata`

  try {
    const token = await readCallbackToken(request)
    if (!token) {
      return redirectTo(failureUrl)
    }

    const result = await retrieveSubscriptionCheckoutForm({ checkoutFormToken: token })
    const data = result.data
    const conversationId = result.conversationId

    if (!conversationId || data.subscriptionStatus !== 'ACTIVE') {
      return redirectTo(failureUrl)
    }

    // Ek çocuk (çocuk-koltuğu) paketi — conversationId her zaman mevcut bir velinin Users.id'sidir.
    if (isChildSeatPlanRef(config, data.pricingPlanReferenceCode)) {
      const childSeatParent = await findExistingParent(conversationId)
      if (!childSeatParent) {
        return redirectTo(failureUrl)
      }
      const isNewChildSeatEvent = await recordEntitlementEvent({
        providerEventId: data.referenceCode,
        eventType: 'child_seat.checkout.completed',
        appUserId: childSeatParent.id,
        rawPayload: data,
      })
      if (isNewChildSeatEvent) {
        await insertChildSeatSubscription({
          parentId: childSeatParent.id,
          status: 'active',
          period: data.pricingPlanReferenceCode === config.childYearlyPlanRef ? 'yearly' : 'monthly',
          productId: data.pricingPlanReferenceCode,
          subscriptionReferenceCode: data.referenceCode,
          currentPeriodEnd: data.endDate ? new Date(data.endDate) : null,
        })
      }
      return redirectTo(`${config.webRedirectBaseUrl}/parent/students?cocuk_koltugu=eklendi`)
    }

    // Öğretmen ek öğrenci koltuğu — conversationId her zaman mevcut bir öğretmenin Users.id'sidir.
    if (isTeacherSeatPlanRef(config, data.pricingPlanReferenceCode)) {
      const seatTeacher = await findExistingTeacher(conversationId)
      if (!seatTeacher) {
        return redirectTo(failureUrl)
      }
      const isNewTeacherSeatEvent = await recordEntitlementEvent({
        providerEventId: data.referenceCode,
        eventType: 'teacher_seat.checkout.completed',
        appUserId: seatTeacher.id,
        rawPayload: data,
      })
      if (isNewTeacherSeatEvent) {
        await insertTeacherSeatSubscription({
          teacherId: seatTeacher.id,
          status: 'active',
          period: data.pricingPlanReferenceCode === config.teacherSeatYearlyPlanRef ? 'yearly' : 'monthly',
          productId: data.pricingPlanReferenceCode,
          subscriptionReferenceCode: data.referenceCode,
          currentPeriodEnd: data.endDate ? new Date(data.endDate) : null,
        })
      }
      return redirectTo(`${config.webRedirectBaseUrl}/teacher/students?koltuk=eklendi`)
    }

    // conversationId ya mevcut bir velinin (yenileme ödemesi) dbo.Users.id'si, ya da henüz hesabı
    // olmayan yeni bir velinin dbo.PendingParentRegistrations.id'sidir — hangisi olduğunu burada
    // ayırt ediyoruz. İkinci durumda gerçek hesap ancak bu noktada, ödeme onaylandıktan sonra oluşur.
    const existingParent = await findExistingParent(conversationId)
    let parentId = existingParent?.id
    let sessionHeaders = {}

    if (!existingParent) {
      const pending = await consumePendingParentRegistration(conversationId)
      if (!pending) {
        return redirectTo(failureUrl)
      }
      const newUser = await createParentFromPendingRegistration(pending)
      parentId = newUser.id
      const sessionToken = createSessionToken(newUser)
      sessionHeaders = createSessionHeaders(sessionToken)
    }

    const isNew = await recordEntitlementEvent({
      providerEventId: data.referenceCode,
      eventType: 'checkout.completed',
      appUserId: parentId,
      rawPayload: data,
    })

    if (isNew) {
      await upsertParentEntitlementFromIyzico({
        parentId,
        status: 'active',
        pricingPlanReferenceCode: data.pricingPlanReferenceCode,
        billingCycle: data.pricingPlanReferenceCode === config.parentYearlyPlanRef ? 'yearly' : 'monthly',
        subscriptionReferenceCode: data.referenceCode,
        currentPeriodEnd: data.endDate ? new Date(data.endDate) : null,
      })
    }

    return redirectTo(`${config.webRedirectBaseUrl}/odeme/sonuc?durum=basarili`, sessionHeaders)
  } catch (error) {
    console.error('iyzicoCheckoutCallbackHandler failed', error)
    return redirectTo(failureUrl)
  }
}

function verifyWebhookSignature(request, rawBody) {
  const { secretKey } = getIyzicoConfig()
  const signature = request.headers.get('x-iyz-signature-v3')
  if (!signature) {
    return false
  }

  let payload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return false
  }

  const message = [
    payload.iyziEventType,
    payload.iyziReferenceCode,
    payload.subscriptionReferenceCode,
    payload.orderReferenceCode,
    payload.customerReferenceCode,
  ].join('')

  const computed = crypto.createHmac('sha256', secretKey).update(message).digest('hex')

  const provided = Buffer.from(signature)
  const expected = Buffer.from(computed)
  if (provided.length !== expected.length) {
    return false
  }
  return crypto.timingSafeEqual(provided, expected)
}

async function iyzicoWebhookHandler(request) {
  try {
    const rawBody = await request.text()
    if (!verifyWebhookSignature(request, rawBody)) {
      return json(401, { error: 'Geçersiz webhook imzası.' })
    }

    const payload = JSON.parse(rawBody)
    const { iyziEventType, iyziReferenceCode, subscriptionReferenceCode } = payload

    if (!iyziEventType || !iyziReferenceCode || !subscriptionReferenceCode) {
      return json(400, { error: 'Geçersiz webhook gövdesi.' })
    }

    // Abonelik ya taban veli planı (Entitlements) ya da ek çocuk paketidir (ChildSeatSubscriptions).
    const parentId = await findParentIdBySubscriptionReferenceCode(subscriptionReferenceCode)
    const childSeatParentId = parentId
      ? null
      : await findParentIdByChildSeatSubscriptionReferenceCode(subscriptionReferenceCode)
    const teacherSeatTeacherId =
      parentId || childSeatParentId
        ? null
        : await findTeacherIdByTeacherSeatSubscriptionReferenceCode(subscriptionReferenceCode)

    if (!parentId && !childSeatParentId && !teacherSeatTeacherId) {
      return json(200, { ok: true, skipped: 'unknown_subscription' })
    }

    const isNew = await recordEntitlementEvent({
      providerEventId: iyziReferenceCode,
      eventType: iyziEventType,
      appUserId: parentId || childSeatParentId || teacherSeatTeacherId,
      rawPayload: payload,
    })

    if (!isNew) {
      return json(200, { ok: true, deduplicated: true })
    }

    if (teacherSeatTeacherId) {
      if (iyziEventType === 'subscription.order.success') {
        const subscription = await retrieveSubscription({ subscriptionReferenceCode })
        await updateTeacherSeatSubscriptionFromIyzico({
          subscriptionReferenceCode,
          status: 'active',
          currentPeriodEnd: subscription.data.endDate ? new Date(subscription.data.endDate) : null,
        })
      } else if (iyziEventType === 'subscription.order.failure') {
        await updateTeacherSeatSubscriptionFromIyzico({ subscriptionReferenceCode, status: 'grace_period' })
      } else if (iyziEventType === 'subscription.cancelled' || iyziEventType === 'subscription.expired') {
        await updateTeacherSeatSubscriptionFromIyzico({ subscriptionReferenceCode, status: 'cancelled' })
      }
      return json(200, { ok: true })
    }

    if (childSeatParentId) {
      if (iyziEventType === 'subscription.order.success') {
        const subscription = await retrieveSubscription({ subscriptionReferenceCode })
        await updateChildSeatSubscriptionFromIyzico({
          subscriptionReferenceCode,
          status: 'active',
          currentPeriodEnd: subscription.data.endDate ? new Date(subscription.data.endDate) : null,
        })
      } else if (iyziEventType === 'subscription.order.failure') {
        await updateChildSeatSubscriptionFromIyzico({ subscriptionReferenceCode, status: 'grace_period' })
      } else if (iyziEventType === 'subscription.cancelled' || iyziEventType === 'subscription.expired') {
        await updateChildSeatSubscriptionFromIyzico({ subscriptionReferenceCode, status: 'cancelled' })
      }
      return json(200, { ok: true })
    }

    if (iyziEventType === 'subscription.order.success') {
      const subscription = await retrieveSubscription({ subscriptionReferenceCode })
      await upsertParentEntitlementFromIyzico({
        parentId,
        status: 'active',
        pricingPlanReferenceCode: subscription.data.pricingPlanReferenceCode,
        billingCycle: subscription.data.pricingPlanReferenceCode === getIyzicoConfig().parentYearlyPlanRef ? 'yearly' : 'monthly',
        subscriptionReferenceCode,
        currentPeriodEnd: subscription.data.endDate ? new Date(subscription.data.endDate) : null,
      })
    } else if (iyziEventType === 'subscription.order.failure') {
      await updateParentEntitlementStatus(parentId, 'grace_period')
    }

    return json(200, { ok: true })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Ödeme servisi yapılandırması eksik.' })
    }

    console.error('iyzicoWebhookHandler failed', error)
    return json(500, { error: 'Webhook işlenemedi.' })
  }
}

module.exports = {
  initiateIyzicoCheckoutHandler,
  initiateChildSeatCheckoutHandler,
  initiateTeacherSeatCheckoutHandler,
  initiateIyzicoCheckoutForNewParentHandler,
  iyzicoCheckoutCallbackHandler,
  iyzicoWebhookHandler,
}
