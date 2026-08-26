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

const BOOK_NAME = 'Geometri Tabanlı Matematik Soru Bankası'

// Page starts come straight from the İçindekiler; each test's page_end is inferred as
// (next TOC entry's page - 1) since no content-page photos were sent for this book (only the
// table of contents + the printed Yanıt Anahtarı). The Yanıt Anahtarı itself starts at page 231,
// so the last test runs through 230. Answers transcribed from the book's own typed answer-key
// grid (20 questions per test, one clean read — no cross-check photo for this book yet).
const TOPICS = [
  {
    name: 'Çarpanlar ve Katlar',
    tests: [
      { no: 1, pageStart: 9, pageEnd: 18, answers: 'CABDADCABCBCCDAAADDC' },
      { no: 2, pageStart: 19, pageEnd: 30, answers: 'CBCCAAACDCBDCDAABDDD' },
    ],
  },
  {
    name: 'Üslü İfadeler',
    tests: [
      { no: 1, pageStart: 31, pageEnd: 40, answers: 'CBBCCDDCDDDABCDCDBBB' },
      { no: 2, pageStart: 41, pageEnd: 52, answers: 'CDBADCDCCCDCBCDCDBBD' },
    ],
  },
  {
    name: 'Kareköklü İfadeler',
    tests: [
      { no: 1, pageStart: 53, pageEnd: 62, answers: 'CACDBCADCABDABDACCAC' },
      { no: 2, pageStart: 63, pageEnd: 72, answers: 'CADDBAADCCDDABBABCAD' },
      { no: 3, pageStart: 73, pageEnd: 84, answers: 'DACDBCABCDBAABDACBCB' },
    ],
  },
  {
    name: 'Veri Analizi',
    tests: [{ no: 1, pageStart: 85, pageEnd: 98, answers: 'CABBCDBADAADDBADDACB' }],
  },
  {
    name: 'Basit Olayların Olma Olasılığı',
    tests: [{ no: 1, pageStart: 99, pageEnd: 110, answers: 'BDBAADBCBDCADCBBCCBB' }],
  },
  {
    name: 'Cebirsel İfadeler ve Özdeşlikler',
    tests: [
      { no: 1, pageStart: 111, pageEnd: 120, answers: 'BDCDDDCBDCCAABCABBDD' },
      { no: 2, pageStart: 121, pageEnd: 132, answers: 'CADADBADCBCADCBDCABA' },
    ],
  },
  {
    name: 'Doğrusal Denklemler',
    tests: [
      { no: 1, pageStart: 133, pageEnd: 142, answers: 'ACBBACDBBDABCBCABBDA' },
      { no: 2, pageStart: 143, pageEnd: 154, answers: 'BDADABDBBDCCACBCDBAB' },
    ],
  },
  {
    name: 'Eşitsizlikler',
    tests: [{ no: 1, pageStart: 155, pageEnd: 166, answers: 'CABBDBDABCDDCCAADDBB' }],
  },
  {
    name: 'Üçgenler',
    tests: [
      { no: 1, pageStart: 167, pageEnd: 176, answers: 'CDDBCDCACADCADBACDDD' },
      { no: 2, pageStart: 177, pageEnd: 188, answers: 'BCACBDCBBBCAACBACDCB' },
    ],
  },
  {
    name: 'Eşlik ve Benzerlik',
    tests: [{ no: 1, pageStart: 189, pageEnd: 200, answers: 'BABDABDBCABBACBBACAA' }],
  },
  {
    name: 'Dönüşüm Geometrisi',
    tests: [{ no: 1, pageStart: 201, pageEnd: 212, answers: 'CDACDBCAACBCBCDAACBB' }],
  },
  {
    name: 'Geometrik Cisimler',
    tests: [
      { no: 1, pageStart: 213, pageEnd: 221, answers: 'CDCACBBACADACBDCDCDA' },
      { no: 2, pageStart: 222, pageEnd: 230, answers: 'CDDDCBCBAABCBDDADACB' },
    ],
  },
]

async function getResourceBookId(pool) {
  const result = await pool
    .request()
    .input('name', sql.NVarChar(200), BOOK_NAME)
    .query('SELECT id FROM dbo.ResourceBooks WHERE name = @name;')
  if (!result.recordset.length) throw new Error(`ResourceBook not found: ${BOOK_NAME}`)
  return result.recordset[0].id
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
  const pageCount = test.pageEnd - test.pageStart + 1
  const questionCount = test.answers.length

  const result = await pool
    .request()
    .input('topicId', sql.UniqueIdentifier, topicId)
    .input('topicName', sql.NVarChar(200), topicName)
    .input('name', sql.NVarChar(200), name)
    .input('pageStart', sql.Int, test.pageStart)
    .input('pageEnd', sql.Int, test.pageEnd)
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
  console.log(`Inserted ${name} -> "${topicName}" (${questionCount}q, p${test.pageStart}-${test.pageEnd})`)
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

    for (const topic of TOPICS) {
      const topicId = await getOrCreateTopic(pool, resourceBookId, topic.name)
      for (const test of topic.tests) {
        const testName = `Test ${test.no}`
        const existingId = await testExists(pool, topicId, testName)
        if (existingId) {
          console.log(`  Skipping ${testName} (already exists) in "${topic.name}"`)
          continue
        }
        await insertTest(pool, topicId, topic.name, test)
        totalTests += 1
        totalAnswers += test.answers.length
      }
    }

    console.log(`Done. Tests inserted: ${totalTests}, answer key rows: ${totalAnswers}`)
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Seed failed')
  console.error(error)
  process.exit(1)
})
