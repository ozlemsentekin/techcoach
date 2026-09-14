// "Bumerang Serisi - T.C. İnkılap Tarihi ve Atatürkçülük - 8. Sınıf" (Günay Yayınları)
// 3. Ünite - Milli Bir Destan: Ya İstiklal Ya Ölüm testlerinin cevap anahtarını
// kullanıcının gönderdiği fotoğraflardan birebir girer.
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

const RESOURCE_BOOK_ID = '3184F4E4-E4CF-4CEB-91B3-56FF04765B82'
const TOPIC_NAME = '3. Ünite - Milli Bir Destan: Ya İstiklal Ya Ölüm'

const ANSWER_KEYS = {
  'Kavratan Testler-1': 'ADCBDDBD',
  'Kavratan Testler-2': 'BABCBCA',
  'Kavratan Testler-3': 'DAABCDCDA',
  'Kavratan Testler-4': 'BCDDAC',
  'Kavratan Testler-5': 'BBCDCBDC',
  'Bumerang Testler-1': 'DDCBAD',
  'Beceri Testleri-1': 'BDBCDDBDDD',
  'Beceri Testleri-2': 'ABDBCBDD',
}

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING eksik.')

  const pool = await sql.connect(connectionString)
  try {
    const topicResult = await pool
      .request()
      .input('b', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .input('topicName', sql.NVarChar(200), TOPIC_NAME)
      .query('SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @b AND name = @topicName;')
    if (!topicResult.recordset.length) throw new Error(`Konu bulunamadı: ${TOPIC_NAME}`)
    const topicId = topicResult.recordset[0].id

    const testsResult = await pool
      .request()
      .input('topicId', sql.UniqueIdentifier, topicId)
      .query('SELECT id, name FROM dbo.ResourceBookTopicTests WHERE topic_id = @topicId;')

    const testIdByName = new Map(testsResult.recordset.map((row) => [row.name, row.id]))

    let updated = 0
    let answerRows = 0
    let skipped = 0

    for (const [testName, answerString] of Object.entries(ANSWER_KEYS)) {
      const testId = testIdByName.get(testName)
      if (!testId) throw new Error(`Test bulunamadı: ${testName}`)

      const answers = answerString.split('')

      const existing = await pool
        .request()
        .input('testId', sql.UniqueIdentifier, testId)
        .query('SELECT COUNT(*) AS cnt FROM dbo.TestAnswerKeys WHERE test_id = @testId;')
      if (existing.recordset[0].cnt > 0) {
        console.log(`= ${testName}: cevap anahtarı zaten var — atlandı`)
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
      console.log(`+ ${testName}: ${answerString}`)
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
