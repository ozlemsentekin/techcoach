// MEB 2027 LGS Böyle Sorar Soru Bankası - Fen Bilimleri - 8. Sınıf
// 5., 6., 7. üniteler (kitabın son ünitesi). Sayfa no'ları içindekiler
// ekranındaki ünite başlangıç sayfalarına göre orantılı dağıtıldı; 7. ünitenin
// kitap sonu kesin sayfası bilinmediği için tahmini bırakıldı.
// Cevap anahtarları kitabın kendi "Cevap Anahtarı" sayfalarından transkribe edildi.
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

const TOPICS = [
  {
    topicId: '47AD8602-C0E4-45CA-BABB-EDCFEB5E7F54',
    topicName: '5. Ünite - Basit Makineler',
    tests: [
      { name: 'Test1', pageStart: 203, pageEnd: 210 },
      { name: 'Test2', pageStart: 211, pageEnd: 217 },
      { name: 'Test3', pageStart: 218, pageEnd: 224 },
      { name: 'Test4', pageStart: 225, pageEnd: 231 },
      { name: 'Test5', pageStart: 232, pageEnd: 240 },
    ],
    answers: {
      1: 'DAABBDBBBBDDBDCBDDBD',
      2: 'ADDCDCCDCDBDDBDACABD',
      3: 'CCBAADACDDADDCACCBDC',
      4: 'ACDDBDAACCBCCCDBCBAB',
      5: 'DDBBADADCACBADDADBBB',
    },
  },
  {
    topicId: '9E045349-188B-4FE3-9F57-30E055BACF62',
    topicName: '6. Ünite - Enerji Dönüşümleri ve Çevre Bilimi',
    tests: [
      { name: 'Test1', pageStart: 241, pageEnd: 247 },
      { name: 'Test2', pageStart: 248, pageEnd: 254 },
      { name: 'Test3', pageStart: 255, pageEnd: 261 },
      { name: 'Test4', pageStart: 262, pageEnd: 268 },
      { name: 'Test5', pageStart: 269, pageEnd: 276 },
    ],
    answers: {
      1: 'DCDCCDDBDCDCBCCDDBBC',
      2: 'DCDDBBDDBDCACCBCDBAB',
      3: 'DCCDCBBDDAABDCDDDCDD',
      4: 'ACABDBDBCCDADCCBDDBD',
      5: 'DDBDBBBDBBBDCDBCDDDD',
    },
  },
  {
    topicId: '9B6AB746-8755-4012-960C-6DF1ECA58899',
    topicName: '7. Ünite - Elektrik Yükleri ve Elektrik Enerjisi',
    tests: [
      { name: 'Test1', pageStart: 277, pageEnd: 283 },
      { name: 'Test2', pageStart: 284, pageEnd: 290 },
      { name: 'Test3', pageStart: 291, pageEnd: 297 },
      { name: 'Test4', pageStart: 298, pageEnd: 305 },
    ],
    answers: {
      1: 'CBDCBDDCCBADDBDDABAA',
      2: 'ADCBDCAADCDDACABCABB',
      3: 'ADACAADABDCADCAAADCA',
      4: 'CAADBADDDACCDCBABBAD',
    },
  },
]

async function main() {
  loadLocalSettings()
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    let testsCreated = 0
    let answersInserted = 0

    for (const topic of TOPICS) {
      const existing = await pool
        .request()
        .input('topicId', sql.UniqueIdentifier, topic.topicId)
        .query('SELECT COUNT(*) AS cnt FROM dbo.ResourceBookTopicTests WHERE topic_id = @topicId;')
      if (existing.recordset[0].cnt > 0) {
        console.log(`Skip (testler zaten var): ${topic.topicName}`)
      } else {
        for (const test of topic.tests) {
          const pageCount = test.pageEnd - test.pageStart + 1
          await pool
            .request()
            .input('topicId', sql.UniqueIdentifier, topic.topicId)
            .input('name', sql.NVarChar(200), test.name)
            .input('pageStart', sql.Int, test.pageStart)
            .input('pageEnd', sql.Int, test.pageEnd)
            .input('pageCount', sql.Int, pageCount)
            .query(`
              INSERT INTO dbo.ResourceBookTopicTests (topic_id, name, page_start, page_end, page_count)
              VALUES (@topicId, @name, @pageStart, @pageEnd, @pageCount);
            `)
          testsCreated += 1
          console.log(`+ Test oluşturuldu: ${topic.topicName} / ${test.name} (s.${test.pageStart}-${test.pageEnd})`)
        }
      }

      const testsResult = await pool
        .request()
        .input('topicId', sql.UniqueIdentifier, topic.topicId)
        .query('SELECT id, name FROM dbo.ResourceBookTopicTests WHERE topic_id = @topicId;')
      const testIdByName = new Map(testsResult.recordset.map((r) => [r.name, r.id]))

      for (const [testNo, letters] of Object.entries(topic.answers)) {
        const testName = `Test${testNo}`
        const testId = testIdByName.get(testName)
        if (!testId) throw new Error(`Test not found: ${topic.topicName} / ${testName}`)

        const existingKeys = await pool
          .request()
          .input('testId', sql.UniqueIdentifier, testId)
          .query('SELECT COUNT(*) AS cnt FROM dbo.TestAnswerKeys WHERE test_id = @testId;')
        if (existingKeys.recordset[0].cnt > 0) {
          console.log(`Skip (cevap anahtarı zaten var): ${topic.topicName} / ${testName}`)
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
        console.log(`${topic.topicName} / ${testName}: ${labels.length} cevap eklendi`)
      }
    }

    console.log(`Oluşturulan test sayısı: ${testsCreated}`)
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
