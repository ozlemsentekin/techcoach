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
const BOOK_NAME = 'Güçlendiren 32 Haftalık Kazanım Denemeleri Matematik'

// Transcribed from the book's own "Cevap Anahtarı" summary pages.
// Deneme 12, 13 and 32 are intentionally omitted: the photos cut off before
// questions 17-20 (and 7-10 for Deneme 32), so those answer keys are left
// unset for now and should be completed later via the admin panel.
const ANSWER_KEYS = {
  1: 'CADDCBCDCBADBAADCBDA',
  2: 'ABCDCAAADACDCBCBCDCD',
  3: 'ACCBBCBDADACBCCBBCCD',
  4: 'ADADBBCABDCDCBBCACDB',
  5: 'DDBDCCBABDBABACBBACA',
  6: 'ACDABBACABDCCDCBDBCB',
  7: 'BBABCBCCDABCBCDACAAC',
  8: 'ACCADADBCCADBABBDCDA',
  9: 'BBCBDABABCACAABCDBCB',
  10: 'DDBBAADDBDCCDCBBBBDD',
  11: 'BDACCCBBBACBAABABAAC',
  14: 'CDCDDBBDBBBACCABBAAC',
  15: 'CBABCBCACCABCACDBABA',
  16: 'BBCBCDACBADAADCCBDBA',
  17: 'AADACDACBDDBDCDACCDD',
  18: 'CADDACBDADCADBDADCAD',
  19: 'ADDBBBCABCCDBAADBCCB',
  20: 'CCADBCDADCAAABBDDCCD',
  21: 'BBCCAAABCADBDABCDBCC',
  22: 'BDCCDCABDCDDBDCDBBCB',
  23: 'CCDABBCDBDBCDBCCBDAA',
  24: 'BCDBDCBDCABCCADDBBBC',
  25: 'ACBCBDDBACBCCDBBABBC',
  26: 'CDBCABCDAABCCCABCBAA',
  27: 'ABACDCCDCDBCBCAABACD',
  28: 'CBCDBBCBBBABBBBBCCBA',
  29: 'ACDDDDCCBDDBBDBDCCBA',
  30: 'CDBCCAACACACCDBDDCAD',
  31: 'BBADACDDAABBDBCABDAA',
}

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING is missing.')

  for (const [testNo, answers] of Object.entries(ANSWER_KEYS)) {
    if (answers.length !== 20) {
      throw new Error(`Deneme ${testNo}: expected 20 answers, got ${answers.length}`)
    }
  }

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
      .input('resourceBookId', sql.UniqueIdentifier, resourceBookId).query(`
        SELECT tt.id, tt.name
        FROM dbo.ResourceBookTopicTests tt
        INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
        WHERE t.resource_book_id = @resourceBookId;
      `)
    const testIdByName = new Map(testsResult.recordset.map((r) => [r.name, r.id]))

    let inserted = 0
    for (const [testNo, answers] of Object.entries(ANSWER_KEYS)) {
      const testName = `Deneme ${testNo}`
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
      console.log(`${testName}: 20 answer(s) inserted`)
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
