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

const PUBLISHER_NAME = 'Bilfen Yayınları'
const BOOK_NAME = '8. Sınıf Türkçe Pro & Test Soru Bankası'

// Topic name = the running header printed on each test's own page (matching the İçindekiler
// subsection under KONU 5 / KONU 6), not the broad KONU chapter title — same convention used for
// KONU 1-4 earlier. Page starts read directly from each test's page photo; every test occupies a
// 2-page spread (page_end = page_start + 1). Answers transcribed from the Yanıt Anahtarı grid —
// Test 28-34 cross-checked against two overlapping photos (identical on both reads); Test 35-47
// only had a single photo, so slightly lower confidence there.
const TOPICS = [
  // KONU 5: Fiilde Çatı
  {
    name: 'Özne-Yüklem İlişkisine Göre Fiil Çatıları',
    tests: [{ no: 28, pageStart: 104, answers: 'DBCBBCACB' }],
  },
  {
    name: 'Nesne-Yüklem İlişkisine Göre Fiil Çatıları',
    tests: [{ no: 29, pageStart: 106, answers: 'DDBACBCBDC' }],
  },
  {
    name: 'Fiilde Çatı',
    tests: [
      { no: 30, pageStart: 108, answers: 'CAABBDBC' },
      { no: 31, pageStart: 110, answers: 'ACCBADACC' },
      { no: 32, pageStart: 112, answers: 'BCDBBCA' },
    ],
  },
  // KONU 6: Paragrafta Anlam
  {
    name: 'Paragrafın Konusu',
    tests: [{ no: 33, pageStart: 116, answers: 'DACBCABCBB' }],
  },
  {
    name: 'Paragrafın Ana Düşüncesi',
    tests: [{ no: 34, pageStart: 120, answers: 'CCABBDDCDA' }],
  },
  {
    name: 'Paragrafın Yardımcı Düşünceleri',
    tests: [{ no: 35, pageStart: 124, answers: 'BACDCBDDA' }],
  },
  {
    name: 'Paragrafın Yapısı',
    tests: [
      { no: 36, pageStart: 128, answers: 'DABCBABDCCB' },
      { no: 37, pageStart: 132, answers: 'BDBCCADD' },
    ],
  },
  {
    name: 'Hikâye Unsurları - Anlatıcı',
    tests: [{ no: 38, pageStart: 136, answers: 'CACDBBCD' }],
  },
  {
    name: 'Anlatım Biçimleri',
    tests: [{ no: 39, pageStart: 140, answers: 'CBDBCADDC' }],
  },
  {
    name: 'Düşünceyi Geliştirme Yolları',
    tests: [{ no: 40, pageStart: 144, answers: 'CBDACDDBACBCD' }],
  },
  {
    name: 'Sözel Mantık',
    tests: [{ no: 41, pageStart: 148, answers: 'CBADCB' }],
  },
  {
    name: 'Sözel Mantık / Grafik Yorumu',
    tests: [{ no: 42, pageStart: 152, answers: 'CCCCDB' }],
  },
  {
    name: 'Paragrafta Anlam',
    tests: [
      { no: 43, pageStart: 156, answers: 'CDCBBADBD' },
      { no: 44, pageStart: 160, answers: 'CACCCDDC' },
      { no: 45, pageStart: 164, answers: 'ABCCBADAA' },
      { no: 46, pageStart: 168, answers: 'DADDBDACCBA' },
      { no: 47, pageStart: 172, answers: 'CADDBCABCA' },
    ],
  },
]

async function getResourceBookId(pool) {
  const publisher = await pool
    .request()
    .input('name', sql.NVarChar(150), PUBLISHER_NAME)
    .query('SELECT id FROM dbo.Publishers WHERE name = @name;')
  if (!publisher.recordset.length) throw new Error(`Publisher not found: ${PUBLISHER_NAME}`)

  const book = await pool
    .request()
    .input('publisherId', sql.UniqueIdentifier, publisher.recordset[0].id)
    .input('name', sql.NVarChar(200), BOOK_NAME)
    .query('SELECT id FROM dbo.ResourceBooks WHERE publisher_id = @publisherId AND name = @name;')
  if (!book.recordset.length) throw new Error(`ResourceBook not found: ${BOOK_NAME}`)
  return book.recordset[0].id
}

async function getOrCreateTopic(pool, resourceBookId, name) {
  const existing = await pool
    .request()
    .input('resourceBookId', sql.UniqueIdentifier, resourceBookId)
    .input('name', sql.NVarChar(200), name)
    .query('SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @resourceBookId AND name = @name;')
  if (existing.recordset.length) return { id: existing.recordset[0].id, isNew: false }

  const inserted = await pool
    .request()
    .input('resourceBookId', sql.UniqueIdentifier, resourceBookId)
    .input('name', sql.NVarChar(200), name).query(`
      INSERT INTO dbo.ResourceBookTopics (resource_book_id, name)
      OUTPUT inserted.id
      VALUES (@resourceBookId, @name);
    `)
  return { id: inserted.recordset[0].id, isNew: true }
}

async function testExists(pool, topicId, name) {
  const result = await pool
    .request()
    .input('topicId', sql.UniqueIdentifier, topicId)
    .input('name', sql.NVarChar(200), name)
    .query('SELECT id FROM dbo.ResourceBookTopicTests WHERE topic_id = @topicId AND name = @name;')
  return result.recordset[0]?.id || null
}

async function insertTest(pool, topicId, topicName, test) {
  const name = `Test ${test.no}`
  const pageEnd = test.pageStart + 1
  const pageCount = pageEnd - test.pageStart + 1
  const questionCount = test.answers.length

  const result = await pool
    .request()
    .input('topicId', sql.UniqueIdentifier, topicId)
    .input('topicName', sql.NVarChar(200), topicName)
    .input('name', sql.NVarChar(200), name)
    .input('pageStart', sql.Int, test.pageStart)
    .input('pageEnd', sql.Int, pageEnd)
    .input('pageCount', sql.Int, pageCount)
    .input('questionCount', sql.Int, questionCount).query(`
      INSERT INTO dbo.ResourceBookTopicTests (topic_id, topic_name, name, page_start, page_end, page_count, question_count)
      OUTPUT inserted.id
      VALUES (@topicId, @topicName, @name, @pageStart, @pageEnd, @pageCount, @questionCount);
    `)
  return result.recordset[0].id
}

async function insertAnswerKey(pool, testId, answers) {
  const request = pool.request().input('testId', sql.UniqueIdentifier, testId)
  const values = []
  answers.split('').forEach((label, idx) => {
    const orderParam = `order${idx}`
    const labelParam = `label${idx}`
    request.input(orderParam, sql.Int, idx + 1)
    request.input(labelParam, sql.NChar(1), label)
    values.push(`(@testId, @${orderParam}, @${labelParam})`)
  })
  await request.query(`
    INSERT INTO dbo.TestAnswerKeys (test_id, order_no, correct_label)
    VALUES ${values.join(', ')};
  `)
}

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING is missing.')

  const pool = await sql.connect(connectionString)
  try {
    const resourceBookId = await getResourceBookId(pool)
    console.log(`ResourceBook: ${BOOK_NAME} -> ${resourceBookId}`)

    let totalTests = 0
    let totalAnswers = 0
    let skipped = 0

    for (const topic of TOPICS) {
      const { id: topicId, isNew } = await getOrCreateTopic(pool, resourceBookId, topic.name)
      console.log(`Topic: ${topic.name} -> ${topicId} (${isNew ? 'created' : 'existing'})`)

      for (const test of topic.tests) {
        const testName = `Test ${test.no}`
        const existingId = await testExists(pool, topicId, testName)
        if (existingId) {
          console.log(`  Skipping ${testName} (already exists)`)
          skipped += 1
          continue
        }
        const testId = await insertTest(pool, topicId, topic.name, test)
        await insertAnswerKey(pool, testId, test.answers)
        totalTests += 1
        totalAnswers += test.answers.length
        console.log(`  Inserted ${testName} (${test.answers.length}q)`)
      }
    }

    console.log(`Done. Tests inserted: ${totalTests}, skipped: ${skipped}, answer key rows: ${totalAnswers}`)
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Seed failed')
  console.error(error)
  process.exit(1)
})
