const crypto = require('crypto')
const { sql, withRequest } = require('./db')
const { isConfigError, getBillingConfig } = require('./config')
const { json } = require('./http')

const ACTIVE_EVENT_TYPES = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION'])
const CANCEL_EVENT_TYPES = new Set(['CANCELLATION'])
const EXPIRE_EVENT_TYPES = new Set(['EXPIRATION'])
const GRACE_EVENT_TYPES = new Set(['BILLING_ISSUE'])

const ACTIVE_STATUSES = new Set(['active', 'trial', 'grace_period'])

function isAuthorizedWebhook(request) {
  const { revenueCatWebhookAuthHeader } = getBillingConfig()
  const provided = Buffer.from(request.headers.get('authorization') || '')
  const expected = Buffer.from(revenueCatWebhookAuthHeader)

  if (provided.length !== expected.length) {
    return false
  }

  return crypto.timingSafeEqual(provided, expected)
}

function resolveStatus(eventType) {
  if (ACTIVE_EVENT_TYPES.has(eventType)) {
    return 'active'
  }
  if (CANCEL_EVENT_TYPES.has(eventType)) {
    return 'active'
  }
  if (EXPIRE_EVENT_TYPES.has(eventType)) {
    return 'expired'
  }
  if (GRACE_EVENT_TYPES.has(eventType)) {
    return 'grace_period'
  }
  return null
}

function resolveSource(store) {
  return store === 'PLAY_STORE' ? 'play_store' : 'app_store'
}

async function upsertParentEntitlement(event, status) {
  const upsertDb = await withRequest({
    parentId: { type: sql.UniqueIdentifier, value: event.app_user_id },
    status: { type: sql.NVarChar(20), value: status },
    source: { type: sql.NVarChar(20), value: resolveSource(event.store) },
    productId: { type: sql.NVarChar(120), value: event.product_id || null },
    currentPeriodEnd: {
      type: sql.DateTime2,
      value: event.expiration_at_ms ? new Date(event.expiration_at_ms) : null,
    },
    revenueCatAppUserId: { type: sql.NVarChar(120), value: event.app_user_id },
  })

  await upsertDb.query(`
    MERGE dbo.Entitlements AS target
    USING (SELECT @parentId AS parent_id) AS source_row
    ON target.parent_id = source_row.parent_id
    WHEN MATCHED THEN
      UPDATE SET status = @status, source = @source, product_id = @productId,
                 current_period_end = @currentPeriodEnd, revenuecat_app_user_id = @revenueCatAppUserId
    WHEN NOT MATCHED THEN
      INSERT (parent_id, status, source, product_id, current_period_end, revenuecat_app_user_id)
      VALUES (@parentId, @status, @source, @productId, @currentPeriodEnd, @revenueCatAppUserId);
  `)
}

async function upsertTeacherBaseEntitlement(event, status) {
  const upsertDb = await withRequest({
    teacherId: { type: sql.UniqueIdentifier, value: event.app_user_id },
    status: { type: sql.NVarChar(20), value: status },
    source: { type: sql.NVarChar(20), value: resolveSource(event.store) },
    productId: { type: sql.NVarChar(120), value: event.product_id || null },
    currentPeriodEnd: {
      type: sql.DateTime2,
      value: event.expiration_at_ms ? new Date(event.expiration_at_ms) : null,
    },
    revenueCatAppUserId: { type: sql.NVarChar(120), value: event.app_user_id },
  })

  await upsertDb.query(`
    MERGE dbo.TeacherEntitlements AS target
    USING (SELECT @teacherId AS teacher_id) AS source_row
    ON target.teacher_id = source_row.teacher_id
    WHEN MATCHED THEN
      UPDATE SET status = @status, source = @source, product_id = @productId,
                 current_period_end = @currentPeriodEnd, revenuecat_app_user_id = @revenueCatAppUserId
    WHEN NOT MATCHED THEN
      INSERT (teacher_id, status, source, product_id, current_period_end, revenuecat_app_user_id)
      VALUES (@teacherId, @status, @source, @productId, @currentPeriodEnd, @revenueCatAppUserId);
  `)
}

// Öğretmenin sabit plana (3000 TL/ay, 4 öğrenci dahil) ek olarak satın aldığı öğrenci başı
// (200 TL/ay) koltuk ürünleri için sadece purchased_seats sayacını günceller; genel abonelik
// durumunu (status/product_id) etkilemez — o alanlar yalnızca temel ürün event'lerinden gelir.
async function adjustTeacherSeatCount(event) {
  if (event.type !== 'INITIAL_PURCHASE' && event.type !== 'EXPIRATION') {
    return { skipped: 'seat_event_type_not_tracked' }
  }

  const delta = event.type === 'INITIAL_PURCHASE' ? 1 : -1
  const upsertDb = await withRequest({
    teacherId: { type: sql.UniqueIdentifier, value: event.app_user_id },
    source: { type: sql.NVarChar(20), value: resolveSource(event.store) },
    delta: { type: sql.Int, value: delta },
    insertSeats: { type: sql.Int, value: delta > 0 ? 1 : 0 },
  })

  await upsertDb.query(`
    MERGE dbo.TeacherEntitlements AS target
    USING (SELECT @teacherId AS teacher_id) AS source_row
    ON target.teacher_id = source_row.teacher_id
    WHEN MATCHED THEN
      UPDATE SET purchased_seats = CASE
        WHEN @delta > 0 THEN purchased_seats + 1
        WHEN purchased_seats > 0 THEN purchased_seats - 1
        ELSE 0
      END
    WHEN NOT MATCHED THEN
      INSERT (teacher_id, status, source, base_seats, purchased_seats)
      VALUES (@teacherId, 'none', @source, 4, @insertSeats);
  `)

  return { ok: true }
}

async function revenuecatWebhookHandler(request) {
  try {
    if (!isAuthorizedWebhook(request)) {
      return json(401, { error: 'Yetkisiz istek.' })
    }

    const payload = await request.json().catch(() => null)
    const event = payload?.event
    if (!event?.id || !event?.type || !event?.app_user_id) {
      return json(400, { error: 'Geçersiz webhook gövdesi.' })
    }

    const eventDb = await withRequest({
      provider: { type: sql.NVarChar(20), value: 'revenuecat' },
      providerEventId: { type: sql.NVarChar(200), value: String(event.id) },
      eventType: { type: sql.NVarChar(60), value: event.type },
      appUserId: { type: sql.NVarChar(120), value: event.app_user_id },
      rawPayload: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(payload) },
    })

    try {
      await eventDb.query(`
        INSERT INTO dbo.EntitlementEvents (provider, provider_event_id, event_type, app_user_id, raw_payload)
        VALUES (@provider, @providerEventId, @eventType, @appUserId, @rawPayload);
      `)
    } catch (error) {
      if (error.number === 2601 || error.number === 2627) {
        return json(200, { ok: true, deduplicated: true })
      }
      throw error
    }

    const roleDb = await withRequest({
      appUserId: { type: sql.UniqueIdentifier, value: event.app_user_id },
    })
    const roleResult = await roleDb.query(`
      SELECT TOP 1 id, role FROM dbo.Users WHERE id = @appUserId;
    `)
    const user = roleResult.recordset[0]
    if (!user || (user.role !== 'ebeveyn' && user.role !== 'ogretmen')) {
      return json(200, { ok: true, skipped: 'unknown_app_user_id' })
    }

    if (user.role === 'ogretmen') {
      const { teacherSeatProductIds } = getBillingConfig()
      if (teacherSeatProductIds.includes(event.product_id)) {
        const result = await adjustTeacherSeatCount(event)
        return json(200, result)
      }

      const status = resolveStatus(event.type)
      if (!status) {
        return json(200, { ok: true, skipped: 'unhandled_event_type' })
      }
      await upsertTeacherBaseEntitlement(event, status)
      return json(200, { ok: true })
    }

    const status = resolveStatus(event.type)
    if (!status) {
      return json(200, { ok: true, skipped: 'unhandled_event_type' })
    }
    await upsertParentEntitlement(event, status)

    return json(200, { ok: true })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Ödeme servisi yapılandırması eksik.' })
    }

    console.error('revenuecatWebhookHandler failed', error)
    return json(500, { error: 'Webhook işlenemedi.' })
  }
}

// Bir öğretmenin panel kotasını (durum + toplam/kalan koltuk) döner. `Entitlements` tarafındaki
// gibi ayrı bir "kullanılan koltuk" sayacı tutmuyoruz — funded_by_teacher_id üzerinden canlı sayıyoruz,
// böylece kota ile gerçek öğrenci sayısı hiçbir zaman birbirinden kopmaz (drift riski yok).
async function getTeacherQuota(teacherId) {
  const requestDb = await withRequest({ teacherId: { type: sql.UniqueIdentifier, value: teacherId } })
  const result = await requestDb.query(`
    SELECT te.status, te.base_seats, te.purchased_seats,
           (SELECT COUNT(*) FROM dbo.Users u WHERE u.funded_by_teacher_id = @teacherId) AS used_seats
    FROM dbo.TeacherEntitlements te
    WHERE te.teacher_id = @teacherId;
  `)
  const record = result.recordset[0]

  const status = record?.status || 'none'
  const totalSeats = record ? record.base_seats + record.purchased_seats : 0
  const usedSeats = record ? Number(record.used_seats) || 0 : 0

  return {
    status,
    isActive: ACTIVE_STATUSES.has(status),
    totalSeats,
    usedSeats,
    remainingSeats: Math.max(totalSeats - usedSeats, 0),
  }
}

async function upsertParentEntitlementFromIyzico({
  parentId,
  status,
  pricingPlanReferenceCode,
  billingCycle,
  subscriptionReferenceCode,
  currentPeriodEnd,
}) {
  const upsertDb = await withRequest({
    parentId: { type: sql.UniqueIdentifier, value: parentId },
    status: { type: sql.NVarChar(20), value: status },
    productId: { type: sql.NVarChar(120), value: pricingPlanReferenceCode },
    period: { type: sql.NVarChar(10), value: billingCycle },
    subscriptionReferenceCode: { type: sql.NVarChar(100), value: subscriptionReferenceCode },
    currentPeriodEnd: { type: sql.DateTime2, value: currentPeriodEnd },
  })

  await upsertDb.query(`
    MERGE dbo.Entitlements AS target
    USING (SELECT @parentId AS parent_id) AS source_row
    ON target.parent_id = source_row.parent_id
    WHEN MATCHED THEN
      UPDATE SET status = @status, source = 'iyzico', product_id = @productId, period = @period,
                 subscription_reference_code = @subscriptionReferenceCode, current_period_end = @currentPeriodEnd
    WHEN NOT MATCHED THEN
      INSERT (parent_id, status, source, product_id, period, subscription_reference_code, current_period_end)
      VALUES (@parentId, @status, 'iyzico', @productId, @period, @subscriptionReferenceCode, @currentPeriodEnd);
  `)
}

async function updateParentEntitlementStatus(parentId, status) {
  const updateDb = await withRequest({
    parentId: { type: sql.UniqueIdentifier, value: parentId },
    status: { type: sql.NVarChar(20), value: status },
  })
  await updateDb.query(`
    UPDATE dbo.Entitlements SET status = @status WHERE parent_id = @parentId;
  `)
}

async function findParentIdBySubscriptionReferenceCode(subscriptionReferenceCode) {
  const requestDb = await withRequest({
    subscriptionReferenceCode: { type: sql.NVarChar(100), value: subscriptionReferenceCode },
  })
  const result = await requestDb.query(`
    SELECT TOP 1 parent_id FROM dbo.Entitlements WHERE subscription_reference_code = @subscriptionReferenceCode;
  `)
  return result.recordset[0]?.parent_id || null
}

// Bir öğrenci veya velinin efektif abonelik durumunu belirler. Öncelik sırası:
//   1. Kişinin (velinin) kendi Entitlements kaydı aktifse (iyzico/revenuecat/kupon) o kullanılır.
//   2. Aksi halde kişi bir öğretmen tarafından eklenmişse — yani bağlı öğrencinin
//      funded_by_teacher_id alanı dolu — ve o öğretmenin panel aboneliği aktifse,
//      durum 'active' (source: 'teacher') kabul edilir. Böylece öğretmenin eklediği
//      öğrenci/veli, öğretmenin aboneliği sürdüğü sürece paywall'a takılmaz.
//   3. Hiçbiri yoksa temel durum ('none' vb.) aynen döner.
async function resolveEffectiveEntitlement({ userId, status, source = null, currentPeriodEnd = null }) {
  if (ACTIVE_STATUSES.has(status)) {
    return { status, source: source || null, currentPeriodEnd: currentPeriodEnd || null }
  }

  const requestDb = await withRequest({ userId: { type: sql.UniqueIdentifier, value: userId } })
  const result = await requestDb.query(`
    SELECT TOP 1 te.status
    FROM dbo.TeacherEntitlements te
    WHERE te.teacher_id IN (
      SELECT funded_by_teacher_id
      FROM dbo.Users
      WHERE role = 'ogrenci'
        AND funded_by_teacher_id IS NOT NULL
        AND (id = @userId OR parent_id = @userId)
    )
    ORDER BY CASE te.status
      WHEN 'active' THEN 0 WHEN 'trial' THEN 1 WHEN 'grace_period' THEN 2 ELSE 3
    END;
  `)

  if (ACTIVE_STATUSES.has(result.recordset[0]?.status)) {
    return { status: 'active', source: 'teacher', currentPeriodEnd: null }
  }

  return { status: status || 'none', source: source || null, currentPeriodEnd: currentPeriodEnd || null }
}

async function hasActiveParentEntitlement(parentId) {
  const requestDb = await withRequest({ parentId: { type: sql.UniqueIdentifier, value: parentId } })
  const result = await requestDb.query(`
    SELECT TOP 1 status FROM dbo.Entitlements WHERE parent_id = @parentId;
  `)
  return ACTIVE_STATUSES.has(result.recordset[0]?.status)
}

// Velinin öğrenci ekleme kotasını döner. `max_students` yalnızca "DENEME" kupon kodu gibi
// sınırlı haklarda set edilir; NULL ise (varsayılan) sınırsız kabul edilir, mevcut davranış
// bozulmaz.
async function getParentStudentQuota(parentId) {
  const requestDb = await withRequest({ parentId: { type: sql.UniqueIdentifier, value: parentId } })
  const result = await requestDb.query(`
    SELECT
      (SELECT max_students FROM dbo.Entitlements WHERE parent_id = @parentId) AS max_students,
      (SELECT COUNT(*) FROM dbo.Users WHERE parent_id = @parentId AND role = 'ogrenci') AS used_students;
  `)
  const record = result.recordset[0]
  const maxStudents = record?.max_students ?? null
  const usedStudents = Number(record?.used_students) || 0

  return {
    maxStudents,
    usedStudents,
    hasRemaining: maxStudents === null || usedStudents < maxStudents,
  }
}

module.exports = {
  revenuecatWebhookHandler,
  getTeacherQuota,
  hasActiveParentEntitlement,
  resolveEffectiveEntitlement,
  getParentStudentQuota,
  upsertParentEntitlementFromIyzico,
  updateParentEntitlementStatus,
  findParentIdBySubscriptionReferenceCode,
  ACTIVE_STATUSES,
}
