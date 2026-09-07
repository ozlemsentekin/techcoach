const { sql, withRequest } = require('./db')
const { isConfigError } = require('./config')
const { clearSessionHeaders, json } = require('./http')
const { requireAdmin } = require('./admin')
const { isSessionError } = require('./security')
const { Iyzipay, createSubscriptionProduct, createSubscriptionPricingPlan } = require('./iyzicoClient')

// Kayıt / ödeme / koltuk satın alma ekranlarında GÖRÜNEN fiyatlar ve pazarlama
// kartı metinleri. Fiilen tahsil edilen tutar iyzico abonelik planlarına bağlıdır
// (bkz. api/sql/create-pricing-plans-schema.sql başlığındaki not).
const PLAN_KEYS = ['parent', 'teacher', 'teacher_seat', 'child_seat']

// "iyzico planını yenile" (yarı-otomatik Katman 2) için plan başına iyzico ürün/plan
// meta bilgisi. Yalnızca iyzico aboneliğine bağlı paketler burada. Öğretmen taban
// planı ('teacher') henüz iyzico'ya bağlı olmadığından listede yok.
// setup-iyzico-*.js scriptleriyle aynı isimler kullanılır.
const IYZICO_PLAN_SETUP = {
  parent: {
    productName: 'TechCoach Veli Aboneliği',
    productDescription: 'TechCoach veli panel erişimi için aylık/yıllık abonelik',
    monthlyName: 'Veli Aylık',
    yearlyName: 'Veli Yıllık',
    monthlyEnv: 'IYZICO_PARENT_MONTHLY_PLAN_REF',
    yearlyEnv: 'IYZICO_PARENT_YEARLY_PLAN_REF',
  },
  teacher_seat: {
    productName: 'TechCoach Öğretmen Ek Öğrenci Paketi',
    productDescription: 'Öğretmenin panel kotasının kapsadığından fazla öğrenci için ek koltuk aboneliği',
    monthlyName: 'Öğretmen Ek Öğrenci Aylık',
    yearlyName: 'Öğretmen Ek Öğrenci Yıllık',
    monthlyEnv: 'IYZICO_TEACHER_SEAT_MONTHLY_PLAN_REF',
    yearlyEnv: 'IYZICO_TEACHER_SEAT_YEARLY_PLAN_REF',
  },
  child_seat: {
    productName: 'TechCoach Ek Çocuk Paketi',
    productDescription: 'Veli planının kapsadığından fazla çocuk profili için ek kota aboneliği',
    monthlyName: 'Ek Çocuk Aylık',
    yearlyName: 'Ek Çocuk Yıllık',
    monthlyEnv: 'IYZICO_CHILD_MONTHLY_PLAN_REF',
    yearlyEnv: 'IYZICO_CHILD_YEARLY_PLAN_REF',
  },
}

const IYZICO_REFRESHABLE_KEYS = Object.keys(IYZICO_PLAN_SETUP)

function parseFeatures(value) {
  if (!value) {
    return []
  }
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

function sanitizePlan(record) {
  return {
    planKey: record.plan_key,
    title: record.title,
    monthlyPrice: record.monthly_price,
    yearlyPrice: record.yearly_price,
    yearlyBadge: record.yearly_badge,
    features: parseFeatures(record.features_json),
    note: record.note,
    sortOrder: record.sort_order,
    updatedAt: record.updated_at,
    iyzicoManaged: IYZICO_REFRESHABLE_KEYS.includes(record.plan_key),
  }
}

async function fetchAllPlans() {
  const db = await withRequest({})
  const result = await db.query(`
    SELECT plan_key, title, monthly_price, yearly_price, yearly_badge, features_json, note, sort_order, updated_at
    FROM dbo.PricingPlans
    ORDER BY sort_order ASC, plan_key ASC;
  `)
  return result.recordset.map(sanitizePlan)
}

// ---- Genel (herkese açık, oturum gerektirmez) ----

async function getPublicPricingHandler() {
  try {
    const plans = await fetchAllPlans()
    return json(200, { plans: Object.fromEntries(plans.map((plan) => [plan.planKey, plan])) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Fiyatlandırma servisi yapılandırması eksik.' })
    }
    console.error('getPublicPricingHandler failed', error)
    return json(500, { error: 'Fiyatlandırma bilgisi yüklenemedi.' })
  }
}

// ---- Admin ----

async function listPricingPlansHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }
    return json(200, { plans: await fetchAllPlans() })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }
    console.error('listPricingPlansHandler failed', error)
    return json(500, { error: 'Fiyatlandırma planları yüklenemedi.' })
  }
}

function normalizePrice(value, { required }) {
  if (value === null || value === undefined || value === '') {
    return required ? { error: 'zorunlu.' } : { value: null }
  }
  const numeric = Number(value)
  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 1000000) {
    return { error: '0 ile 1.000.000 arasında bir tam sayı olmalı.' }
  }
  return { value: numeric }
}

async function updatePricingPlanHandler(request) {
  try {
    const { error, session } = await requireAdmin(request)
    if (error) {
      return error
    }

    const planKey = request.params.planKey
    if (!PLAN_KEYS.includes(planKey)) {
      return json(404, { error: 'Plan bulunamadı.' })
    }

    const payload = await request.json().catch(() => null)
    if (!payload) {
      return json(400, { error: 'Geçersiz istek.' })
    }

    const title = payload.title?.trim()
    if (!title || title.length < 2) {
      return json(400, { error: 'Başlık en az 2 karakter olmalı.' })
    }

    const monthly = normalizePrice(payload.monthlyPrice, { required: true })
    if (monthly.error) {
      return json(400, { error: `Aylık fiyat ${monthly.error}` })
    }

    const yearly = normalizePrice(payload.yearlyPrice, { required: false })
    if (yearly.error) {
      return json(400, { error: `Yıllık fiyat ${yearly.error}` })
    }

    const yearlyBadge = payload.yearlyBadge?.trim() || null
    if (yearlyBadge && yearlyBadge.length > 60) {
      return json(400, { error: 'Yıllık rozet en fazla 60 karakter olmalı.' })
    }

    const note = payload.note?.trim() || null
    if (note && note.length > 400) {
      return json(400, { error: 'Not en fazla 400 karakter olmalı.' })
    }

    const features = Array.isArray(payload.features)
      ? payload.features.map((item) => String(item).trim()).filter(Boolean)
      : []
    const featuresJson = features.length ? JSON.stringify(features) : null

    const db = await withRequest({
      planKey: { type: sql.NVarChar(40), value: planKey },
      title: { type: sql.NVarChar(120), value: title },
      monthlyPrice: { type: sql.Int, value: monthly.value },
      yearlyPrice: { type: sql.Int, value: yearly.value },
      yearlyBadge: { type: sql.NVarChar(60), value: yearlyBadge },
      featuresJson: { type: sql.NVarChar(sql.MAX), value: featuresJson },
      note: { type: sql.NVarChar(400), value: note },
      updatedBy: { type: sql.UniqueIdentifier, value: session.sub },
    })
    const result = await db.query(`
      UPDATE dbo.PricingPlans
      SET title = @title,
          monthly_price = @monthlyPrice,
          yearly_price = @yearlyPrice,
          yearly_badge = @yearlyBadge,
          features_json = @featuresJson,
          note = @note,
          updated_by_user_id = @updatedBy
      OUTPUT inserted.plan_key, inserted.title, inserted.monthly_price, inserted.yearly_price,
             inserted.yearly_badge, inserted.features_json, inserted.note, inserted.sort_order, inserted.updated_at
      WHERE plan_key = @planKey;
    `)

    if (result.recordset.length === 0) {
      return json(404, { error: 'Plan bulunamadı.' })
    }

    return json(200, { plan: sanitizePlan(result.recordset[0]) })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Kimlik doğrulama servisi yapılandırması eksik.' })
    }
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }
    console.error('updatePricingPlanHandler failed', error)
    return json(500, { error: 'Plan güncellenemedi.' })
  }
}

// Admin ekranındaki "iyzico planını yenile" butonu. DB'deki güncel fiyatla iyzico'da
// YENİ bir abonelik ürünü + fiyat planı/planları oluşturur ve yeni referans kodlarını
// döner. iyzico fiyat planlarının fiyatı düzenlenemediğinden tek yol budur. Checkout
// akışı hâlâ env değişkenlerinden okuduğundan, admin dönen kodları Azure App Settings'e
// yazana kadar CANLI tahsilat değişmez. Mevcut aboneler eski planda kalır.
async function refreshIyzicoPlanHandler(request) {
  try {
    const { error } = await requireAdmin(request)
    if (error) {
      return error
    }

    const planKey = request.params.planKey
    const setup = IYZICO_PLAN_SETUP[planKey]
    if (!setup) {
      return json(400, { error: 'Bu paket iyzico aboneliğine bağlı değil.' })
    }

    const db = await withRequest({ planKey: { type: sql.NVarChar(40), value: planKey } })
    const result = await db.query(`
      SELECT monthly_price, yearly_price FROM dbo.PricingPlans WHERE plan_key = @planKey;
    `)
    const plan = result.recordset[0]
    if (!plan) {
      return json(404, { error: 'Plan bulunamadı.' })
    }

    const stamp = Date.now()
    const product = await createSubscriptionProduct({
      locale: Iyzipay.LOCALE.TR,
      conversationId: `techcoach-refresh-${planKey}-product-${stamp}`,
      name: setup.productName,
      description: setup.productDescription,
    })
    const productReferenceCode = product.data.referenceCode

    async function makePlan(name, price, interval, conversationSuffix) {
      const created = await createSubscriptionPricingPlan({
        locale: Iyzipay.LOCALE.TR,
        conversationId: `techcoach-refresh-${planKey}-${conversationSuffix}-${stamp}`,
        productReferenceCode,
        name,
        price: String(price),
        currencyCode: Iyzipay.CURRENCY.TRY,
        paymentInterval: interval,
        paymentIntervalCount: 1,
        planPaymentType: 'RECURRING',
      })
      return created.data.referenceCode
    }

    const settings = [
      {
        key: setup.monthlyEnv,
        referenceCode: await makePlan(setup.monthlyName, plan.monthly_price, 'MONTHLY', 'monthly'),
        price: plan.monthly_price,
        interval: 'MONTHLY',
      },
    ]

    if (plan.yearly_price != null) {
      settings.push({
        key: setup.yearlyEnv,
        referenceCode: await makePlan(setup.yearlyName, plan.yearly_price, 'YEARLY', 'yearly'),
        price: plan.yearly_price,
        interval: 'YEARLY',
      })
    }

    return json(200, { productReferenceCode, settings })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'iyzico yapılandırması eksik.' })
    }
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }
    console.error('refreshIyzicoPlanHandler failed', error)
    return json(502, { error: `iyzico planı oluşturulamadı: ${error.message}` })
  }
}

module.exports = {
  getPublicPricingHandler,
  listPricingPlansHandler,
  updatePricingPlanHandler,
  refreshIyzicoPlanHandler,
}
