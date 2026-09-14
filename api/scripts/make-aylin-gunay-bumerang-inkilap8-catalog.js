// "Bumerang Serisi - T.C. İnkılap Tarihi ve Atatürkçülük - 8. Sınıf" (Günay Yayınları) kaynağını
// Aylin Şişman'ın özel kaynağından genel kütüphane kataloğuna taşır.
//   - dbo.ResourceBooks.scope: 'private' -> 'catalog'
// Öğrenci ataması (dbo.StudentResourceBooks) dokunulmadan kalır.
// Not: bu kayıt henüz içeriksiz (0 konu/test) — sadece kapak+temel bilgilerle eklenmiş.
const fs = require('fs')
const path = require('path')
const sql = require('mssql')

function loadLocalSettings() {
  const p = path.join(__dirname, '..', 'local.settings.json')
  const parsed = JSON.parse(fs.readFileSync(p, 'utf8'))
  Object.entries(parsed.Values || {}).forEach(([k, v]) => {
    if (!process.env[k] && typeof v === 'string') process.env[k] = v
  })
}

const BOOK_ID = '3184F4E4-E4CF-4CEB-91B3-56FF04765B82'

async function main() {
  loadLocalSettings()
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const before = await pool.request().input('b', sql.UniqueIdentifier, BOOK_ID).query(`
      SELECT rb.name, rb.scope, rb.status, rb.is_active FROM dbo.ResourceBooks rb WHERE rb.id = @b;
    `)
    if (!before.recordset.length) throw new Error('Kaynak bulunamadı: ' + BOOK_ID)
    console.log('ÖNCE:', JSON.stringify(before.recordset[0]))
    if (before.recordset[0].scope !== 'private') {
      console.log('Zaten private değil, işlem atlandı.')
      return
    }

    const updated = await pool.request().input('b', sql.UniqueIdentifier, BOOK_ID).query(`
      UPDATE dbo.ResourceBooks SET scope = 'catalog' WHERE id = @b AND scope = 'private';
      SELECT @@ROWCOUNT AS affected;
    `)
    console.log('Güncellenen satır:', updated.recordset[0].affected)

    const after = await pool.request().input('b', sql.UniqueIdentifier, BOOK_ID).query(`
      SELECT rb.name, rb.scope, rb.status, rb.is_active FROM dbo.ResourceBooks rb WHERE rb.id = @b;
    `)
    console.log('SONRA:', JSON.stringify(after.recordset[0]))

    const assignment = await pool.request().input('b', sql.UniqueIdentifier, BOOK_ID).query(`
      SELECT srb.student_id, u.full_name FROM dbo.StudentResourceBooks srb
      JOIN dbo.Users u ON u.id = srb.student_id WHERE srb.resource_book_id = @b;
    `)
    console.log('Atama (dokunulmadı):', JSON.stringify(assignment.recordset))
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
