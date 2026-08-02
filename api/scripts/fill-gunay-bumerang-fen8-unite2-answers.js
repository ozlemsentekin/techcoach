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

const PUBLISHER_NAME = 'Günay Yayınları'
const BOOK_NAME = 'Bumerang Serisi Fen Bilimleri'
const UNITE_NAME = '2. Ünite - DNA ve Genetik Kod'

// Transcribed directly from the photo (17 rows: Kavratan 1-10, Bumerang 1-5, Beceri Temelli 1-2 —
// matches the 2. Ünite structure, not 1. Ünite which only has 8 tests and was already filled).
const TESTS = [
  ['Kavratan Test-1', 'ACDBBACBAD'],
  ['Kavratan Test-2', 'CBBADDCBA'],
  ['Bumerang Test-1', 'BDCAD'],
  ['Kavratan Test-3', 'BCDABCAD'],
  ['Kavratan Test-4', 'CDCBAADB'],
  ['Bumerang Test-2', 'ADBC'],
  ['Kavratan Test-5', 'ACBBCBDA'],
  ['Kavratan Test-6', 'BDCDABC'],
  ['Bumerang Test-3', 'ABDA'],
  ['Kavratan Test-7', 'BACDBAC'],
  ['Kavratan Test-8', 'CDBBAA'],
  ['Bumerang Test-4', 'BADC'],
  ['Kavratan Test-9', 'CBABCDA'],
  ['Kavratan Test-10', 'BADDCCA'],
  ['Bumerang Test-5', 'BCDA'],
  ['Beceri Temelli Test-1', 'DAACDCBBA'],
  ['Beceri Temelli Test-2', 'DCBADBBAC'],
]

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING is missing.')

  const pool = await sql.connect(connectionString)

  try {
    const bookResult = await pool
      .request()
      .input('publisherName', sql.NVarChar(150), PUBLISHER_NAME)
      .input('bookName', sql.NVarChar(200), BOOK_NAME).query(`
        SELECT rb.id FROM dbo.ResourceBooks rb
        INNER JOIN dbo.Publishers p ON p.id = rb.publisher_id
        WHERE p.name = @publisherName AND rb.name = @bookName;
      `)
    if (!bookResult.recordset.length) throw new Error('ResourceBook not found')
    const resourceBookId = bookResult.recordset[0].id

    const testsResult = await pool
      .request()
      .input('resourceBookId', sql.UniqueIdentifier, resourceBookId)
      .input('uniteName', sql.NVarChar(200), UNITE_NAME).query(`
        SELECT tt.id, tt.name, tt.question_count
        FROM dbo.ResourceBookTopicTests tt
        INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
        WHERE t.resource_book_id = @resourceBookId AND t.name = @uniteName;
      `)
    const testByName = new Map(testsResult.recordset.map((r) => [r.name, r]))

    if (testByName.size !== TESTS.length) {
      throw new Error(`Expected ${TESTS.length} tests in ${UNITE_NAME}, found ${testByName.size}`)
    }

    for (const [testName, answers] of TESTS) {
      const row = testByName.get(testName)
      if (!row) throw new Error(`Test not found: ${testName}`)

      const letters = answers.split('')

      await pool
        .request()
        .input('id', sql.UniqueIdentifier, row.id)
        .input('questionCount', sql.Int, letters.length)
        .query('UPDATE dbo.ResourceBookTopicTests SET question_count = @questionCount WHERE id = @id;')

      const existingAnswers = await pool
        .request()
        .input('testId', sql.UniqueIdentifier, row.id)
        .query('SELECT COUNT(*) AS cnt FROM dbo.TestAnswerKeys WHERE test_id = @testId;')
      if (existingAnswers.recordset[0].cnt > 0) {
        console.log(`Skip (already has answer key): ${testName}`)
        continue
      }

      const request = pool.request().input('testId', sql.UniqueIdentifier, row.id)
      const values = []
      letters.forEach((label, idx) => {
        const orderParam = `order${idx}`
        const labelParam = `label${idx}`
        request.input(orderParam, sql.Int, idx + 1)
        request.input(labelParam, sql.NChar(1), label)
        values.push(`(@testId, @${orderParam}, @${labelParam})`)
      })
      await request.query(`
        INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label)
        VALUES ${values.join(', ')};
      `)

      console.log(`${testName}: question_count ${row.question_count} -> ${letters.length}, ${letters.length} answer(s) inserted`)
    }

    console.log('\n2. Ünite tamamlandı.')
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Fill failed')
  console.error(error)
  process.exit(1)
})
