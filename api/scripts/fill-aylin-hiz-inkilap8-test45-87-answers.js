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

// Uzman Soru Bankası - İnkılap Tarihi ve Atatürkçülük - 8. Sınıf (Hız Yayınları)
const RESOURCE_BOOK_ID = '02A6D35A-2EAC-4DEE-A18D-2964C2B3A75E'

// Kullanıcının gönderdiği cevap anahtarı fotoğraflarından (Test-45 .. Test-87) birebir.
const ANSWER_KEYS = {
  45: 'ABBAD',
  46: 'DBBCAB',
  47: 'DBAADDCCBABBDBAB',
  48: 'BDDADC',
  49: 'BBBDBDB',
  50: 'CCDCDB',
  51: 'BDBBACB',
  52: 'DCADBABA',
  53: 'DDCCCBCB',
  54: 'DABCDAD',
  55: 'BBABCDDC',
  56: 'BCDDC',
  57: 'BDCBBC',
  58: 'CBACBD',
  59: 'DBCCBA',
  60: 'BCDCAC',
  61: 'CDBDCCC',
  62: 'DDBBDCAC',
  63: 'AABCCBCACBACADDC',
  64: 'CBBBCB',
  65: 'DDAAACA',
  66: 'CCCBCB',
  67: 'BBCACDCC',
  68: 'CDBAADCC',
  69: 'DCCB',
  70: 'AACCCDD',
  71: 'ACDADABD',
  72: 'CDCDBCD',
  73: 'BBBBADC',
  74: 'ADBCC',
  75: 'CDCBC',
  76: 'DCACCC',
  77: 'CCDAB',
  78: 'ACCDBCB',
  79: 'AADCB',
  80: 'DCDCAD',
  81: 'DBBDACB',
  82: 'BCDBCB',
  83: 'BDACACB',
  84: 'DACACAC',
  85: 'ABDABCA',
  86: 'DABACCA',
  // Test-87: fotoğrafta sayfa kesik, yalnızca 1. soru okunabiliyor.
  87: 'B',
}

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING eksik.')

  const testNos = Object.keys(ANSWER_KEYS).map(Number)

  const pool = await sql.connect(connectionString)
  try {
    const testsResult = await pool
      .request()
      .input('resourceBookId', sql.UniqueIdentifier, RESOURCE_BOOK_ID).query(`
        SELECT tt.id, tt.name
        FROM dbo.ResourceBookTopicTests tt
        INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
        WHERE t.resource_book_id = @resourceBookId;
      `)

    const testIdByNo = new Map()
    for (const row of testsResult.recordset) {
      const match = /^Test(\d+)$/.exec(row.name)
      if (match) testIdByNo.set(Number(match[1]), row.id)
    }

    let updated = 0
    let answerRows = 0
    let skipped = 0

    for (const testNo of testNos) {
      const testId = testIdByNo.get(testNo)
      if (!testId) throw new Error(`Test${testNo} veritabanında bulunamadı`)

      const answers = ANSWER_KEYS[testNo].split('')

      const existing = await pool
        .request()
        .input('testId', sql.UniqueIdentifier, testId)
        .query('SELECT COUNT(*) AS cnt FROM dbo.TestAnswerKeys WHERE test_id = @testId;')
      if (existing.recordset[0].cnt > 0) {
        console.log(`= Test${testNo}: cevap anahtarı zaten var — atlandı`)
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
      console.log(`+ Test${testNo}: ${ANSWER_KEYS[testNo]}`)
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
