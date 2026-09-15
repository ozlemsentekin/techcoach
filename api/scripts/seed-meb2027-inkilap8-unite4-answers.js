// MEB 2027 LGS Böyle Sorar - T.C. Inkilap Tarihi ve Atatürkçülük - 8. Sınıf
// 4. Ünite - Atatürkçülük ve Çağdaşlaşan Türkiye
// Kitabın kendi "Cevap Anahtarı" sayfasından transkribe edildi.
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

const TOPIC_ID = '2C139741-5303-402D-A315-BCC65F629074'
const TOPIC_NAME = '4. Ünite - Atatürkçülük ve Çağdaşlaşan Türkiye'

const ANSWERS = {
  1: 'DDBBCCCDCB',
  2: 'DABDCDACBD',
  3: 'BCACDDDBBC',
  4: 'AABCBADDAB',
  5: 'DACABABBCB',
  6: 'ACBACDBABD',
  7: 'BBDBCADACC',
  8: 'BAAABBBCBA',
  9: 'BBADBCBCBC',
  10: 'BCBABACCBA',
  11: 'CBDDCDCCDA',
  12: 'AABBCCDCDD',
  13: 'ABDDCCACDC',
  14: 'CBACCCACDC',
}

async function main() {
  loadLocalSettings()
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const testsResult = await pool
      .request()
      .input('topicId', sql.UniqueIdentifier, TOPIC_ID)
      .query('SELECT id, name FROM dbo.ResourceBookTopicTests WHERE topic_id = @topicId;')
    const testIdByName = new Map(testsResult.recordset.map((r) => [r.name, r.id]))

    let inserted = 0
    for (const [testNo, answers] of Object.entries(ANSWERS)) {
      const testName = `Test${testNo}`
      const testId = testIdByName.get(testName)
      if (!testId) throw new Error(`Test not found: ${TOPIC_NAME} / ${testName}`)

      const existing = await pool
        .request()
        .input('testId', sql.UniqueIdentifier, testId)
        .query('SELECT COUNT(*) AS cnt FROM dbo.TestAnswerKeys WHERE test_id = @testId;')
      if (existing.recordset[0].cnt > 0) {
        console.log(`Skip (already has answer key): ${TOPIC_NAME} / ${testName}`)
        continue
      }

      const letters = answers.split('')
      const values = []
      const request = pool.request().input('testId', sql.UniqueIdentifier, testId)
      letters.forEach((label, idx) => {
        request.input(`order${idx}`, sql.Int, idx + 1)
        request.input(`label${idx}`, sql.NChar(1), label)
        values.push(`(@testId, @order${idx}, @label${idx})`)
      })
      await request.query(`
        INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label)
        VALUES ${values.join(', ')};
      `)

      await pool
        .request()
        .input('testId', sql.UniqueIdentifier, testId)
        .input('questionCount', sql.Int, letters.length)
        .query('UPDATE dbo.ResourceBookTopicTests SET question_count = @questionCount WHERE id = @testId;')

      inserted += 1
      console.log(`${TOPIC_NAME} / ${testName}: ${letters.length} answer(s) inserted`)
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
