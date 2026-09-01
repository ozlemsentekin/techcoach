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

async function main() {
  loadLocalSettings()
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const q = `
      SELECT rb.name AS book_name, rb.scope, rb.resource_type, rb.is_active, rb.grade,
             p.name AS publisher_name, s.name AS subject_name,
             rbt.name AS topic_name, tt.name AS test_name,
             tt.question_count, ISNULL(ak.answer_count, 0) AS answer_count
      FROM dbo.ResourceBooks rb
      LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
      LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
      INNER JOIN dbo.ResourceBookTopics rbt ON rbt.resource_book_id = rb.id
      INNER JOIN dbo.ResourceBookTopicTests tt ON tt.topic_id = rbt.id
      LEFT JOIN (
        SELECT test_id, COUNT(*) AS answer_count
        FROM dbo.TestAnswerKeys GROUP BY test_id
      ) ak ON ak.test_id = tt.id
      WHERE tt.question_count > ISNULL(ak.answer_count, 0)
      ORDER BY rb.scope, s.name, rb.name, rbt.name, tt.page_start, tt.name;
    `
    const r = await pool.request().query(q)
    let cur = null
    for (const row of r.recordset) {
      const key = row.book_name
      if (key !== cur) {
        cur = key
        console.log(`\n=== [${row.scope}/${row.resource_type}] ${row.book_name} — ${row.subject_name} / ${row.publisher_name} / sinif ${row.grade} / aktif=${row.is_active}`)
      }
      console.log(`   ${row.topic_name}  ›  ${row.test_name}  (${row.answer_count}/${row.question_count} cevap)`)
    }
    console.log('')
  } finally {
    await pool.close()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
