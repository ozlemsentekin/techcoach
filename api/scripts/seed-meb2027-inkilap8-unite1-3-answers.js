// MEB 2027 LGS Böyle Sorar - T.C. Inkilap Tarihi ve Atatürkçülük - 8. Sınıf
// Kitabın kendi "Cevap Anahtarı" sayfalarından transkribe edildi (1., 2., 3. üniteler).
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
    topicId: 'C17F1C7B-469B-4339-B0E3-65694FAEDB14',
    topicName: '1. Ünite - Bir Kahraman Doğuyor',
    answers: {
      1: 'CDDABDDDBC',
      2: 'CACBABBCCB',
      3: 'DCBCADBACD',
      4: 'CDCDCDDCDD',
      5: 'ACBCDCBDCD',
      6: 'DCDAABCCAD',
      7: 'DDDBBCDBBD',
      8: 'CDBBBADACD',
      9: 'CCADCACADA',
    },
  },
  {
    topicId: '6B5934FD-DAE2-4CF3-908A-319B3FB408EB',
    topicName: '2. Ünite - Milli Uyanış: Bağımsızlık Yolunda Atılan Adımlar',
    answers: {
      1: 'CCDBDBDACB',
      2: 'CCCDDDBDDD',
      3: 'DACBACABCC',
      4: 'ABCABCABDD',
      5: 'CDCCDACBCA',
      6: 'BBCDCBCCAC',
      7: 'CDCCBCCDBB',
      8: 'BCBCCBDDBD',
      9: 'DCBCCABBAD',
      10: 'DDCACCDCDC',
      11: 'BABBABCBAC',
      12: 'CCBBCDDDBA',
      13: 'DACAAACBCD',
      14: 'DABABBCBBB',
    },
  },
  {
    topicId: '8921CA05-E156-4BFB-8454-C5ED9130FFE5',
    topicName: '3. Ünite - Milli Bir Destan: Ya İstiklal Ya Ölüm',
    answers: {
      1: 'BBBDBBBDCA',
      2: 'BCAABCCCAA',
      3: 'BADCCADACD',
      4: 'ADBBDCBCBB',
      5: 'ABABBDCCBB',
      6: 'BCBDDCADDD',
      7: 'CACDDCBBDA',
      8: 'CCBDCDAABB',
      9: 'CABCDAABBD',
      10: 'DADCCDCDBB',
      11: 'DDBACDBCCC',
      12: 'DCCDCBDCCB',
      13: 'ABCCDCCBBC',
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
