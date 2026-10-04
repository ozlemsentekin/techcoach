// Müge Sezer'in 1 aylık deneme hakkını sona erdirir (Entitlements.status='trial' -> 'expired').
// grant-muge-sezer-trial-account.js ile açılan deneme süresi (2026-10-23 civarı) dolduğunda
// elle çalıştırılır — sistemde current_period_end'i tarayan otomatik bir iş yok, bu yüzden
// gerçek ödeme akışına düşürmek (billingState -> restricted) için bu script gerekli.
//
// İdempotent: status zaten 'trial' değilse dokunmaz.
const { withRequest, sql } = require('../src/db')
const { normalizePhone } = require('../src/security')

const RAW_PHONE = '+90 544 376 93 62'

async function main() {
  const phone = normalizePhone(RAW_PHONE)
  const userDb = await withRequest({ phone: { type: sql.NVarChar(20), value: phone } })
  const user = await userDb.query(`
    SELECT TOP 1 id, full_name FROM dbo.Users WHERE phone_number = @phone AND role = 'ebeveyn';
  `)
  const parent = user.recordset[0]
  if (!parent) {
    throw new Error('Müge Sezer için veli hesabı bulunamadı.')
  }

  const entitlementDb = await withRequest({ parentId: { type: sql.UniqueIdentifier, value: parent.id } })
  const before = await entitlementDb.query(`
    SELECT status, granted_reason FROM dbo.Entitlements WHERE parent_id = @parentId;
  `)
  const row = before.recordset[0]
  if (!row) {
    throw new Error('Entitlements satırı bulunamadı.')
  }
  if (row.status !== 'trial') {
    console.log('Entitlements durumu zaten "trial" değil, dokunulmadı:', row)
    return
  }

  const updateDb = await withRequest({ parentId: { type: sql.UniqueIdentifier, value: parent.id } })
  await updateDb.query(`
    UPDATE dbo.Entitlements SET status = 'expired' WHERE parent_id = @parentId;
  `)
  console.log(`Deneme süresi sona erdirildi: ${parent.full_name} artık restricted (ödeme akışına düşecek).`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
