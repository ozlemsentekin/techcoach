// MEB 2027 LGS Böyle Sorar - T.C. Inkilap Tarihi ve Atatürkçülük - 8. Sınıf
// Kitabın kendi "Cevap Anahtarı" sayfalarından transkribe edildi (5., 6., 7. üniteler).
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
    topicId: '069A7E0A-1EF8-4AB8-909E-ADDE7FAE0A12',
    topicName: '5. Ünite - Demokratikleşme Çabaları',
    answers: {
      1: 'BADABBDDDB',
      2: 'ACCDCCABDD',
      3: 'DCCDDCCCAA',
      4: 'ACCDBACCBB',
      5: 'BDBCCDBBAA',
    },
  },
  {
    topicId: 'F3FF8885-1566-4DA4-8291-320A77764A3B',
    topicName: '6. Ünite - Atatürk Dönemi Türk Dış Politikası',
    answers: {
      1: 'CBBBDDDBDD',
      2: 'CCABDBBACB',
      3: 'DBDDDADDDD',
      4: 'AABDAACDAD',
      5: 'BBDBCCCBCB',
    },
  },
  {
    topicId: 'AF08E408-6545-4A7F-9378-1DF66C7E76A6',
    topicName: "7. Ünite - Atatürk'ün Ölümü ve Sonrası",
    answers: {
      1: 'CABDCCDADA',
      2: 'DCCBAACACB',
      3: 'DBCDACBADD',
      4: 'DCCBBDCBDC',
      5: 'ACDCABDCDC',
    },
  },
]

async function main() {
  loadLocalSettings()
  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    let totalInserted = 0
    for (const topic of TOPICS) {
      const testsResult = await pool
        .request()
        .input('topicId', sql.UniqueIdentifier, topic.topicId)
        .query('SELECT id, name FROM dbo.ResourceBookTopicTests WHERE topic_id = @topicId;')
      const testIdByName = new Map(testsResult.recordset.map((r) => [r.name, r.id]))

      for (const [testNo, answers] of Object.entries(topic.answers)) {
        const testName = `Test${testNo}`
        const testId = testIdByName.get(testName)
        if (!testId) throw new Error(`Test not found: ${topic.topicName} / ${testName}`)

        const existing = await pool
          .request()
          .input('testId', sql.UniqueIdentifier, testId)
          .query('SELECT COUNT(*) AS cnt FROM dbo.TestAnswerKeys WHERE test_id = @testId;')
        if (existing.recordset[0].cnt > 0) {
          console.log(`Skip (already has answer key): ${topic.topicName} / ${testName}`)
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

        totalInserted += 1
        console.log(`${topic.topicName} / ${testName}: ${letters.length} answer(s) inserted`)
      }
    }
    console.log(`Done. Tests updated: ${totalInserted}`)
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Seed failed')
  console.error(error)
  process.exit(1)
})
