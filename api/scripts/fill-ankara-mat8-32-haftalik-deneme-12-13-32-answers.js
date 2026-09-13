const fs = require('fs')
const path = require('path')
const sql = require('mssql')

const localSettingsPath = path.join(__dirname, '..', 'local.settings.json')

function loadLocalSettings() {
  if (!fs.existsSync(localSettingsPath)) return
  const parsed = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'))
  Object.entries(parsed.Values || {}).forEach(([key, value]) => {
    if (!process.env[key] && typeof value === 'string') {
      process.env[key] = value
    }
  })
}

const PUBLISHER_NAME = 'Ankara Yayıncılık'
// DB'deki tam ad "Matematik Güçlendiren 32 Haftalık Kazanım Denemeleri  8. Sınıf"
// (çift boşluk dahil) olduğu için LIKE ile eşliyoruz.
const BOOK_NAME_LIKE = '%32 Haftalık Kazanım Denemeleri%'

// Completes the three answer keys that were left unset by
// seed-ankara-mat8-32-haftalik-denemeler-answers.js. Transcribed from the
// book's own "Cevap Anahtarı" pages (user-supplied close-up photos, 2026-09-08).
// Deneme 12 and 13 only have 16 questions on the key; Deneme 32 has 20. The
// existing question_count values are placeholders and get corrected to match.
const ANSWER_KEYS = {
  12: 'CDDABDDBDCCBADBD',
  13: 'DABCBBDCACADCBBD',
  32: 'ACBDCADDAADCCBCBBCCB',
}

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING is missing.')

  const pool = await sql.connect(connectionString)

  try {
    const bookResult = await pool
      .request()
      .input('publisherName', sql.NVarChar(150), PUBLISHER_NAME)
      .input('bookNameLike', sql.NVarChar(200), BOOK_NAME_LIKE).query(`
        SELECT rb.id, rb.name FROM dbo.ResourceBooks rb
        INNER JOIN dbo.Publishers p ON p.id = rb.publisher_id
        WHERE p.name = @publisherName AND rb.name LIKE @bookNameLike;
      `)
    if (bookResult.recordset.length !== 1) {
      throw new Error(
        `Expected exactly 1 ResourceBook, got ${bookResult.recordset.length}: ` +
          bookResult.recordset.map((r) => r.name).join(' | ')
      )
    }
    const resourceBookId = bookResult.recordset[0].id
    console.log(`Book: ${bookResult.recordset[0].name}`)

    const testsResult = await pool
      .request()
      .input('resourceBookId', sql.UniqueIdentifier, resourceBookId).query(`
        SELECT tt.id, tt.name, tt.question_count
        FROM dbo.ResourceBookTopicTests tt
        INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
        WHERE t.resource_book_id = @resourceBookId;
      `)
    const testByName = new Map(testsResult.recordset.map((r) => [r.name, r]))

    let inserted = 0
    for (const [testNo, answers] of Object.entries(ANSWER_KEYS)) {
      const testName = `Deneme ${testNo}`
      const test = testByName.get(testName)
      if (!test) throw new Error(`Test not found: ${testName}`)

      const existing = await pool
        .request()
        .input('testId', sql.UniqueIdentifier, test.id)
        .query('SELECT COUNT(*) AS cnt FROM dbo.TestAnswerKeys WHERE test_id = @testId;')
      if (existing.recordset[0].cnt > 0) {
        console.log(`Skip (already has answer key): ${testName}`)
        continue
      }

      if (test.question_count !== answers.length) {
        await pool
          .request()
          .input('testId', sql.UniqueIdentifier, test.id)
          .input('qc', sql.Int, answers.length)
          .query('UPDATE dbo.ResourceBookTopicTests SET question_count = @qc WHERE id = @testId;')
        console.log(
          `${testName}: question_count ${test.question_count} -> ${answers.length}`
        )
      }

      const letters = answers.split('')
      const values = []
      const request = pool.request().input('testId', sql.UniqueIdentifier, test.id)
      letters.forEach((label, idx) => {
        request.input(`order${idx}`, sql.Int, idx + 1)
        request.input(`label${idx}`, sql.NChar(1), label)
        values.push(`(@testId, @order${idx}, @label${idx})`)
      })
      await request.query(`
        INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label)
        VALUES ${values.join(', ')};
      `)
      inserted += 1
      console.log(`${testName}: ${letters.length} answer(s) inserted`)
    }

    console.log(`Done. Tests updated: ${inserted}`)
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Fill failed')
  console.error(error)
  process.exit(1)
})
