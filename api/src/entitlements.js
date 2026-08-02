const crypto = require('crypto')
const { sql, withRequest } = require('./db')
const { isConfigError, getBillingConfig } = require('./config')
const { json } = require('./http')

const ACTIVE_EVENT_TYPES = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION'])
const CANCEL_EVENT_TYPES = new Set(['CANCELLATION'])
const EXPIRE_EVENT_TYPES = new Set(['EXPIRATION'])
const GRACE_EVENT_TYPES = new Set(['BILLING_ISSUE'])

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

    const status = resolveStatus(event.type)
    if (!status) {
      return json(200, { ok: true, skipped: 'unhandled_event_type' })
    }

    const parentDb = await withRequest({
      parentId: { type: sql.UniqueIdentifier, value: event.app_user_id },
    })
    const parentResult = await parentDb.query(`
      SELECT TOP 1 id FROM dbo.Users WHERE id = @parentId AND role = 'ebeveyn';
    `)
    if (!parentResult.recordset[0]) {
      return json(200, { ok: true, skipped: 'unknown_app_user_id' })
    }

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

    return json(200, { ok: true })
  } catch (error) {
    if (isConfigError(error)) {
      return json(503, { error: 'Ödeme servisi yapılandırması eksik.' })
    }

    console.error('revenuecatWebhookHandler failed', error)
    return json(500, { error: 'Webhook işlenemedi.' })
  }
}

module.exports = {
  revenuecatWebhookHandler,
}
