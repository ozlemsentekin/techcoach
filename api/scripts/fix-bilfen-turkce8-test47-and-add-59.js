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

// Test 47 conflicted across 3 independent grid reads; majority vote (2 of 3 agreeing on every
// position) settles it at CACDBBABCA, replacing the originally stored CADDBCABCA.
const TEST47_CORRECTED_ANSWERS = 'CACDBBABCA'

// Test 59 (Noktalama İşaretleri, p214) — first full read, single source.
const TEST59 = { no: 59, pageStart: 214, answers: 'BCDDBACAC' }
const TEST59_TOPIC = 'Noktalama İşaretleri'

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

async function fixTest47(pool, resourceBookId) {
  const testResult = await pool
    .request()
    .input('resourceBookId', sql.UniqueIdentifier, resourceBookId)
    .input('name', sql.NVarChar(200), 'Test 47').query(`
      SELECT tt.id FROM dbo.ResourceBookTopicTests tt
      INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
      WHERE t.resource_book_id = @resourceBookId AND tt.name = @name;
    `)
  const testId = testResult.recordset[0]?.id
  if (!testId) throw new Error('Test 47 not found')

  await pool.request().input('testId', sql.UniqueIdentifier, testId).query(`
    DELETE FROM dbo.TestAnswerKeys WHERE test_id = @testId;
  `)

  const request = pool.request().input('testId', sql.UniqueIdentifier, testId)
  const values = []
  TEST47_CORRECTED_ANSWERS.split('').forEach((label, idx) => {
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
  console.log(`Test 47 answer key corrected -> ${TEST47_CORRECTED_ANSWERS}`)
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

async function insertTest59(pool, resourceBookId) {
  const topicId = await getTopicId(pool, resourceBookId, TEST59_TOPIC)
  const testName = `Test ${TEST59.no}`
  const existingId = await testExists(pool, topicId, testName)
  if (existingId) {
    console.log(`  Skipping ${testName} (already exists)`)
    return
  }

  const pageEnd = TEST59.pageStart + 1
  const pageCount = pageEnd - TEST59.pageStart + 1
  const questionCount = TEST59.answers.length

  const result = await pool
    .request()
    .input('topicId', sql.UniqueIdentifier, topicId)
    .input('topicName', sql.NVarChar(200), TEST59_TOPIC)
    .input('name', sql.NVarChar(200), testName)
    .input('pageStart', sql.Int, TEST59.pageStart)
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
  TEST59.answers.split('').forEach((label, idx) => {
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
  console.log(`Inserted ${testName} -> "${TEST59_TOPIC}" (${questionCount}q)`)
}

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING is missing.')

  const pool = await sql.connect(connectionString)
  try {
    const resourceBookId = await getResourceBookId(pool)
    console.log(`ResourceBook: ${BOOK_NAME} -> ${resourceBookId}`)

    await fixTest47(pool, resourceBookId)
    await insertTest59(pool, resourceBookId)

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
