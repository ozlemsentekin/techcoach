// "Pro & Test Soru Bankası" (Bilfen Yayınları / Türkçe) kaynağını katalogdan çıkarıp
// Aylin Şişman öğrenci profilinin özel kaynağı yapar.
//   - dbo.ResourceBooks.scope: 'catalog' -> 'private'  (kütüphanede/katalogda görünmez)
//   - created_by_user_id / created_by_role: Aylin'in velisi (Özlem Şişman / 'ebeveyn')
// Öğrenci ataması (StudentResourceBooks), öğretmen takibi (StudentTeacherResourceBooks)
// ve bağlı görevler zaten mevcut; onlara dokunulmaz.
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

const BOOK_ID = '06F598D0-336A-45D8-8243-8EF47F12E44A'
const STUDENT_ID = '427246B1-A97D-4611-B393-D5F6C1AB6915' // Aylin Şişman
const PARENT_ID = 'A0AD5E68-8DFB-40D3-B9B9-AD587E2BF5B2' // Özlem Şişman (veli)

async function main() {
  loadLocalSettings()
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const before = await pool.request().input('b', sql.UniqueIdentifier, BOOK_ID).query(`
      SELECT rb.name, rb.scope, rb.status, rb.is_active, rb.created_by_user_id, rb.created_by_role
      FROM dbo.ResourceBooks rb WHERE rb.id = @b;
    `)
    if (!before.recordset.length) throw new Error('Kaynak bulunamadı: ' + BOOK_ID)
    console.log('ÖNCE:', JSON.stringify(before.recordset[0]))

    const parent = await pool.request().input('p', sql.UniqueIdentifier, PARENT_ID).query(`
      SELECT id, full_name, role FROM dbo.Users WHERE id = @p;
    `)
    if (!parent.recordset.length || parent.recordset[0].role !== 'ebeveyn') {
      throw new Error('Veli doğrulanamadı: ' + JSON.stringify(parent.recordset[0]))
    }

    const tx = new sql.Transaction(pool)
    await tx.begin()
    try {
      await new sql.Request(tx)
        .input('b', sql.UniqueIdentifier, BOOK_ID)
        .input('u', sql.UniqueIdentifier, PARENT_ID)
        .query(`
          UPDATE dbo.ResourceBooks
          SET scope = 'private',
              status = 'approved',
              is_active = 1,
              created_by_user_id = @u,
              created_by_role = 'ebeveyn'
          WHERE id = @b;
        `)

      // Güvenlik için öğrenci ataması yoksa ekle (zaten var).
      await new sql.Request(tx)
        .input('b', sql.UniqueIdentifier, BOOK_ID)
        .input('s', sql.UniqueIdentifier, STUDENT_ID)
        .query(`
          INSERT INTO dbo.StudentResourceBooks (student_id, resource_book_id)
          SELECT @s, @b
          WHERE NOT EXISTS (
            SELECT 1 FROM dbo.StudentResourceBooks
            WHERE student_id = @s AND resource_book_id = @b
          );
        `)

      await tx.commit()
    } catch (e) {
      await tx.rollback()
      throw e
    }

    const after = await pool.request().input('b', sql.UniqueIdentifier, BOOK_ID).query(`
      SELECT rb.name, rb.scope, rb.status, rb.is_active, rb.created_by_user_id, rb.created_by_role
      FROM dbo.ResourceBooks rb WHERE rb.id = @b;
    `)
    console.log('SONRA:', JSON.stringify(after.recordset[0]))

    const asg = await pool.request().input('b', sql.UniqueIdentifier, BOOK_ID).query(`
      SELECT u.full_name FROM dbo.StudentResourceBooks srb
      JOIN dbo.Users u ON u.id = srb.student_id
      WHERE srb.resource_book_id = @b;
    `)
    console.log('atanan öğrenciler:', asg.recordset.map((r) => r.full_name).join(', '))
    console.log('\nTamam. Kaynak artık kütüphanede/katalogda görünmüyor, Aylin Şişman özel kaynağı.')
  } finally {
    await pool.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
