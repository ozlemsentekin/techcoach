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
    const book = await pool.request().query(`
      SELECT rb.id, rb.name, p.name AS publisher, s.name AS subject, rb.grade, rb.is_active
      FROM dbo.ResourceBooks rb
      LEFT JOIN dbo.Publishers p ON p.id = rb.publisher_id
      LEFT JOIN dbo.Subjects s ON s.id = rb.subject_id
      WHERE rb.name = N'Bumerang Serisi' AND p.name = N'Günay Yayınları';
    `)
    if (!book.recordset.length) throw new Error('Bumerang Serisi bulunamadı')
    const b = book.recordset[0]
    console.log(`${b.name} / ${b.publisher} / ${b.subject} / sinif ${b.grade} / aktif=${b.is_active}`)
    console.log(`book_id = ${b.id}\n`)

    const rows = await pool.request().input('b', sql.UniqueIdentifier, b.id).query(`
      SELECT t.name AS topic, t.id AS topic_id,
             tt.id AS test_id, tt.name AS test, tt.page_start, tt.question_count,
             ISNULL(ak.cnt, 0) AS answer_count
      FROM dbo.ResourceBookTopics t
      JOIN dbo.ResourceBookTopicTests tt ON tt.topic_id = t.id
      LEFT JOIN (SELECT test_id, COUNT(*) cnt FROM dbo.TestAnswerKeys GROUP BY test_id) ak ON ak.test_id = tt.id
      WHERE t.resource_book_id = @b
      ORDER BY t.name, tt.page_start, tt.name;
    `)

    let cur = null
    for (const r of rows.recordset) {
      if (r.topic !== cur) { cur = r.topic; console.log(`\n### ${r.topic}`) }
      const flag = r.question_count > r.answer_count ? 'EKSİK' : 'tam  '
      console.log(`  [${flag}] ${r.test.padEnd(22)} s.${String(r.page_start ?? '-').padStart(4)}  ${r.answer_count}/${r.question_count}  test_id=${r.test_id}`)
    }

    const missing = rows.recordset.filter((r) => r.question_count > r.answer_count)
    console.log(`\n\nEKSİK ${missing.length} test, toplam ${missing.reduce((a, r) => a + r.question_count, 0)} cevap girilecek.`)
  } finally {
    await pool.close()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
