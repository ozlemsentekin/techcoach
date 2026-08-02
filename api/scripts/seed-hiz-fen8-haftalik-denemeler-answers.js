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

const PUBLISHER_NAME = 'Hız Yayınları'
const BOOK_NAME = '8. Sınıf Fen Bilimleri 36 Haftalık Kazanım Denemeleri'

// Transcribed from the book's own "Yanıt Anahtarı" summary page, Deneme 1 - Deneme 23.
const ANSWER_KEYS = {
  1: 'CADABCACADCBABCDDDBC',
  2: 'BDCDADCADABBACDCBDCD',
  3: 'DCBBCBDCACADABACBACD',
  4: 'CCBBDCCDADACACBADDAD',
  5: 'ADBBDCDDBCCCACACDDAD',
  6: 'CDABCDABCBACBDACCBCD',
  7: 'BABCDBCBCABCDCCBDBAD',
  8: 'CDACDBCABDCCADBACBCB',
  9: 'BDBACDBACBDBBACDDCBA',
  10: 'BDACBACACCDDBADBCBAB',
  11: 'DCDACBACBAABCCDDBADB',
  12: 'ACDBDCBAACCABDACDCDD',
  13: 'DCBDBBADACDCCCADCBDA',
  14: 'BCADBACADCAABBACBCCD',
  15: 'AACDDADBADBDBDABBCCD',
  16: 'ACCDBCCACBCDBDDACABB',
  17: 'CDCBDABDBABBABAAABCC',
  18: 'ABBBCDDACDBAADADDDAD',
  19: 'ADCDDBADCDCAADACBDAD',
  20: 'DBADCACADBADBACABACD',
  21: 'DCBADBBCCBCCDCCBCAAA',
  22: 'DBCDADACCACBADDCBBCA',
  23: 'DCADADACBBDCACBDABCB',
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
