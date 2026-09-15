// "Zaman Ayarlı Kazanım Soru Bankası - Matematik - 8. Sınıf" (Çanta Yayınları) kaynağını
// Aylin Şişman'ın özel kaynağından genel kütüphane kataloğuna taşır.
//   - dbo.ResourceBooks.scope: 'private' -> 'catalog'
// Öğrenci ataması (dbo.StudentResourceBooks) dokunulmadan kalır.
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

const BOOK_ID = 'FAA94D31-B871-4DB4-BE04-633C8F3389BB'

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

    const coverage = await pool.request().input('b', sql.UniqueIdentifier, BOOK_ID).query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.ResourceBookTopics WHERE resource_book_id = @b) AS topics,
        (SELECT COUNT(*) FROM dbo.ResourceBookTopicTests tt JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id WHERE t.resource_book_id = @b) AS tests,
        (SELECT COUNT(DISTINCT tt.id) FROM dbo.ResourceBookTopicTests tt
          JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
          JOIN dbo.TestAnswerKeys tak ON tak.test_id = tt.id
          WHERE t.resource_book_id = @b) AS testsWithAnswers;
    `)
    console.log('KAPSAM:', JSON.stringify(coverage.recordset[0]))
    if (coverage.recordset[0].tests !== coverage.recordset[0].testsWithAnswers) {
      throw new Error('Bazı testlerin cevap anahtarı eksik, taşıma iptal edildi.')
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
