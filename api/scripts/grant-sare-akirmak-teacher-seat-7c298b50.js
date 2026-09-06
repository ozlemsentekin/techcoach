// Sare Akırmak (öğretmen, Users.id 9EFC0EA9-F12F-4A03-A3B9-F4B24A132121) için 2026-09-06'da
// iyzico'da BAŞARIYLA tahsil edilen (499 TRY, paymentId 4188009537) "Öğretmen Ek Öğrenci Aylık"
// aboneliğini elle kaydeder.
//
// Neden gerekli: iyzico abonelik checkout formunun "retrieve" yanıtı conversationId DÖNMÜYOR
// (iyzico'nun bilinen hatası, iyzipay-php#194). Bu yüzden iyzicoCheckoutCallbackHandler
// conversationId'yi null görüp ödemeyi "hata"ya düşürdü ve TeacherSeatSubscriptions satırı
// hiç oluşmadı — kart çekildiği hâlde öğretmene koltuk tanımlanmadı.
//
// iyzico aboneliği (ACTIVE, referenceCode 7c298b50-61e1-471a-ac28-b40e43ed21c7) gerçek ve
// devam ediyor; burada sadece uygulama tarafındaki kaydı tamamlıyoruz. İdempotent: satır
// zaten varsa hiçbir şey yapmaz.
const fs = require('fs')
const path = require('path')
const sql = require('mssql')

const parsed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'local.settings.json'), 'utf8'))
Object.entries(parsed.Values || {}).forEach(([k, v]) => {
  if (!process.env[k] && typeof v === 'string') process.env[k] = v
})

const TEACHER_ID = '9EFC0EA9-F12F-4A03-A3B9-F4B24A132121'
const SUBSCRIPTION_REF = '7c298b50-61e1-471a-ac28-b40e43ed21c7'
const PRICING_PLAN_REF = 'd5fcfbed-94a1-46c9-8d3a-0d327ec7ca09'
const CURRENT_PERIOD_END = '2026-10-06T12:42:32.623Z'

async function main() {
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const existing = await pool.request()
      .input('ref', sql.NVarChar(100), SUBSCRIPTION_REF)
      .query('SELECT id, teacher_id, status FROM dbo.TeacherSeatSubscriptions WHERE subscription_reference_code = @ref;')
    if (existing.recordset.length) {
      console.log('Zaten kayıtlı, atlanıyor:', existing.recordset[0])
      return
    }

    await pool.request()
      .input('teacherId', sql.UniqueIdentifier, TEACHER_ID)
      .input('status', sql.NVarChar(20), 'active')
      .input('period', sql.NVarChar(10), 'monthly')
      .input('productId', sql.NVarChar(120), PRICING_PLAN_REF)
      .input('ref', sql.NVarChar(100), SUBSCRIPTION_REF)
      .input('cpe', sql.DateTime2, new Date(CURRENT_PERIOD_END))
      .query(`
        INSERT INTO dbo.TeacherSeatSubscriptions
          (teacher_id, status, period, product_id, subscription_reference_code, current_period_end)
        VALUES (@teacherId, @status, @period, @productId, @ref, @cpe);
      `)

    // callback'in idempotency guard'ıyla aynı event (data.referenceCode = abonelik referansı).
    try {
      await pool.request()
        .input('provider', sql.NVarChar(20), 'iyzico')
        .input('providerEventId', sql.NVarChar(200), SUBSCRIPTION_REF)
        .input('eventType', sql.NVarChar(60), 'teacher_seat.checkout.completed')
        .input('appUserId', sql.NVarChar(120), TEACHER_ID)
        .input('rawPayload', sql.NVarChar(sql.MAX), JSON.stringify({
          note: 'Manuel telafi — iyzico conversationId hatası (iyzipay-php#194)',
          subscriptionReferenceCode: SUBSCRIPTION_REF,
          pricingPlanReferenceCode: PRICING_PLAN_REF,
          paymentId: 4188009537,
          price: 499,
        }))
        .query(`
          INSERT INTO dbo.EntitlementEvents (provider, provider_event_id, event_type, app_user_id, raw_payload)
          VALUES (@provider, @providerEventId, @eventType, @appUserId, @rawPayload);
        `)
    } catch (e) {
      if (e.number !== 2601 && e.number !== 2627) throw e
      console.log('EntitlementEvents zaten var, atlandı.')
    }

    const quota = await pool.request()
      .input('teacherId', sql.UniqueIdentifier, TEACHER_ID)
      .query(`
        SELECT
          (SELECT COUNT(*) FROM dbo.Users u WHERE u.funded_by_teacher_id = @teacherId) AS used_seats,
          (SELECT COUNT(*) FROM dbo.TeacherSeatSubscriptions
             WHERE teacher_id = @teacherId AND status IN ('active','grace_period')) AS seat_subscriptions;
      `)
    console.log('OK — koltuk kaydedildi.')
    console.log('Kota:', quota.recordset[0])
  } finally {
    await pool.close()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
