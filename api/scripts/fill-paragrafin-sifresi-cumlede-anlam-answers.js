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

// "Paragrafın Şifresi" (7. Sınıf) — "2. Cümlede Anlam Özelliği Metodu" İçeriğindeki
// iki testin cevap anahtarları. Kaynağın kendi cevap anahtarı sayfasından birebir alındı.
const RESOURCE_BOOK_ID = 'F9639A95-BC60-4DF9-96F5-D80FC1161799'
const TOPIC_ID = 'CFC5EE02-3E9F-4450-8027-D3F4E319D03D'

// [test adı, soru sayısı, cevaplar]
const ENTRIES = [
  ['Test 1', 12, 'CCBADDBCBDAD'],
  ['Test 2', 12, 'DAADCDBDDDBB'],
]

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')

  for (const [name, count, answers] of ENTRIES) {
    if (answers.length !== count) throw new Error(`Length mismatch: ${name} — ${count} beklendi, ${answers.length} geldi`)
    if (!/^[A-D]+$/.test(answers)) throw new Error(`Geçersiz cevap dizisi: ${name} — ${answers}`)
  }

  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    let inserted = 0
    let skipped = 0
    for (const [name, count, answers] of ENTRIES) {
      const row = await pool
        .request()
        .input('topicId', sql.UniqueIdentifier, TOPIC_ID)
        .input('name', sql.NVarChar(200), name).query(`
          SELECT tt.id, tt.question_count,
            (SELECT COUNT(*) FROM dbo.TestAnswerKeys k WHERE k.test_id = tt.id) AS answer_count
          FROM dbo.ResourceBookTopicTests tt
          WHERE tt.topic_id = @topicId AND tt.name = @name;
        `)
      if (!row.recordset.length) throw new Error(`Test bulunamadı: ${name} (topic ${TOPIC_ID})`)
      if (row.recordset.length > 1) throw new Error(`Birden fazla test eşleşti: ${name}`)
      const test = row.recordset[0]

      if (test.question_count !== count) {
        await pool
          .request()
          .input('id', sql.UniqueIdentifier, test.id)
          .input('count', sql.Int, count)
          .query('UPDATE dbo.ResourceBookTopicTests SET question_count = @count WHERE id = @id;')
        console.log(`${name}: question_count ${test.question_count ?? 'NULL'} -> ${count}`)
      }

      if (test.answer_count > 0) {
        console.log(`${name}: zaten ${test.answer_count} cevap var, atlanıyor.`)
        skipped += 1
        continue
      }

      const req = pool.request().input('testId', sql.UniqueIdentifier, test.id)
      const values = []
      answers.split('').forEach((label, idx) => {
        req.input(`o${idx}`, sql.Int, idx + 1)
        req.input(`l${idx}`, sql.NChar(1), label)
        values.push(`(@testId, @o${idx}, @l${idx})`)
      })
      await req.query(`INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label) VALUES ${values.join(', ')};`)
      inserted += 1
      console.log(`${name}: ${count} cevap eklendi -> ${answers.split('').map((l, i) => `${i + 1}${l}`).join(' ')}`)
    }

    console.log(`\nBitti. Eklenen test: ${inserted}, atlanan: ${skipped}`)
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Fill failed')
  console.error(error)
  process.exit(1)
})
