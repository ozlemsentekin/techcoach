const crypto = require('crypto')
const { sql, withRequest } = require('./db')
const { isConfigError, getIyzicoConfig } = require('./config')
const { json } = require('./http')
const { isSessionError } = require('./security')
const { requireParentSession } = require('./students')
const {
  hasActiveParentEntitlement,
  upsertParentEntitlementFromIyzico,
  updateParentEntitlementStatus,
  findParentIdBySubscriptionReferenceCode,
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

async function getParentProfile(parentId) {
  const requestDb = await withRequest({ parentId: { type: sql.UniqueIdentifier, value: parentId } })
  const result = await requestDb.query(`
    SELECT TOP 1 full_name, email, phone_number FROM dbo.Users WHERE id = @parentId;
  `)
  return result.recordset[0] || null
}

async function initiateIyzicoCheckoutHandler(request) {
  try {
    const { error, parentId } = await requireParentSession(request)
    if (error) {
      return error
    }

    const payload = await request.json().catch(() => null)
    const billingCycle = payload?.billingCycle
    const identityNumber = payload?.identityNumber
    const address = payload?.address || {}

    if (!BILLING_CYCLES[billingCycle]) {
      return json(400, { error: 'Geçerli bir ödeme periyodu seçin.' })
    }
    if (!isValidIdentityNumber(identityNumber)) {
      return json(400, { error: 'Geçerli bir TC Kimlik No girin.' })
    }
    if (!address.addressLine || !address.city || !address.zipCode) {
      return json(400, { error: 'Adres, il ve posta kodu bilgilerini girin.' })
    }

    if (await hasActiveParentEntitlement(parentId)) {
      return json(409, { error: 'Zaten aktif bir aboneliğiniz var.' })
    }

    const parent = await getParentProfile(parentId)
    if (!parent) {
      return json(401, { error: 'Oturum geçersiz.' })
    }

    const config = getIyzicoConfig()
    const pricingPlanReferenceCode = BILLING_CYCLES[billingCycle](config)
    const { name, surname } = splitFullName(parent.full_name)

    const billingAddress = {
      contactName: parent.full_name,
      city: address.city,
      district: address.district || address.city,
      country: 'Turkey',
      address: address.addressLine,
      zipCode: address.zipCode,
    }

    const result = await initializeSubscriptionCheckoutForm({
      locale: Iyzipay.LOCALE.TR,
      conversationId: parentId,
      callbackUrl: config.callbackUrl,
      pricingPlanReferenceCode,
      subscriptionInitialStatus: Iyzipay.SUBSCRIPTION_INITIAL_STATUS.ACTIVE,
      customer: {
        name,
        surname,
        identityNumber,
        email: parent.email || undefined,
        gsmNumber: parent.phone_number ? `+9${parent.phone_number}` : undefined,
        billingAddress,
        shippingAddress: billingAddress,
      },
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
    return json(500, { error: 'Ödeme başlatılamadı.' })
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

function redirectTo(url) {
  return { status: 302, headers: { Location: url } }
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
    const parentId = result.conversationId

    if (!parentId || data.subscriptionStatus !== 'ACTIVE') {
      return redirectTo(failureUrl)
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

    return redirectTo(`${config.webRedirectBaseUrl}/odeme/sonuc?durum=basarili`)
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

    const parentId = await findParentIdBySubscriptionReferenceCode(subscriptionReferenceCode)
    if (!parentId) {
      return json(200, { ok: true, skipped: 'unknown_subscription' })
    }

    const isNew = await recordEntitlementEvent({
      providerEventId: iyziReferenceCode,
      eventType: iyziEventType,
      appUserId: parentId,
      rawPayload: payload,
    })

    if (!isNew) {
      return json(200, { ok: true, deduplicated: true })
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
  iyzicoCheckoutCallbackHandler,
  iyzicoWebhookHandler,
}
