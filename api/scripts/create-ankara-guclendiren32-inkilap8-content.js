// "Güçlendiren 32 Haftalık Kazanım Denemeleri - Inkilap Tarihi ve Atatürkçülük - 8. Sınıf"
// (Ankara Yayıncılık) kaynağına tek "Deneme Sınavları" konusu + 32 test ("Deneme 1".."Deneme 32",
// her biri 10 soru) oluşturur ve kullanıcının gönderdiği fotoğraflardaki cevap anahtarını birlikte girer.
//
// NOT: Kullanıcı aynı cevap anahtarı tablosunun 5 farklı fotoğrafını gönderdi (aynı sayfanın
// tekrar çekimleri/yakınlaştırmaları). Deneme 16-32 arasında bazı hücrelerde fotoğraflar arası
// okuma farkları vardı (muhtemelen bir çekimde bulanıklık); bu script'teki değerler en az 2
// fotoğrafın hemfikir olduğu (çoğunluk) okumadır. Girildikten sonra kitaptan bir hızlı kontrol
// önerilir, özellikle Deneme 16-32 arası.
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

const RESOURCE_BOOK_ID = '5AD70446-FEB6-4108-85DD-6733293AEF2F'
const TOPIC_NAME = 'Deneme Sınavları'

const ANSWER_KEYS = {
  1: 'DCBDABDADC',
  2: 'CCDACBCAAD',
  3: 'DBACACBDBA',
  4: 'DCCAADABDB',
  5: 'DBABACADDB',
  6: 'DDBCCCADBC',
  7: 'ABDBCDABDC',
  8: 'BBCDCACBDB',
  9: 'DBAADACBCA',
  10: 'BAACDDBDDA',
  11: 'ACDBDACACD',
  12: 'DACABDBBCC',
  13: 'ACCDCBABDA',
  14: 'CDACBBCBAD',
  15: 'BBBADADCCD',
  16: 'ABDDCBDADB',
  17: 'CDAABBCDDA',
  18: 'CACAACABDC',
  19: 'BBDCABDCDC',
  20: 'BADBCABBDC',
  21: 'BCDACDADCD',
  22: 'DBABBDCADA',
  23: 'ABADBDCCAD',
  24: 'BCABDDBCCA',
  25: 'ABDBDAADCC',
  26: 'AADDBCDDCA',
  27: 'BBBCCADDCA',
  28: 'CAABABDCAB',
  29: 'DDCBBDBDAA',
  30: 'ADBBBABDDC',
  31: 'DBADBCAADB',
  32: 'DACBDCAAAB',
}

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING eksik.')

  const pool = await sql.connect(connectionString)
  try {
    const existingTopics = await pool
      .request()
      .input('b', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .query('SELECT COUNT(*) AS cnt FROM dbo.ResourceBookTopics WHERE resource_book_id = @b;')
    if (existingTopics.recordset[0].cnt > 0) {
      throw new Error(`Bu kaynakta zaten ${existingTopics.recordset[0].cnt} konu var — script atlandı (mükerrer içerik riski).`)
    }

    const topicResult = await pool
      .request()
      .input('b', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .input('name', sql.NVarChar(200), TOPIC_NAME)
      .query('INSERT INTO dbo.ResourceBookTopics (resource_book_id, name) OUTPUT inserted.id VALUES (@b, @name);')
    const topicId = topicResult.recordset[0].id
    console.log(`+ Konu: ${TOPIC_NAME}`)

    let testCount = 0
    let answerRows = 0

    for (const [denemeNo, answerString] of Object.entries(ANSWER_KEYS)) {
      const testName = `Deneme ${denemeNo}`
      const answers = answerString.split('')

      const testResult = await pool
        .request()
        .input('topicId', sql.UniqueIdentifier, topicId)
        .input('name', sql.NVarChar(200), testName)
        .input('pageCount', sql.Int, 1)
        .input('questionCount', sql.Int, answers.length)
        .query(`
          INSERT INTO dbo.ResourceBookTopicTests (topic_id, name, page_count, question_count)
          OUTPUT inserted.id
          VALUES (@topicId, @name, @pageCount, @questionCount);
        `)
      const testId = testResult.recordset[0].id
      testCount += 1

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
      console.log(`   + ${testName}: ${answerString}`)
    }

    console.log(`Bitti. 1 konu, ${testCount} test, ${answerRows} cevap satırı oluşturuldu.`)
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('İçerik/cevap anahtarı oluşturma başarısız')
  console.error(error)
  process.exit(1)
})
