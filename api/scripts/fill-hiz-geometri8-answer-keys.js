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
const BOOK_NAME = '8. Sınıf Geometri Soru Bankası'

// Kitabın basılı Yanıt Anahtarı'ndan (s.128) birebir. Her testte 4 soru.
const ANSWER_KEYS = {
  1: 'AADC', 2: 'BDAC', 3: 'CABA', 4: 'BDBC', 5: 'CDBD',
  6: 'CBAD', 7: 'BCCD', 8: 'BACB', 9: 'ADCC', 10: 'DDAC',
  11: 'DBBA', 12: 'DABD', 13: 'ADBB', 14: 'CBAC', 15: 'AADB',
  16: 'BADB', 17: 'BACB', 18: 'CBAA', 19: 'BCBD', 20: 'CDCB',
  21: 'CBAC', 22: 'DDAB', 23: 'BBAC', 24: 'ABCC', 25: 'ADAC',
  26: 'CBDB', 27: 'ACAD', 28: 'CDDA', 29: 'CDBB', 30: 'ACBD',
  31: 'BCCD', 32: 'ACAD', 33: 'CBBA', 34: 'CCBA', 35: 'BCDC',
  36: 'DBDA', 37: 'AABD', 38: 'DABD', 39: 'BDCB', 40: 'CACD',
  41: 'DBAD', 42: 'CDCB', 43: 'BABC', 44: 'ADAC', 45: 'DCCA',
  46: 'BBCA', 47: 'BACB', 48: 'ACAD', 49: 'CDDB', 50: 'ACBB',
  51: 'BAAD', 52: 'CBBA', 53: 'BCCD', 54: 'CDDA', 55: 'BACB',
  56: 'DDAB', 57: 'ABCC', 58: 'ABAD', 59: 'CCBD', 60: 'CDCB',
}

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING eksik.')

  const testNos = Object.keys(ANSWER_KEYS).map(Number)
  if (testNos.length !== 60) throw new Error(`60 test bekleniyordu, ${testNos.length} bulundu`)

  const pool = await sql.connect(connectionString)
  try {
    const bookResult = await pool
      .request()
      .input('publisherName', sql.NVarChar(150), PUBLISHER_NAME)
      .input('bookName', sql.NVarChar(200), BOOK_NAME).query(`
        SELECT rb.id
        FROM dbo.ResourceBooks rb
        INNER JOIN dbo.Publishers p ON p.id = rb.publisher_id
        WHERE p.name = @publisherName AND rb.name = @bookName;
      `)
    if (!bookResult.recordset.length) throw new Error(`ResourceBook bulunamadı: ${BOOK_NAME}`)
    const resourceBookId = bookResult.recordset[0].id

    const testsResult = await pool
      .request()
      .input('resourceBookId', sql.UniqueIdentifier, resourceBookId).query(`
        SELECT tt.id, tt.name
        FROM dbo.ResourceBookTopicTests tt
        INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
        WHERE t.resource_book_id = @resourceBookId;
      `)

    const testIdByNo = new Map()
    for (const row of testsResult.recordset) {
      const match = /^Test (\d+)$/.exec(row.name)
      if (match) testIdByNo.set(Number(match[1]), row.id)
    }

    let updated = 0
    let answerRows = 0
    let skipped = 0

    for (const testNo of testNos) {
      const testId = testIdByNo.get(testNo)
      if (!testId) throw new Error(`Test ${testNo} veritabanında bulunamadı`)

      const answers = ANSWER_KEYS[testNo].split('')

      const existing = await pool
        .request()
        .input('testId', sql.UniqueIdentifier, testId)
        .query('SELECT COUNT(*) AS cnt FROM dbo.TestAnswerKeys WHERE test_id = @testId;')
      if (existing.recordset[0].cnt > 0) {
        console.log(`= Test ${testNo}: cevap anahtarı zaten var — atlandı`)
        skipped += 1
        continue
      }

      await pool
        .request()
        .input('testId', sql.UniqueIdentifier, testId)
        .input('questionCount', sql.Int, answers.length)
        .query('UPDATE dbo.ResourceBookTopicTests SET question_count = @questionCount WHERE id = @testId;')
      updated += 1

      const request = pool.request().input('testId', sql.UniqueIdentifier, testId)
      const values = []
      answers.forEach((label, idx) => {
        request.input(`order${idx}`, sql.Int, idx + 1)
        request.input(`label${idx}`, sql.NChar(1), label)
        values.push(`(@testId, @order${idx}, @label${idx})`)
      })
      await request.query(`
        INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label)
        VALUES ${values.join(', ')};
      `)
      answerRows += answers.length
      console.log(`+ Test ${testNo}: ${ANSWER_KEYS[testNo]}`)
    }

    console.log(
      `Bitti. Soru sayısı güncellenen test: ${updated}, cevap anahtarı satırı: ${answerRows}, atlanan: ${skipped}`,
    )
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Cevap anahtarı doldurma başarısız')
  console.error(error)
  process.exit(1)
})
