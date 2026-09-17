// "Üyelik Bilgilerim" self-service sayfası: velinin/öğretmenin kendi abonelik durumunu +
// iyzico'daki gerçek sipariş/tahsilat geçmişini görüntülemesi ve kendi aboneliğini iptal
// edebilmesi. Admin tarafındaki eşdeğeri için bkz. admin.js (setUserActiveHandler/deleteUserHandler).
const { withRequest } = require('./db')
const { json } = require('./http')
const { isConfigError } = require('./config')
const { isSessionError } = require('./security')
const { requireParentSession } = require('./students')
const { requireTeacherSession } = require('./teacherScope')
const { retrieveSubscription } = require('./iyzicoClient')
const {
  getParentStudentQuota,
  getTeacherQuota,
  getParentMembershipOverview,
  getTeacherMembershipOverview,
  findCancellableSubscriptionReferenceCodes,
  cancelSubscriptionsForUser,
} = require('./entitlements')

async function getPlanPrices(planKeys) {
  const uniqueKeys = [...new Set(planKeys)]
  if (!uniqueKeys.length) {
    return new Map()
  }
  const db = await withRequest({})
  const result = await db.query(`
    SELECT plan_key, title, monthly_price, yearly_price
    FROM dbo.PricingPlans WHERE plan_key IN (${uniqueKeys.map((key) => `'${key.replace(/'/g, "''")}'`).join(',')});
  `)
  return new Map(
    result.recordset.map((row) => [
      row.plan_key,
      { title: row.title, monthlyPrice: row.monthly_price, yearlyPrice: row.yearly_price },
    ]),
  )
}

// iyzico'nun subscription/retrieve yanıtındaki `orders` dizisini "hesap hareketleri" tablosu
// için sadeleştirir. Gerçek prod verisiyle doğrulandı (2026-09-17): orderStatus, price/paidPrice,
// startPeriod/endPeriod dolu geliyor; orderReferenceCode ve createdDate bu uç noktada hiç
// gelmiyor (her ikisi de null) — bu yüzden "tarih" olarak dönemin başlangıcı (startPeriod)
// kullanılıyor, referenceCode sadece varsa (ileride) kullanılmak üzere toleranslı okunuyor.
function normalizeOrders(orders, sourceLabel) {
  if (!Array.isArray(orders)) {
    return []
  }
  return orders.map((order) => {
    const amount = order.paidPrice ?? order.price ?? null
    const createdAtMs = Number(order.createdDate)
    const startMs = Number(order.startPeriod)
    const endMs = Number(order.endPeriod)
    const startIso = Number.isFinite(startMs) ? new Date(startMs).toISOString() : null
    return {
      source: sourceLabel,
      referenceCode: order.orderReferenceCode || order.referenceCode || order.id || null,
      status: order.orderStatus || null,
      amount: amount !== null ? Number(amount) : null,
      // iyzico bu uç noktada createdDate döndürmüyor; dönem başlangıcı en yakın gerçek tarih.
      createdAt: Number.isFinite(createdAtMs) ? new Date(createdAtMs).toISOString() : startIso,
      periodStart: startIso,
      periodEnd: Number.isFinite(endMs) ? new Date(endMs).toISOString() : null,
    }
  })
}

// Birden fazla abonelik referansı (taban plan + ek koltuklar) için iyzico'dan paralel sipariş
// geçmişi çeker ve tek bir listede birleştirir. iyzico'ya ulaşılamazsa o kaynağın hareketleri
// atlanır ve `hasError: true` ile işaretlenir — sayfa yine de mevcut plan bilgisiyle açılabilsin.
async function fetchTransactionHistory(subscriptionRefsWithLabels) {
  let hasError = false
  const results = await Promise.all(
    subscriptionRefsWithLabels.map(async ({ subscriptionReferenceCode, label }) => {
      if (!subscriptionReferenceCode) {
        return []
      }
      try {
        const result = await retrieveSubscription({ subscriptionReferenceCode })
        return normalizeOrders(result?.data?.orders, label)
      } catch (error) {
        console.error('fetchTransactionHistory: iyzico sorgusu başarısız', subscriptionReferenceCode, error)
        hasError = true
        return []
      }
    }),
  )
  const transactions = results
    .flat()
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
  return { transactions, hasError }
}

async function getParentMembershipHandler(request) {
  try {
    const { error, parentId } = await requireParentSession(request)
    if (error) {
      return error
    }

    const [overview, quota] = await Promise.all([
      getParentMembershipOverview(parentId),
      getParentStudentQuota(parentId),
    ])

    const planPrices = await getPlanPrices(['parent', 'child_seat'])
    const parentPlan = planPrices.get('parent') || null
    const childSeatPlan = planPrices.get('child_seat') || null

    const { transactions, hasError: transactionsError } = await fetchTransactionHistory([
      { subscriptionReferenceCode: overview.base?.subscription_reference_code, label: parentPlan?.title || 'Veli Takip Paketi' },
      ...overview.childSeats.map((seat) => ({
        subscriptionReferenceCode: seat.subscription_reference_code,
        label: childSeatPlan?.title || 'Ek Çocuk Paketi',
      })),
    ])

    const cancellableReferenceCodes = await findCancellableSubscriptionReferenceCodes(parentId)

    return json(200, {
      membership: overview.base
        ? {
            status: overview.base.status,
            source: overview.base.source,
            period: overview.base.period,
            currentPeriodEnd: overview.base.current_period_end,
            planTitle: parentPlan?.title || null,
            monthlyPrice: parentPlan?.monthlyPrice ?? null,
            yearlyPrice: parentPlan?.yearlyPrice ?? null,
          }
        : null,
      quota,
      childSeats: overview.childSeats.map((seat) => ({
        id: seat.id,
        status: seat.status,
        period: seat.period,
        currentPeriodEnd: seat.current_period_end,
        planTitle: childSeatPlan?.title || null,
        monthlyPrice: childSeatPlan?.monthlyPrice ?? null,
        yearlyPrice: childSeatPlan?.yearlyPrice ?? null,
      })),
      transactions,
      transactionsError,
      canCancel: cancellableReferenceCodes.length > 0,
    })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Ödeme servisi yapılandırması eksik.' })
    }
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }
    console.error('getParentMembershipHandler failed', error)
    return json(500, { error: 'Üyelik bilgileri alınamadı.' })
  }
}

async function cancelParentMembershipHandler(request) {
  try {
    const { error, parentId } = await requireParentSession(request)
    if (error) {
      return error
    }

    const { failedReferenceCodes, cancelledCount } = await cancelSubscriptionsForUser(parentId)
    if (cancelledCount === 0 && failedReferenceCodes.length === 0) {
      return json(400, { error: 'İptal edilecek aktif bir aboneliğiniz bulunmuyor.' })
    }

    return json(200, {
      success: true,
      ...(failedReferenceCodes.length
        ? { subscriptionWarning: 'Bazı abonelikler iptal edilemedi, lütfen destek ile iletişime geçin.' }
        : {}),
    })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Ödeme servisi yapılandırması eksik.' })
    }
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }
    console.error('cancelParentMembershipHandler failed', error)
    return json(500, { error: 'Üyelik iptal edilemedi.' })
  }
}

async function getTeacherMembershipHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) {
      return error
    }

    const [overview, quota] = await Promise.all([
      getTeacherMembershipOverview(teacherUserId),
      getTeacherQuota(teacherUserId),
    ])

    const planPrices = await getPlanPrices(['teacher', 'teacher_seat'])
    const teacherPlan = planPrices.get('teacher') || null
    const teacherSeatPlan = planPrices.get('teacher_seat') || null

    const { transactions, hasError: transactionsError } = await fetchTransactionHistory(
      overview.seats.map((seat) => ({
        subscriptionReferenceCode: seat.subscription_reference_code,
        label: teacherSeatPlan?.title || 'Öğretmen Ek Öğrenci Paketi',
      })),
    )

    const cancellableReferenceCodes = await findCancellableSubscriptionReferenceCodes(teacherUserId)

    return json(200, {
      membership: overview.base
        ? {
            status: overview.base.status,
            source: overview.base.source,
            currentPeriodEnd: overview.base.current_period_end,
            baseSeats: overview.base.base_seats,
            purchasedSeats: overview.base.purchased_seats,
            planTitle: teacherPlan?.title || null,
            monthlyPrice: teacherPlan?.monthlyPrice ?? null,
            // Öğretmen taban planı şu an web'de iyzico üzerinden satılmıyor (admin tarafından
            // elle tanımlanıyor) — bu yüzden self-service iptal sadece ek koltuklar için geçerli.
            selfServiceCancelable: false,
          }
        : null,
      quota,
      seats: overview.seats.map((seat) => ({
        id: seat.id,
        status: seat.status,
        period: seat.period,
        currentPeriodEnd: seat.current_period_end,
        planTitle: teacherSeatPlan?.title || null,
        monthlyPrice: teacherSeatPlan?.monthlyPrice ?? null,
        yearlyPrice: teacherSeatPlan?.yearlyPrice ?? null,
      })),
      transactions,
      transactionsError,
      canCancel: cancellableReferenceCodes.length > 0,
    })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Ödeme servisi yapılandırması eksik.' })
    }
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }
    console.error('getTeacherMembershipHandler failed', error)
    return json(500, { error: 'Üyelik bilgileri alınamadı.' })
  }
}

async function cancelTeacherMembershipHandler(request) {
  try {
    const { error, teacherUserId } = await requireTeacherSession(request)
    if (error) {
      return error
    }

    const { failedReferenceCodes, cancelledCount } = await cancelSubscriptionsForUser(teacherUserId)
    if (cancelledCount === 0 && failedReferenceCodes.length === 0) {
      return json(400, { error: 'İptal edilecek aktif ek öğrenci koltuğu aboneliğiniz bulunmuyor.' })
    }

    return json(200, {
      success: true,
      ...(failedReferenceCodes.length
        ? { subscriptionWarning: 'Bazı abonelikler iptal edilemedi, lütfen destek ile iletişime geçin.' }
        : {}),
    })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Ödeme servisi yapılandırması eksik.' })
    }
    if (isSessionError(error)) {
      return json(401, { error: 'Oturum geçersiz.' })
    }
    console.error('cancelTeacherMembershipHandler failed', error)
    return json(500, { error: 'Üyelik iptal edilemedi.' })
  }
}

module.exports = {
  getParentMembershipHandler,
  cancelParentMembershipHandler,
  getTeacherMembershipHandler,
  cancelTeacherMembershipHandler,
}
