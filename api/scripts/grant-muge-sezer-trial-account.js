// Müge Sezer (telefon +90 544 376 93 62) için 1 aylık deneme veli hesabı açar.
//
// Not: Entitlements.status='trial' + current_period_end doldurulsa bile sistemde bu tarihi
// tarayıp otomatik 'expired'e çeviren bir zamanlanmış iş yok (resolveBillingState 'trial'/
// 'active' durumunda current_period_end'i hiç okumuyor — bkz. api/src/entitlements.js).
// current_period_end burada yalnızca BİLGİ AMAÇLI (raporlama/hatırlatma) tutulur; 1 ay
// dolunca bu satırı 'expired' yapıp gerçek ödeme akışına düşürmek için ayrı bir script
// (expire-muge-sezer-trial.js) elle çalıştırılmalı.
//
// İdempotent: telefon numarasıyla eşleşen bir Users satırı varsa yeniden kullanılır;
// Entitlements satırı zaten varsa dokunulmaz.
const { withRequest, withTransaction } = require('../src/db')
const { sql } = require('../src/db')
const { normalizePhone, defaultPasswordForPhone, hashPassword } = require('../src/security')

const FULL_NAME = 'Müge Sezer'
const RAW_PHONE = '+90 544 376 93 62'
const TRIAL_DAYS = 30

async function main() {
  const phone = normalizePhone(RAW_PHONE)
  if (!phone) {
    throw new Error(`Telefon numarası normalize edilemedi: ${RAW_PHONE}`)
  }

  const existingDb = await withRequest({ phone: { type: sql.NVarChar(20), value: phone } })
  const existing = await existingDb.query(`
    SELECT TOP 1 id, full_name, phone_number, role, created_at
    FROM dbo.Users WHERE phone_number = @phone;
  `)

  let parent = existing.recordset[0] || null
  let initialPassword = null

  if (parent) {
    console.log('Bu telefon numarasıyla mevcut kullanıcı bulundu, yeniden kullanılıyor:', parent)
    if (parent.role !== 'ebeveyn') {
      throw new Error(`Mevcut kullanıcının rolü 'ebeveyn' değil: ${parent.role}`)
    }
  } else {
    const passwordHash = await hashPassword(defaultPasswordForPhone(phone))
    initialPassword = defaultPasswordForPhone(phone)
    parent = await withTransaction(async (requestInTransaction) => {
      const insertDb = requestInTransaction({
        fullName: { type: sql.NVarChar(120), value: FULL_NAME },
        phone: { type: sql.NVarChar(20), value: phone },
        passwordHash: { type: sql.NVarChar(255), value: passwordHash },
      })
      const result = await insertDb.query(`
        INSERT INTO dbo.Users (full_name, phone_number, password_hash, email, has_panel_access, role)
        OUTPUT inserted.id, inserted.full_name, inserted.phone_number, inserted.role, inserted.created_at
        VALUES (@fullName, @phone, @passwordHash, NULL, 1, 'ebeveyn');
      `)
      return result.recordset[0]
    })
    console.log('Yeni veli hesabı oluşturuldu:', parent)
  }

  const entitlementDb = await withRequest({ parentId: { type: sql.UniqueIdentifier, value: parent.id } })
  const entitlementBefore = await entitlementDb.query(`
    SELECT status, source, current_period_end, granted_reason
    FROM dbo.Entitlements WHERE parent_id = @parentId;
  `)

  if (entitlementBefore.recordset[0]) {
    console.log('Bu velinin zaten bir Entitlements satırı var, dokunulmadı:', entitlementBefore.recordset[0])
  } else {
    const periodEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
    const insertEntitlementDb = await withRequest({
      parentId: { type: sql.UniqueIdentifier, value: parent.id },
      periodEnd: { type: sql.DateTime2, value: periodEnd },
    })
    await insertEntitlementDb.query(`
      INSERT INTO dbo.Entitlements (parent_id, status, source, current_period_end, granted_reason)
      VALUES (@parentId, 'trial', 'comp', @periodEnd, 'trial:1ay:muge-sezer');
    `)
    console.log(`Entitlements satırı eklendi: status=trial, current_period_end=${periodEnd.toISOString()}`)
  }

  console.log('---')
  console.log('Giriş bilgileri:')
  console.log('  Telefon:', phone)
  if (initialPassword) {
    console.log('  Başlangıç şifresi (telefonun son 6 hanesi):', initialPassword)
  } else {
    console.log('  (Mevcut kullanıcı olduğu için şifre değiştirilmedi.)')
  }
  console.log(`Deneme süresi bitişi (bilgi amaçlı, otomatik kısıtlama YOK): ${new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
