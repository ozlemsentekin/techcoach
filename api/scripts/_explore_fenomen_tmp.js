const fs = require('fs')
const path = require('path')
const sql = require('mssql')
const localSettingsPath = path.join(__dirname, '..', 'local.settings.json')
const parsed = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'))
Object.entries(parsed.Values || {}).forEach(([key, value]) => {
  if (!process.env[key] && typeof value === 'string') process.env[key] = value
})

async function main() {
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  const book = await pool.request()
    .input('publisherName', sql.NVarChar(150), 'Fenomen Yayınları')
    .query(`
      SELECT rb.id, rb.name, rb.resource_type, rb.subject_id, s.name AS subject
      FROM dbo.ResourceBooks rb
      INNER JOIN dbo.Publishers p ON p.id = rb.publisher_id
      LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
      WHERE p.name = @publisherName;
    `)
  console.log('Books:', JSON.stringify(book.recordset, null, 2))

  if (!book.recordset.length) return
  const resourceBookId = book.recordset.find(b => b.name.includes('Matematik'))?.id || book.recordset[0].id

  const topics = await pool.request()
    .input('resourceBookId', sql.UniqueIdentifier, resourceBookId)
    .query(`
      SELECT t.id AS topic_id, t.name AS topic_name,
        tt.id AS test_id, tt.name AS test_name, tt.topic_name AS test_topic_name,
        tt.question_count,
        (SELECT COUNT(*) FROM dbo.TestAnswerKeys ak WHERE ak.test_id = tt.id) AS answer_count
      FROM dbo.ResourceBookTopics t
      LEFT JOIN dbo.ResourceBookTopicTests tt ON tt.topic_id = t.id
      WHERE t.resource_book_id = @resourceBookId
      ORDER BY t.name, tt.name;
    `)
  console.log('Total rows:', topics.recordset.length)
  console.log(JSON.stringify(topics.recordset, null, 2))
  await pool.close()
}
main().catch(e => { console.error(e); process.exit(1) })
