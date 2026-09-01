const fs = require('fs')
const path = require('path')
const sql = require('mssql')

const localSettingsPath = path.join(__dirname, '..', 'local.settings.json')
function loadLocalSettings() {
  if (!fs.existsSync(localSettingsPath)) return
  const parsed = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'))
  Object.entries(parsed.Values || {}).forEach(([key, value]) => {
    if (!process.env[key] && typeof value === 'string') process.env[key] = value
  })
}

// "T.C. İnkılap Tarihi ve Atatürkçülük Branş Denemeleri 8" — Akıllı Versiyon (AV) Yayınları.
// scope = 'catalog' (Kütüphane). 10 branş denemesi. Her deneme 10 soru, çoktan seçmeli.
// Tek İçerik ("Branş Denemeleri") altında 10 test: "1. Deneme" … "10. Deneme".
// page_start = deneme numarası (yalnızca panel sıralaması için; kitap deneme bazında sayfa vermiyor).
//
// İdempotent: var olan İçerik/test/cevap anahtarını atlar, eksikleri tamamlar.
// Cevap anahtarı bloğu `answers: null` olanlar için görsel netleşince doldurulacak.
const RESOURCE_BOOK_ID = '16B64FF8-2F19-4EAD-8913-EFA55479FCCC'
const TOPIC_NAME = 'Branş Denemeleri'
const QUESTIONS_PER_DENEME = 10

// deneme no -> cevap dizisi (10 harf) veya null (henüz girilmedi)
// Kaynağın "Cevap Anahtarı" sayfasından; Deneme 2-9 iki ayrı fotoğrafla çapraz doğrulandı.
const DENEMELER = {
  1: 'DADADBCDBC',
  2: 'DCCBDBCDAA',
  3: 'CABDCDDBDA',
  4: 'ABDBCDCDBA',
  5: 'CBDBADDAAD',
  6: 'BDBDDACDAC',
  7: 'CCBDCBDBAA',
  8: 'CCDBABDCAD',
  9: 'BAADBDBDDB',
  10: 'BCADCBCAAA',
}

async function main() {
  loadLocalSettings()
  if (!process.env.SQL_CONNECTION_STRING) throw new Error('SQL_CONNECTION_STRING is missing.')

  for (const [no, answers] of Object.entries(DENEMELER)) {
    if (answers === null) continue
    if (!/^[A-E]+$/.test(answers)) throw new Error(`Geçersiz cevap dizisi: ${no}. Deneme — ${answers}`)
    if (answers.length !== QUESTIONS_PER_DENEME) {
      throw new Error(`${no}. Deneme: ${answers.length} harf, beklenen ${QUESTIONS_PER_DENEME}`)
    }
  }

  const pool = await sql.connect(process.env.SQL_CONNECTION_STRING)
  try {
    const book = await pool
      .request()
      .input('id', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .query('SELECT id, name, scope, grade FROM dbo.ResourceBooks WHERE id = @id;')
    if (!book.recordset.length) throw new Error(`ResourceBook not found: ${RESOURCE_BOOK_ID}`)
    const b = book.recordset[0]
    console.log(`ResourceBook: ${b.name} (scope=${b.scope}, ${b.grade}. sınıf)\n`)

    // İçerik (tek)
    let topicId
    const existingTopic = await pool
      .request()
      .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .input('name', sql.NVarChar(200), TOPIC_NAME)
      .query('SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @rbId AND name = @name;')
    if (existingTopic.recordset.length === 1) {
      topicId = existingTopic.recordset[0].id
    } else if (existingTopic.recordset.length > 1) {
      throw new Error(`Aynı adlı birden fazla İçerik: ${TOPIC_NAME}`)
    } else {
      const ins = await pool
        .request()
        .input('rbId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
        .input('name', sql.NVarChar(200), TOPIC_NAME)
        .query('INSERT INTO dbo.ResourceBookTopics (resource_book_id, name) OUTPUT inserted.id VALUES (@rbId, @name);')
      topicId = ins.recordset[0].id
      console.log(`İçerik (yeni): ${TOPIC_NAME}`)
    }

    let testsCreated = 0
    let testsSkipped = 0
    let keysInserted = 0

    for (let no = 1; no <= 10; no += 1) {
      const testName = `${no}. Deneme`
      const answers = DENEMELER[no]

      const existingTest = await pool
        .request()
        .input('topicId', sql.UniqueIdentifier, topicId)
        .input('name', sql.NVarChar(200), testName)
        .query(`
          SELECT tt.id,
            (SELECT COUNT(*) FROM dbo.TestAnswerKeys k WHERE k.test_id = tt.id) AS answer_count
          FROM dbo.ResourceBookTopicTests tt
          WHERE tt.topic_id = @topicId AND tt.name = @name;
        `)
      if (existingTest.recordset.length > 1) throw new Error(`Aynı adlı birden fazla test: ${testName}`)

      let testId
      if (existingTest.recordset.length === 1) {
        testId = existingTest.recordset[0].id
        if (existingTest.recordset[0].answer_count > 0) {
          testsSkipped += 1
          continue
        }
      } else {
        const ins = await pool
          .request()
          .input('topicId', sql.UniqueIdentifier, topicId)
          .input('topicName', sql.NVarChar(200), TOPIC_NAME)
          .input('name', sql.NVarChar(200), testName)
          .input('pageStart', sql.Int, no)
          .input('questionCount', sql.Int, QUESTIONS_PER_DENEME)
          .query(`
            INSERT INTO dbo.ResourceBookTopicTests (topic_id, topic_name, name, page_start, page_end, page_count, question_count)
            OUTPUT inserted.id
            VALUES (@topicId, @topicName, @name, @pageStart, NULL, 1, @questionCount);
          `)
        testId = ins.recordset[0].id
        testsCreated += 1
        console.log(`${testName}: test oluşturuldu (${QUESTIONS_PER_DENEME} soru).`)
      }

      if (!answers) continue

      const req = pool.request().input('testId', sql.UniqueIdentifier, testId)
      const valueRows = []
      answers.split('').forEach((label, i) => {
        req.input(`o${i}`, sql.Int, i + 1)
        req.input(`l${i}`, sql.NChar(1), label)
        valueRows.push(`(@testId, @o${i}, @l${i})`)
      })
      await req.query(`INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label) VALUES ${valueRows.join(', ')};`)
      keysInserted += 1
      console.log(`  ${testName} cevap anahtarı: ${answers.split('').map((l, i) => `${i + 1}${l}`).join(' ')}`)
    }

    console.log(
      `\nBitti. Yeni test: +${testsCreated}, cevap anahtarı zaten olan: ${testsSkipped}, cevap anahtarı yazılan: +${keysInserted}`,
    )

    const summary = await pool
      .request()
      .input('topicId', sql.UniqueIdentifier, topicId)
      .query(`
        SELECT tt.name, tt.question_count,
          (SELECT COUNT(*) FROM dbo.TestAnswerKeys k WHERE k.test_id = tt.id) AS answer_count
        FROM dbo.ResourceBookTopicTests tt WHERE tt.topic_id = @topicId ORDER BY tt.page_start;
      `)
    console.log('\nDenemeler:')
    summary.recordset.forEach((r) => {
      console.log(`  ${r.name}  (${r.question_count} soru, cevap anahtarı: ${r.answer_count})`)
    })
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Seed failed')
  console.error(error)
  process.exit(1)
})
