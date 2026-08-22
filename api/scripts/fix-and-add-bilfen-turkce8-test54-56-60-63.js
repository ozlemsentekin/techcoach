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

// Test 54 Q7 and Test 56 Q7 were tied 1-1 across earlier reads; this third read broke the tie
// (2 of 3 agreeing) — D->A for Test 54, A->C for Test 56.
const FIXES = [
  { testName: 'Test 54', orderNo: 7, correctLabel: 'A' },
  { testName: 'Test 56', orderNo: 7, correctLabel: 'C' },
]

// Page numbers were not visible on these particular photos — estimated by continuing the book's
// consistent 2-page-per-test pattern (Noktalama İşaretleri: 212, 214, -> 216; Anlatım
// Bozuklukları starts at İçindekiler page 220). Flagged to the user as estimates.
const NEW_TESTS = [
  { topic: 'Noktalama İşaretleri', no: 60, pageStart: 216, answers: 'CCDAABADBDBBDAC' },
  { topic: 'Anlatım Bozuklukları', no: 61, pageStart: 220, answers: 'CBDBADADB' },
  { topic: 'Anlatım Bozuklukları', no: 62, pageStart: 222, answers: 'BCCACDBAD' },
  { topic: 'Anlatım Bozuklukları', no: 63, pageStart: 224, answers: 'CDCACBADB' },
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

async function applyFix(pool, resourceBookId, fix) {
  const testResult = await pool
    .request()
    .input('resourceBookId', sql.UniqueIdentifier, resourceBookId)
    .input('name', sql.NVarChar(200), fix.testName).query(`
      SELECT tt.id FROM dbo.ResourceBookTopicTests tt
      INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
      WHERE t.resource_book_id = @resourceBookId AND tt.name = @name;
    `)
  const testId = testResult.recordset[0]?.id
  if (!testId) throw new Error(`${fix.testName} not found`)

  await pool
    .request()
    .input('testId', sql.UniqueIdentifier, testId)
    .input('orderNo', sql.Int, fix.orderNo)
    .input('correctLabel', sql.NChar(1), fix.correctLabel).query(`
      UPDATE dbo.TestAnswerKeys
      SET correct_label = @correctLabel
      WHERE test_id = @testId AND order_no = @orderNo;
    `)
  console.log(`${fix.testName} Q${fix.orderNo} -> ${fix.correctLabel}`)
}

async function getOrCreateTopic(pool, resourceBookId, name) {
  const existing = await pool
    .request()
    .input('resourceBookId', sql.UniqueIdentifier, resourceBookId)
    .input('name', sql.NVarChar(200), name)
    .query('SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @resourceBookId AND name = @name;')
  if (existing.recordset.length) return existing.recordset[0].id

  const inserted = await pool
    .request()
    .input('resourceBookId', sql.UniqueIdentifier, resourceBookId)
    .input('name', sql.NVarChar(200), name).query(`
      INSERT INTO dbo.ResourceBookTopics (resource_book_id, name)
      OUTPUT inserted.id
      VALUES (@resourceBookId, @name);
    `)
  return inserted.recordset[0].id
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
  const testId = result.recordset[0].id

  const request = pool.request().input('testId', sql.UniqueIdentifier, testId)
  const values = []
  test.answers.split('').forEach((label, idx) => {
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
  console.log(`Inserted ${name} -> "${topicName}" (${questionCount}q, p${test.pageStart}-${pageEnd})`)
}

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING is missing.')

  const pool = await sql.connect(connectionString)
  try {
    const resourceBookId = await getResourceBookId(pool)
    console.log(`ResourceBook: ${BOOK_NAME} -> ${resourceBookId}`)

    for (const fix of FIXES) {
      await applyFix(pool, resourceBookId, fix)
    }

    for (const test of NEW_TESTS) {
      const topicId = await getOrCreateTopic(pool, resourceBookId, test.topic)
      const testName = `Test ${test.no}`
      const existingId = await testExists(pool, topicId, testName)
      if (existingId) {
        console.log(`  Skipping ${testName} (already exists)`)
        continue
      }
      await insertTest(pool, topicId, test.topic, test)
    }

    console.log('Done.')
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Failed')
  console.error(error)
  process.exit(1)
})
