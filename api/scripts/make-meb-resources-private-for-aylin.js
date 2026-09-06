// 3 MEB Yayınları kaynağını katalogdan çıkarıp Aylin Şişman öğrenci profilinin özel
// kaynağı yapar (scope 'catalog' -> 'private', sahibi = velisi Özlem Şişman / 'ebeveyn').
// Öğrenci ataması yoksa StudentResourceBooks satırı eklenir.
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

const STUDENT_ID = '427246B1-A97D-4611-B393-D5F6C1AB6915' // Aylin Şişman
const PARENT_ID = 'A0AD5E68-8DFB-40D3-B9B9-AD587E2BF5B2' // Özlem Şişman (ebeveyn)
const PUBLISHER = 'MEB Yayınları'
const BOOK_NAMES = [
  'Inkilap Tarihi MEB Örnek Sorular',
  'Inkilap Tarihi Öğretmen PDFler',
  'Fen Bilimleri MEB Örnek Sorular',
]

async function main() {
  loadLocalSettings()
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const parent = await pool.request().input('p', sql.UniqueIdentifier, PARENT_ID).query(`
      SELECT id, full_name, role FROM dbo.Users WHERE id = @p;
    `)
    if (!parent.recordset.length || parent.recordset[0].role !== 'ebeveyn') {
      throw new Error('Veli doğrulanamadı: ' + JSON.stringify(parent.recordset[0]))
    }

    for (const name of BOOK_NAMES) {
      const found = await pool
        .request()
        .input('n', sql.NVarChar(200), name)
        .input('pub', sql.NVarChar(150), PUBLISHER)
        .query(`
          SELECT rb.id, rb.name, rb.scope, rb.status, rb.is_active,
                 rb.created_by_user_id, rb.created_by_role,
                 (SELECT COUNT(*) FROM dbo.ResourceBookTopics t WHERE t.resource_book_id = rb.id) AS topic_count,
                 (SELECT COUNT(*) FROM dbo.ResourceBookTopics t
                    JOIN dbo.ResourceBookTopicTests tt ON tt.topic_id = t.id
                  WHERE t.resource_book_id = rb.id) AS test_count
          FROM dbo.ResourceBooks rb
          LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
          WHERE rb.name = @n AND p.name = @pub;
        `)
      if (found.recordset.length !== 1) {
        throw new Error(`"${name}" için beklenen 1 kayıt, bulunan ${found.recordset.length}`)
      }
      const b = found.recordset[0]
      console.log(`\n--- ${b.name} (${b.id}) ---`)
      console.log('  ÖNCE:', JSON.stringify({ scope: b.scope, status: b.status, is_active: b.is_active, topic_count: b.topic_count, test_count: b.test_count }))

      const asgBefore = await pool.request().input('b', sql.UniqueIdentifier, b.id).query(`
        SELECT u.full_name FROM dbo.StudentResourceBooks srb
        JOIN dbo.Users u ON u.id = srb.student_id WHERE srb.resource_book_id = @b;
      `)
      console.log('  atanan (önce):', asgBefore.recordset.map((r) => r.full_name).join(', ') || '-')

      const tx = new sql.Transaction(pool)
      await tx.begin()
      try {
        await new sql.Request(tx)
          .input('b', sql.UniqueIdentifier, b.id)
          .input('u', sql.UniqueIdentifier, PARENT_ID)
          .query(`
            UPDATE dbo.ResourceBooks
            SET scope = 'private', status = 'approved', is_active = 1,
                created_by_user_id = @u, created_by_role = 'ebeveyn'
            WHERE id = @b;
          `)
        await new sql.Request(tx)
          .input('b', sql.UniqueIdentifier, b.id)
          .input('s', sql.UniqueIdentifier, STUDENT_ID)
          .query(`
            INSERT INTO dbo.StudentResourceBooks (student_id, resource_book_id)
            SELECT @s, @b
            WHERE NOT EXISTS (
              SELECT 1 FROM dbo.StudentResourceBooks WHERE student_id = @s AND resource_book_id = @b
            );
          `)
        await tx.commit()
      } catch (e) {
        await tx.rollback()
        throw e
      }

      const after = await pool.request().input('b', sql.UniqueIdentifier, b.id).query(`
        SELECT rb.scope, rb.status, rb.is_active, rb.created_by_role,
               (SELECT STRING_AGG(u.full_name, ', ') FROM dbo.StudentResourceBooks srb
                  JOIN dbo.Users u ON u.id = srb.student_id WHERE srb.resource_book_id = rb.id) AS assigned
        FROM dbo.ResourceBooks rb WHERE rb.id = @b;
      `)
      console.log('  SONRA:', JSON.stringify(after.recordset[0]))
    }
    console.log('\nTamam. 3 MEB kaynağı da kütüphanede görünmüyor, Aylin Şişman özel kaynağı.')
  } finally {
    await pool.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
