// Teşhis scripti: AV Yayınları 8. sınıf İnkılap Tarihi kaynağının içerik/test durumunu listeler.
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

const RESOURCE_BOOK_ID = 'DCD6A8EA-3841-4149-9D11-E8D307BDB89C'

async function main() {
  loadLocalSettings()
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const topics = await pool.request()
      .input('id', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .query('SELECT id, name, created_at FROM dbo.ResourceBookTopics WHERE resource_book_id = @id ORDER BY created_at ASC;')
    console.log(`Topics (${topics.recordset.length}):`)
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
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
