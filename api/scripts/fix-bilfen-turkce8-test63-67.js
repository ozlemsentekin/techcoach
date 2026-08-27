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
const BOOK_NAME = 'Pro & Test Soru Bankası' // renamed from "8. Sınıf Türkçe Pro & Test Soru Bankası" via the app UI

// Corrected per a clearer resend of the Test 61-67 answer-key columns. Test 61-62 matched what
// was already stored (no change). Test 66's true question count is 11, not 10 — its
// question_count is updated along with the answer key.
const FIXES = [
  { testName: 'Test 63', answers: 'CDDABBADA' },
  { testName: 'Test 64', answers: 'ABCDCBADB' },
  { testName: 'Test 65', answers: 'DCBACBBCDA' },
  { testName: 'Test 66', answers: 'DACABBCCADC' },
  { testName: 'Test 67', answers: 'ACDACBCBBDD' },
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
      SELECT tt.id, tt.question_count FROM dbo.ResourceBookTopicTests tt
      INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
      WHERE t.resource_book_id = @resourceBookId AND tt.name = @name;
    `)
  const test = testResult.recordset[0]
  if (!test) throw new Error(`${fix.testName} not found`)

  const newCount = fix.answers.length
  if (test.question_count !== newCount) {
    await pool
      .request()
      .input('testId', sql.UniqueIdentifier, test.id)
      .input('questionCount', sql.Int, newCount).query(`
        UPDATE dbo.ResourceBookTopicTests SET question_count = @questionCount WHERE id = @testId;
      `)
    console.log(`${fix.testName} question_count: ${test.question_count} -> ${newCount}`)
  }

  await pool.request().input('testId', sql.UniqueIdentifier, test.id).query(`
    DELETE FROM dbo.TestAnswerKeys WHERE test_id = @testId;
  `)

  const request = pool.request().input('testId', sql.UniqueIdentifier, test.id)
  const values = []
  fix.answers.split('').forEach((label, idx) => {
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
  console.log(`${fix.testName} answer key -> ${fix.answers}`)
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
