const { sql, withRequest } = require('./db')
const { clearSessionHeaders, json } = require('./http')
const { isSessionError } = require('./security')
const { Iyzipay, createSubscriptionProduct, createSubscriptionPricingPlan } = require('./iyzicoClient')

// requireAdmin, gecikmeli (fonksiyon içinde) require edilir: admin.js kendisi auth.js'i
// require ediyor ve auth.js validate-coupon için bu dosyadaki resolveCoupon'u kullanıyor —
// modül üst seviyesinde require edilirse auth.js ↔ coupons.js ↔ admin.js döngüsü oluşur.
function getRequireAdmin() {
  return require('./admin').requireAdmin
}

// Bir kupon %100 indirimli olsa bile en az bu tutar (TL) tahsil edilir — abonelik tekrarlayan
// olduğundan gerçek bir kart kaydedilmesi ve gelecek dönemlerde otomatik çekim yapılabilmesi şart.
const MIN_CHARGE_TRY = 1

function computeDiscountedPrice(basePrice, discountPercent) {
  const discounted = Math.round((basePrice * (100 - discountPercent)) / 100)
  return Math.max(MIN_CHARGE_TRY, discounted)
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase()
}

function sanitizeCoupon(record) {
  return {
    id: record.id,
    code: record.code,
    discountPercent: record.discount_percent,
    description: record.description,
    isActive: Boolean(record.is_active),
    baseMonthlyPrice: record.base_monthly_price,
    baseYearlyPrice: record.base_yearly_price,
    monthlyPrice: computeDiscountedPrice(record.base_monthly_price, record.discount_percent),
    yearlyPrice:
      record.base_yearly_price != null ? computeDiscountedPrice(record.base_yearly_price, record.discount_percent) : null,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

const COUPON_COLUMNS = `id, code, discount_percent, description, is_active, base_monthly_price, base_yearly_price,
       iyzico_monthly_plan_ref, iyzico_yearly_plan_ref, created_at, updated_at`

async function fetchParentPlanPrices() {
  const db = await withRequest({})
  const result = await db.query(`SELECT monthly_price, yearly_price FROM dbo.PricingPlans WHERE plan_key = 'parent';`)
  const plan = result.recordset[0]
  if (!plan) {
    throw new Error('Veli paketi fiyatı bulunamadı.')
  }
  return plan
}

// ---- Admin ----

async function listCouponsHandler(request) {
  try {
    const { error } = await getRequireAdmin()(request)
    if (error) {
      return error
    }
    const db = await withRequest({})
    const result = await db.query(`
      SELECT ${COUPON_COLUMNS} FROM dbo.Coupons ORDER BY created_at DESC;
    `)
    return json(200, { coupons: result.recordset.map(sanitizeCoupon) })
  } catch (error) {
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }
    console.error('listCouponsHandler failed', error)
    return json(500, { error: 'Kuponlar yüklenemedi.' })
  }
}

// Kupon oluşturulduğunda dbo.PricingPlans('parent')'ın GÜNCEL fiyatından indirimli tutar
// hesaplanır ve iyzico'da bu tutara sabitlenmiş yeni bir ürün + fiyat planı oluşturulur —
// referans kodları kupon satırında saklanır, admin panelinde ekstra bir adım (env var
// güncelleme) gerekmez (bkz. pricing.js refreshIyzicoPlanHandler'daki manuel süreçle farkı).
async function createCouponHandler(request) {
  try {
    const { error, session } = await getRequireAdmin()(request)
    if (error) {
      return error
    }

    const payload = await request.json().catch(() => null)
    if (!payload) {
      return json(400, { error: 'Geçersiz istek.' })
    }

    const code = normalizeCode(payload.code)
    if (!/^[A-Z0-9_-]{3,50}$/.test(code)) {
      return json(400, { error: 'Kupon kodu 3-50 karakter olmalı, sadece harf/rakam/tire/alt çizgi içerebilir.' })
    }

    const discountPercent = Number(payload.discountPercent)
    if (!Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 100) {
      return json(400, { error: 'İndirim yüzdesi 1 ile 100 arasında bir tam sayı olmalı.' })
    }

    const description = payload.description?.trim() || null
    if (description && description.length > 255) {
      return json(400, { error: 'Açıklama en fazla 255 karakter olmalı.' })
    }

    const basePlan = await fetchParentPlanPrices()
    const monthlyDiscounted = computeDiscountedPrice(basePlan.monthly_price, discountPercent)
    const yearlyDiscounted =
      basePlan.yearly_price != null ? computeDiscountedPrice(basePlan.yearly_price, discountPercent) : null

    const stamp = Date.now()
    const product = await createSubscriptionProduct({
      locale: Iyzipay.LOCALE.TR,
      conversationId: `techcoach-coupon-${code}-product-${stamp}`,
      name: `TechCoach Veli Aboneliği — Kupon ${code}`,
      description: `"${code}" kuponuyla %${discountPercent} indirimli veli aboneliği`,
    })
    const productReferenceCode = product.data.referenceCode

    async function makePlan(name, price, interval, suffix) {
      const created = await createSubscriptionPricingPlan({
        locale: Iyzipay.LOCALE.TR,
        conversationId: `techcoach-coupon-${code}-${suffix}-${stamp}`,
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

    const monthlyPlanRef = await makePlan(`Veli Aylık — ${code}`, monthlyDiscounted, 'MONTHLY', 'monthly')
    const yearlyPlanRef =
      yearlyDiscounted != null ? await makePlan(`Veli Yıllık — ${code}`, yearlyDiscounted, 'YEARLY', 'yearly') : null

    const db = await withRequest({
      code: { type: sql.NVarChar(50), value: code },
      discountPercent: { type: sql.Int, value: discountPercent },
      description: { type: sql.NVarChar(255), value: description },
      baseMonthlyPrice: { type: sql.Int, value: basePlan.monthly_price },
      baseYearlyPrice: { type: sql.Int, value: basePlan.yearly_price },
      monthlyPlanRef: { type: sql.NVarChar(100), value: monthlyPlanRef },
      yearlyPlanRef: { type: sql.NVarChar(100), value: yearlyPlanRef },
      createdBy: { type: sql.UniqueIdentifier, value: session.sub },
    })
    const result = await db.query(`
      INSERT INTO dbo.Coupons
        (code, discount_percent, description, base_monthly_price, base_yearly_price,
         iyzico_monthly_plan_ref, iyzico_yearly_plan_ref, created_by_user_id)
      OUTPUT ${COUPON_COLUMNS.split(',').map((c) => `inserted.${c.trim()}`).join(', ')}
      VALUES (@code, @discountPercent, @description, @baseMonthlyPrice, @baseYearlyPrice,
              @monthlyPlanRef, @yearlyPlanRef, @createdBy);
    `)

    return json(201, { coupon: sanitizeCoupon(result.recordset[0]) })
  } catch (error) {
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }
    if (error.number === 2601 || error.number === 2627) {
      return json(409, { error: 'Bu kupon kodu zaten kullanılıyor.' })
    }
    console.error('createCouponHandler failed', error)
    return json(502, { error: `Kupon oluşturulamadı: ${error.message}` })
  }
}

// Kod ve yüzde sonradan değiştirilemez (iyzico planları o değerlere sabitlendiği için) —
// yalnızca aktif/pasif durumu ve açıklama düzenlenebilir. Farklı bir yüzde/kod gerekiyorsa
// kupon silinip yeniden oluşturulmalı.
async function updateCouponHandler(request) {
  try {
    const { error } = await getRequireAdmin()(request)
    if (error) {
      return error
    }

    const couponId = request.params.couponId
    const payload = await request.json().catch(() => null)
    if (!payload) {
      return json(400, { error: 'Geçersiz istek.' })
    }

    const sets = []
    const params = { id: { type: sql.UniqueIdentifier, value: couponId } }

    if (typeof payload.isActive === 'boolean') {
      sets.push('is_active = @isActive')
      params.isActive = { type: sql.Bit, value: payload.isActive }
    }
    if (payload.description !== undefined) {
      const description = payload.description?.trim() || null
      if (description && description.length > 255) {
        return json(400, { error: 'Açıklama en fazla 255 karakter olmalı.' })
      }
      sets.push('description = @description')
      params.description = { type: sql.NVarChar(255), value: description }
    }
    if (!sets.length) {
      return json(400, { error: 'Güncellenecek alan yok.' })
    }
    sets.push('updated_at = SYSUTCDATETIME()')

    const db = await withRequest(params)
    const result = await db.query(`
      UPDATE dbo.Coupons SET ${sets.join(', ')}
      OUTPUT ${COUPON_COLUMNS.split(',').map((c) => `inserted.${c.trim()}`).join(', ')}
      WHERE id = @id;
    `)

    if (!result.recordset.length) {
      return json(404, { error: 'Kupon bulunamadı.' })
    }
    return json(200, { coupon: sanitizeCoupon(result.recordset[0]) })
  } catch (error) {
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }
    console.error('updateCouponHandler failed', error)
    return json(500, { error: 'Kupon güncellenemedi.' })
  }
}

async function deleteCouponHandler(request) {
  try {
    const { error } = await getRequireAdmin()(request)
    if (error) {
      return error
    }
    const couponId = request.params.couponId
    const db = await withRequest({ id: { type: sql.UniqueIdentifier, value: couponId } })
    await db.query('DELETE FROM dbo.Coupons WHERE id = @id;')
    return json(200, { success: true })
  } catch (error) {
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' }, clearSessionHeaders())
    }
    console.error('deleteCouponHandler failed', error)
    return json(500, { error: 'Kupon silinemedi.' })
  }
}

// ---- Paylaşılan: validate-coupon (auth.js) ve ödeme başlatma (payments.js) tarafından kullanılır ----

async function resolveCoupon(rawCode) {
  const code = normalizeCode(rawCode)
  if (!code) {
    return null
  }
  const db = await withRequest({ code: { type: sql.NVarChar(50), value: code } })
  const result = await db.query(`
    SELECT TOP 1 code, discount_percent, description, base_monthly_price, base_yearly_price,
           iyzico_monthly_plan_ref, iyzico_yearly_plan_ref
    FROM dbo.Coupons WHERE code = @code AND is_active = 1;
  `)
  const record = result.recordset[0]
  if (!record) {
    return null
  }
  return {
    code: record.code,
    discountPercent: record.discount_percent,
    description: record.description,
    monthlyPrice: computeDiscountedPrice(record.base_monthly_price, record.discount_percent),
    yearlyPrice:
      record.base_yearly_price != null ? computeDiscountedPrice(record.base_yearly_price, record.discount_percent) : null,
    monthlyPlanRef: record.iyzico_monthly_plan_ref,
    yearlyPlanRef: record.iyzico_yearly_plan_ref,
  }
}

module.exports = {
  listCouponsHandler,
  createCouponHandler,
  updateCouponHandler,
  deleteCouponHandler,
  resolveCoupon,
}
