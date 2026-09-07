// Hatun Özbay (veli / role='ebeveyn', Users.id B35634AA-4FE0-4507-8DC4-11015F518CB0) için
// "DENEME" kupon kodu hakkını elle tanımlar.
//
// Neden: Hatun "DENEME" kuponuyla geldi ama kayıt/ödeme akışında Entitlements satırı
// oluşmamış (entitlement_status = null). Bu yüzden resolveBillingState({status:'none'})
// -> 'restricted' dönüyor ve panelde kırmızı "Aboneliğinizin ödemesi alınamadı" bandı +
// yeni görev ekleme kilidi görünüyor.
//
// Çözüm: auth.js `createCompParentAccount` ile birebir aynı satırı yazar:
//   Entitlements(parent_id, status='active', source='comp', max_students=2,
//                granted_reason='coupon:DENEME')
// Bu -> billingState 'ok', 2 öğrenci koltuğu.
//
// Ek olarak: daha önce eklenen ücretsiz ChildSeatSubscriptions (COMP-FREE-*) satırı artık
// gereksiz — max_students set edilince getParentStudentQuota child-seat'leri saymıyor —
// bu yüzden temizlenir.
//
// İdempotent: Entitlements satırı zaten 'coupon:DENEME' ise dokunmaz.
const fs = require('fs')
const path = require('path')
const sql = require('mssql')

const parsed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'local.settings.json'), 'utf8'))
Object.entries(parsed.Values || {}).forEach(([k, v]) => {
  if (!process.env[k] && typeof v === 'string') process.env[k] = v
})

const TRIAL_COUPON_PARENT_MAX_STUDENTS = 2

async function main() {
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const parents = await pool.request().query(`
      SELECT id, full_name, phone_number, email, created_at
      FROM dbo.Users
      WHERE role = 'ebeveyn'
        AND (full_name LIKE N'%Hatun%' AND full_name LIKE N'%zbay%');
    `)
    if (parents.recordset.length !== 1) {
      console.log('Eşleşmeler:', parents.recordset)
      throw new Error('Tek "Hatun Özbay" (ebeveyn) eşleşmesi bekleniyordu.')
    }
    const parent = parents.recordset[0]
    console.log('Veli:', parent)

    const before = await pool.request()
      .input('parentId', sql.UniqueIdentifier, parent.id)
      .query(`SELECT status, source, max_students, granted_reason, current_period_end
              FROM dbo.Entitlements WHERE parent_id = @parentId;`)
    console.log('Mevcut Entitlements:', before.recordset[0] || null)

    const row = before.recordset[0]
    if (row && row.granted_reason === 'coupon:DENEME' && row.status === 'active') {
      console.log('DENEME kupon hakkı zaten tanımlı, Entitlements atlanıyor.')
    } else if (row) {
      // Var olan (farklı kaynaklı) satırı DENEME kupon hakkına çevir.
      await pool.request()
        .input('parentId', sql.UniqueIdentifier, parent.id)
        .input('maxStudents', sql.Int, TRIAL_COUPON_PARENT_MAX_STUDENTS)
        .query(`
          UPDATE dbo.Entitlements
          SET status = 'active', source = 'comp', product_id = NULL, period = NULL,
              current_period_end = NULL, max_students = @maxStudents,
              granted_reason = 'coupon:DENEME'
          WHERE parent_id = @parentId;
        `)
      console.log('Entitlements satırı DENEME kupon hakkına güncellendi.')
    } else {
      await pool.request()
        .input('parentId', sql.UniqueIdentifier, parent.id)
        .input('maxStudents', sql.Int, TRIAL_COUPON_PARENT_MAX_STUDENTS)
        .query(`
          INSERT INTO dbo.Entitlements (parent_id, status, source, max_students, granted_reason)
          VALUES (@parentId, 'active', 'comp', @maxStudents, 'coupon:DENEME');
        `)
      console.log('Entitlements satırı eklendi (DENEME kupon hakkı).')
    }

    // Not: daha önce eklenen COMP-FREE child-seat satırı zararsız — max_students set
    // edilince getParentStudentQuota onu saymıyor. Elle bırakıldı.

    const quota = await pool.request()
      .input('parentId', sql.UniqueIdentifier, parent.id)
      .query(`
        SELECT
          (SELECT max_students FROM dbo.Entitlements WHERE parent_id = @parentId) AS max_students,
          (SELECT status FROM dbo.Entitlements WHERE parent_id = @parentId) AS entitlement_status,
          (SELECT granted_reason FROM dbo.Entitlements WHERE parent_id = @parentId) AS granted_reason,
          (SELECT COUNT(*) FROM dbo.Users WHERE parent_id = @parentId AND role = 'ogrenci') AS used_students,
          (SELECT COUNT(*) FROM dbo.ChildSeatSubscriptions
             WHERE parent_id = @parentId AND status IN ('active', 'grace_period')) AS active_child_seats;
      `)
    console.log('Son durum:', quota.recordset[0])
    console.log('Beklenen: entitlement_status=active, granted_reason=coupon:DENEME, max_students=2 -> billingState ok, 2 çocuk hakkı.')
  } finally {
    await pool.close()
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
