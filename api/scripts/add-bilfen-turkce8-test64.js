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
const TOPIC_NAME = 'Anlatım Bozuklukları'

// Continues the Anlatım Bozuklukları page sequence (61:220, 62:222, 63:224) -> 226.
const TEST = { no: 64, pageStart: 226, answers: 'ABCDCBBCD' }

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
    const topicId = await getTopicId(pool, resourceBookId, TOPIC_NAME)

    const testName = `Test ${TEST.no}`
    const existingId = await testExists(pool, topicId, testName)
    if (existingId) {
      console.log(`Skipping ${testName} (already exists)`)
      return
    }

    await insertTest(pool, topicId, TOPIC_NAME, TEST)
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
