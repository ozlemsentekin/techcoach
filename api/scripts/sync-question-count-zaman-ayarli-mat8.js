// dbo.ResourceBookTopicTests.question_count sütunu, cevap anahtarı seed script'leriyle
// TestAnswerKeys'e doğrudan INSERT yapılırken güncellenmiyordu (backend bug, ayrıca
// api/src/catalog.js setTestAnswerKeyHandler'da düzeltildi). Bu script SADECE
// "Zaman Ayarlı Kazanım Soru Bankası - Matematik - 8. Sınıf" kaynağının 181 testi için
// question_count'u TestAnswerKeys'teki gerçek soru sayısına eşitler (UPDATE, satır silme yok).
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
      SELECT tt.id, tt.name, tt.question_count, ak.key_count
      FROM dbo.ResourceBookTopicTests tt
      JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
      JOIN (SELECT test_id, COUNT(*) AS key_count FROM dbo.TestAnswerKeys GROUP BY test_id) ak ON ak.test_id = tt.id
      WHERE t.resource_book_id = @b AND ISNULL(tt.question_count, 0) <> ak.key_count;
    `)
    console.log('Güncellenecek test sayısı:', before.recordset.length)

    for (const row of before.recordset) {
      await pool.request()
        .input('testId', sql.UniqueIdentifier, row.id)
        .input('questionCount', sql.Int, row.key_count)
        .query(`UPDATE dbo.ResourceBookTopicTests SET question_count = @questionCount WHERE id = @testId;`)
    }
    console.log('Güncellendi:', before.recordset.length, 'test.')

    const after = await pool.request().input('b', sql.UniqueIdentifier, BOOK_ID).query(`
      SELECT COUNT(*) AS remainingMismatch
      FROM dbo.ResourceBookTopicTests tt
      JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
      LEFT JOIN (SELECT test_id, COUNT(*) AS key_count FROM dbo.TestAnswerKeys GROUP BY test_id) ak ON ak.test_id = tt.id
      WHERE t.resource_book_id = @b AND ISNULL(tt.question_count, 0) <> ISNULL(ak.key_count, 0);
    `)
    console.log('Kalan uyumsuzluk:', after.recordset[0].remainingMismatch)
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Sync failed')
  console.error(error)
  process.exit(1)
})
