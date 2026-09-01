// Teşhis scripti: AV Yayınları 8. sınıf İnkılap Tarihi kaynaklarının durumunu listeler.
// Usage: node api/scripts/lookup-av-inkilap8-book.js
const fs = require('fs')
const path = require('path')
const sql = require('mssql')

const localSettingsPath = path.join(__dirname, '..', 'local.settings.json')

function loadLocalSettings() {
  if (!fs.existsSync(localSettingsPath)) return
  const parsed = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'))
  Object.entries(parsed.Values || {}).forEach(([key, value]) => {
    if (!process.env[key] && typeof value === 'string') process.env[key] = value
  })
}

async function main() {
  loadLocalSettings()
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const books = await pool.request().query(`
      SELECT b.id, b.name, b.scope, b.grade, b.resource_type, p.name AS publisher_name, b.is_active, b.created_at
      FROM dbo.ResourceBooks b
      LEFT JOIN dbo.Publishers p ON p.id = b.publisher_id
      WHERE p.name LIKE '%AV%' OR p.name LIKE '%Akıllı Versiyon%'
      ORDER BY b.created_at DESC;`)
    console.log('AV Yayınları kitapları:', JSON.stringify(books.recordset, null, 2))

    for (const b of books.recordset) {
      const topics = await pool.request()
        .input('id', sql.UniqueIdentifier, b.id)
        .query('SELECT id, name, created_at FROM dbo.ResourceBookTopics WHERE resource_book_id = @id ORDER BY created_at ASC;')
      console.log(`\n== ${b.name} (${b.id}) — ${topics.recordset.length} İçerik ==`)
      for (const t of topics.recordset) {
        const tests = await pool.request()
          .input('tid', sql.UniqueIdentifier, t.id)
          .query(`SELECT name, question_count, page_start,
                    (SELECT COUNT(*) FROM dbo.TestAnswerKeys k WHERE k.test_id = tt.id) AS answer_count
                  FROM dbo.ResourceBookTopicTests tt WHERE topic_id = @tid ORDER BY page_start;`)
        console.log(`  - ${t.name}`)
        for (const x of tests.recordset) {
          console.log(`      ${x.name} | q=${x.question_count} page_start=${x.page_start} answers=${x.answer_count}`)
        }
      }
    }
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
