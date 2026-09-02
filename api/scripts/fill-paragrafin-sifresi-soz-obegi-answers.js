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

// "Paragrafın Şifresi" (7. Sınıf) — "1. Söz Öbeği Metodu" İçeriğindeki iki testin
// cevap anahtarları. Kaynağın kendi cevap anahtarı sayfasından birebir alındı.
const RESOURCE_BOOK_ID = 'F9639A95-BC60-4DF9-96F5-D80FC1161799'

// [test_id, görünen ad, soru sayısı, cevaplar]
const ENTRIES = [
  ['CEDEB2D0-010D-4AB5-A048-FE2603AAF203', '1.Test', 12, 'ABBCABCADBCC'],
  ['3EF943FA-70D1-4448-9D11-1E63571044A0', 'Test 2', 12, 'ADDBACDAADBC'],
]

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')

  for (const [testId, name, count, answers] of ENTRIES) {
    if (answers.length !== count) throw new Error(`Length mismatch: ${name} (${testId}) — ${count} beklendi, ${answers.length} geldi`)
    if (!/^[A-D]+$/.test(answers)) throw new Error(`Geçersiz cevap dizisi: ${name} — ${answers}`)
  }

  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    let inserted = 0
    let skipped = 0
    for (const [testId, name, count, answers] of ENTRIES) {
      const row = await pool
        .request()
        .input('id', sql.UniqueIdentifier, testId)
        .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID).query(`
          SELECT tt.id, tt.name, tt.question_count,
            (SELECT COUNT(*) FROM dbo.TestAnswerKeys k WHERE k.test_id = tt.id) AS answer_count
          FROM dbo.ResourceBookTopicTests tt
          INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
          WHERE tt.id = @id AND t.resource_book_id = @rbId;
        `)
      if (!row.recordset.length) throw new Error(`Test bulunamadı: ${name} (${testId})`)
      const test = row.recordset[0]

      // Soru sayısını cevap anahtarıyla hizala (Test 2'de question_count NULL).
      if (test.question_count !== count) {
        await pool
          .request()
          .input('id', sql.UniqueIdentifier, testId)
          .input('count', sql.Int, count)
          .query('UPDATE dbo.ResourceBookTopicTests SET question_count = @count WHERE id = @id;')
        console.log(`${name}: question_count ${test.question_count ?? 'NULL'} -> ${count}`)
      }

      if (test.answer_count > 0) {
        console.log(`${name}: zaten ${test.answer_count} cevap var, atlanıyor.`)
        skipped += 1
        continue
      }

      const req = pool.request().input('testId', sql.UniqueIdentifier, testId)
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
