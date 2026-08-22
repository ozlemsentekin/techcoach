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

// Confirmed from the new Test39-58 grid photo (cross-checked against the previously stored
// Test39-48/50/51 answers — all identical, except Test47 which conflicted and is intentionally
// left untouched pending user confirmation). Topics already exist from the previous pass.
const TOPICS = [
  {
    name: 'Yarıyıl Tarama Testi',
    tests: [{ no: 49, pageStart: 184, answers: 'CDBBDBCADBCADCADBB' }],
  },
  {
    name: 'Yapısına Göre Cümle Türleri',
    tests: [{ no: 52, pageStart: 196, answers: 'CBDCACBAD' }],
  },
  {
    name: 'Cümle Türleri',
    tests: [
      { no: 53, pageStart: 198, answers: 'CBABCDBAD' },
      { no: 54, pageStart: 200, answers: 'DDCBCADDDABCCA' },
    ],
  },
  {
    name: 'Yazım Kuralları',
    tests: [
      { no: 55, pageStart: 204, answers: 'DBACABDD' },
      { no: 56, pageStart: 206, answers: 'CDADBCAB' },
      { no: 57, pageStart: 208, answers: 'DBABCDCABAABCD' },
    ],
  },
  {
    name: 'Noktalama İşaretleri',
    tests: [{ no: 58, pageStart: 212, answers: 'ABDBDCDBC' }],
    // Test 59 pending — not covered by this grid photo (cuts off at Test 58).
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

async function getTopicId(pool, resourceBookId, name) {
  const result = await pool
    .request()
    .input('resourceBookId', sql.UniqueIdentifier, resourceBookId)
    .input('name', sql.NVarChar(200), name)
    .query('SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @resourceBookId AND name = @name;')
  if (!result.recordset.length) throw new Error(`Topic not found: ${name}`)
  return result.recordset[0].id
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
      const topicId = await getTopicId(pool, resourceBookId, topic.name)

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
        console.log(`Inserted ${testName} -> "${topic.name}" (${test.answers.length}q)`)
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
