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

const PUBLISHER_NAME = 'Çanta Yayınları'
const BOOK_NAME = 'Zaman Ayarlı Kazanım Soru Bankası - Matematik - 8. Sınıf'
const TOPIC_NAME = '12 · Geometrik Cisimler'

// Transcribed from the book's own "Cevap Anahtarı" summary pages.
const ANSWER_KEYS = {
  1: 'BDCBDABCB',
  2: 'BCBDAAC',
  3: 'BCA',
  4: 'BBCBCABA',
  5: 'DCDC',
  6: 'BCDDDAADCB',
  7: 'CBAB',
  8: 'ADAAADDCADA',
  9: 'CDACAB',
  10: 'BBDCA',
  11: 'DABBDADCBB',
  12: 'CBCB',
  13: 'BCACDACCB',
  14: 'DBBD',
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
      .input('bookName', sql.NVarChar(200), BOOK_NAME).query(`
        SELECT rb.id FROM dbo.ResourceBooks rb
        INNER JOIN dbo.Publishers p ON p.id = rb.publisher_id
        WHERE p.name = @publisherName AND rb.name = @bookName;
      `)
    if (!bookResult.recordset.length) throw new Error('ResourceBook not found')
    const resourceBookId = bookResult.recordset[0].id

    const topicResult = await pool
      .request()
      .input('resourceBookId', sql.UniqueIdentifier, resourceBookId)
      .input('topicName', sql.NVarChar(200), TOPIC_NAME)
      .query(`SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @resourceBookId AND name = @topicName;`)
    if (!topicResult.recordset.length) throw new Error('Topic not found: ' + TOPIC_NAME)
    const topicId = topicResult.recordset[0].id

    const testsResult = await pool
      .request()
      .input('topicId', sql.UniqueIdentifier, topicId).query(`
        SELECT id, name FROM dbo.ResourceBookTopicTests WHERE topic_id = @topicId;
      `)
    const testIdByName = new Map(testsResult.recordset.map((r) => [r.name, r.id]))

    let inserted = 0
    for (const [testNo, answers] of Object.entries(ANSWER_KEYS)) {
      const testName = `Test${testNo}`
      const testId = testIdByName.get(testName)
      if (!testId) {
        throw new Error(`Test not found: ${testName}`)
      }

      const existing = await pool
        .request()
        .input('testId', sql.UniqueIdentifier, testId)
        .query('SELECT COUNT(*) AS cnt FROM dbo.TestAnswerKeys WHERE test_id = @testId;')
      if (existing.recordset[0].cnt > 0) {
        console.log(`Skip (already has answer key): ${testName}`)
        continue
      }

      const letters = answers.split('')
      const values = []
      const request = pool.request().input('testId', sql.UniqueIdentifier, testId)
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
      inserted += 1
      console.log(`${testName}: ${letters.length} answer(s) inserted`)
    }

    console.log(`Done. Tests updated: ${inserted}`)
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Seed failed')
  console.error(error)
  process.exit(1)
})
