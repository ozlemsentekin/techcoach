// MEB 2027 LGS Böyle Sorar Soru Bankası - Fen Bilimleri - 8. Sınıf
// 4. Ünite - Madde ve Endüstri: sayfa 141-202 arası (5. ünite 203'te başlıyor),
// içindekiler ekranındaki ünite başlangıç sayfalarına göre orantılı dağıtıldı.
// Cevap anahtarı kitabın kendi "Cevap Anahtarı" sayfasından transkribe edildi.
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

const TOPIC_ID = '683AFA66-0499-4B90-904F-D895A029873A'

const NEW_TESTS = [
  { name: 'Test1', pageStart: 141, pageEnd: 147 },
  { name: 'Test2', pageStart: 148, pageEnd: 154 },
  { name: 'Test3', pageStart: 155, pageEnd: 161 },
  { name: 'Test4', pageStart: 162, pageEnd: 168 },
  { name: 'Test5', pageStart: 169, pageEnd: 175 },
  { name: 'Test6', pageStart: 176, pageEnd: 182 },
  { name: 'Test7', pageStart: 183, pageEnd: 189 },
  { name: 'Test8', pageStart: 190, pageEnd: 196 },
  { name: 'Test9', pageStart: 197, pageEnd: 202 },
]

const ANSWERS = {
  1: 'DDAAAACDADDCCDADDDDD',
  2: 'BDBCBBCBCDDCDCABCBBC',
  3: 'CCDCCCDDDBCDDAADADCC',
  4: 'CDCBBBDCDCDDDDDDBCCC',
  5: 'ACCDBCBCBCCDDCABDADC',
  6: 'DDDDADDBDBDCDDABABDD',
  7: 'ACBBCDBCDADBBDCBCDDB',
  8: 'DCDDCBDABDDBDCDACBBD',
  9: 'ACCDDBDCCACCDADBBBAB',
}

async function main() {
  loadLocalSettings()
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const existing = await pool
      .request()
      .input('topicId', sql.UniqueIdentifier, TOPIC_ID)
      .query('SELECT COUNT(*) AS cnt FROM dbo.ResourceBookTopicTests WHERE topic_id = @topicId;')
    if (existing.recordset[0].cnt > 0) {
      console.log('Skip (testler zaten var) — sadece cevap anahtarı işlenecek.')
    } else {
      for (const test of NEW_TESTS) {
        const pageCount = test.pageEnd - test.pageStart + 1
        await pool
          .request()
          .input('topicId', sql.UniqueIdentifier, TOPIC_ID)
          .input('name', sql.NVarChar(200), test.name)
          .input('pageStart', sql.Int, test.pageStart)
          .input('pageEnd', sql.Int, test.pageEnd)
          .input('pageCount', sql.Int, pageCount)
          .query(`
            INSERT INTO dbo.ResourceBookTopicTests (topic_id, name, page_start, page_end, page_count)
            VALUES (@topicId, @name, @pageStart, @pageEnd, @pageCount);
          `)
        console.log(`+ Test oluşturuldu: ${test.name} (s.${test.pageStart}-${test.pageEnd})`)
      }
    }

    const testsResult = await pool
      .request()
      .input('topicId', sql.UniqueIdentifier, TOPIC_ID)
      .query('SELECT id, name FROM dbo.ResourceBookTopicTests WHERE topic_id = @topicId;')
    const testIdByName = new Map(testsResult.recordset.map((r) => [r.name, r.id]))

    let answersInserted = 0
    for (const [testNo, letters] of Object.entries(ANSWERS)) {
      const testName = `Test${testNo}`
      const testId = testIdByName.get(testName)
      if (!testId) throw new Error(`Test not found: ${testName}`)

      const existingKeys = await pool
        .request()
        .input('testId', sql.UniqueIdentifier, testId)
        .query('SELECT COUNT(*) AS cnt FROM dbo.TestAnswerKeys WHERE test_id = @testId;')
      if (existingKeys.recordset[0].cnt > 0) {
        console.log(`Skip (cevap anahtarı zaten var): ${testName}`)
        continue
      }

      const labels = letters.split('')
      const values = []
      const request = pool.request().input('testId', sql.UniqueIdentifier, testId)
      labels.forEach((label, idx) => {
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
        .input('questionCount', sql.Int, labels.length)
        .query('UPDATE dbo.ResourceBookTopicTests SET question_count = @questionCount WHERE id = @testId;')

      answersInserted += 1
      console.log(`${testName}: ${labels.length} cevap eklendi`)
    }
    console.log(`Cevap anahtarı eklenen test sayısı: ${answersInserted}`)
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Seed failed')
  console.error(error)
  process.exit(1)
})
