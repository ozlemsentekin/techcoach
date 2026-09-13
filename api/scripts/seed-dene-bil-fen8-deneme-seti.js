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
const BOOK_NAME = 'Dene & Bil 14 Lü Deneme Seti - Fen Bilimleri 8. Sınıf'
const TOPIC_NAME = 'Deneme Sınavları'
const TEST_TOPIC_NAME = 'Deneme'
const QUESTIONS_PER_DENEME = 20
const DENEME_COUNT = 14

// Transcribed from the set's own "Yanıt Anahtarı" pages, Deneme 1 - Deneme 14.
// Each array holds answers for questions 1-20 in order (index 0 = question 1).
const ANSWER_ARRAYS = {
  1: ['A', 'B', 'A', 'C', 'C', 'D', 'D', 'B', 'B', 'A', 'A', 'C', 'A', 'C', 'D', 'B', 'C', 'D', 'B', 'D'],
  2: ['A', 'C', 'C', 'B', 'B', 'D', 'B', 'A', 'D', 'A', 'B', 'A', 'C', 'A', 'C', 'D', 'B', 'C', 'D', 'B'],
  3: ['A', 'B', 'D', 'C', 'B', 'A', 'D', 'C', 'B', 'A', 'D', 'D', 'D', 'C', 'A', 'D', 'B', 'B', 'A', 'C'],
  4: ['C', 'A', 'D', 'B', 'C', 'B', 'D', 'A', 'A', 'D', 'A', 'C', 'B', 'D', 'C', 'A', 'C', 'B', 'D', 'A'],
  5: ['D', 'C', 'C', 'A', 'D', 'B', 'A', 'C', 'C', 'D', 'A', 'B', 'D', 'D', 'A', 'B', 'B', 'A', 'B', 'C'],
  6: ['B', 'D', 'C', 'A', 'B', 'A', 'C', 'C', 'D', 'A', 'C', 'B', 'D', 'B', 'B', 'A', 'D', 'B', 'D', 'C'],
  7: ['D', 'D', 'C', 'B', 'B', 'A', 'C', 'A', 'A', 'B', 'C', 'B', 'A', 'D', 'C', 'B', 'D', 'A', 'D', 'C'],
  8: ['A', 'B', 'C', 'B', 'C', 'A', 'D', 'D', 'A', 'A', 'B', 'C', 'C', 'D', 'D', 'B', 'B', 'C', 'A', 'C'],
  9: ['A', 'D', 'D', 'B', 'C', 'C', 'C', 'D', 'B', 'C', 'A', 'C', 'D', 'C', 'B', 'B', 'B', 'C', 'C', 'C'],
  10: ['B', 'D', 'A', 'D', 'A', 'C', 'D', 'B', 'C', 'B', 'A', 'C', 'A', 'B', 'C', 'D', 'C', 'A', 'D', 'B'],
  11: ['A', 'B', 'C', 'D', 'B', 'A', 'C', 'A', 'B', 'C', 'D', 'B', 'D', 'C', 'C', 'D', 'D', 'A', 'D', 'B'],
  12: ['A', 'B', 'C', 'D', 'C', 'A', 'C', 'A', 'B', 'B', 'A', 'C', 'A', 'C', 'C', 'D', 'B', 'D', 'D', 'D'],
  13: ['D', 'A', 'B', 'C', 'B', 'D', 'D', 'C', 'A', 'C', 'D', 'C', 'D', 'B', 'A', 'B', 'B', 'A', 'D', 'C'],
  14: ['B', 'D', 'D', 'C', 'A', 'B', 'C', 'C', 'A', 'C', 'D', 'B', 'A', 'B', 'C', 'A', 'A', 'D', 'B', 'C'],
}

const REAL_ANSWER_KEYS = Object.fromEntries(
  Object.entries(ANSWER_ARRAYS).map(([no, arr]) => [no, arr.join('')]),
)

async function getPublisherId(pool) {
  const result = await pool
    .request()
    .input('name', sql.NVarChar(150), PUBLISHER_NAME)
    .query('SELECT id FROM dbo.Publishers WHERE name = @name;')
  if (!result.recordset.length) throw new Error(`Publisher not found: ${PUBLISHER_NAME}`)
  return result.recordset[0].id
}

async function getResourceBookId(pool, publisherId) {
  const result = await pool
    .request()
    .input('publisherId', sql.UniqueIdentifier, publisherId)
    .input('name', sql.NVarChar(200), BOOK_NAME)
    .query('SELECT id FROM dbo.ResourceBooks WHERE publisher_id = @publisherId AND name = @name;')
  if (!result.recordset.length) throw new Error(`ResourceBook not found: ${BOOK_NAME}`)
  return result.recordset[0].id
}

async function getOrCreateTopic(pool, resourceBookId) {
  const existing = await pool
    .request()
    .input('resourceBookId', sql.UniqueIdentifier, resourceBookId)
    .input('name', sql.NVarChar(200), TOPIC_NAME)
    .query('SELECT id FROM dbo.ResourceBookTopics WHERE resource_book_id = @resourceBookId AND name = @name;')
  if (existing.recordset.length) return existing.recordset[0].id

  const inserted = await pool
    .request()
    .input('resourceBookId', sql.UniqueIdentifier, resourceBookId)
    .input('name', sql.NVarChar(200), TOPIC_NAME).query(`
      INSERT INTO dbo.ResourceBookTopics (resource_book_id, name)
      OUTPUT inserted.id
      VALUES (@resourceBookId, @name);
    `)
  return inserted.recordset[0].id
}

async function insertTest(pool, topicId, name, pageStart, questionCount) {
  // The set doesn't give real page numbers per deneme; page_start = deneme number
  // is used only for stable panel ordering (same convention as
  // seed-av-inkilap8-brans-denemeleri.js for its own untethered deneme set).
  const result = await pool
    .request()
    .input('topicId', sql.UniqueIdentifier, topicId)
    .input('topicName', sql.NVarChar(200), TEST_TOPIC_NAME)
    .input('name', sql.NVarChar(200), name)
    .input('pageStart', sql.Int, pageStart)
    .input('pageCount', sql.Int, 1)
    .input('questionCount', sql.Int, questionCount).query(`
      INSERT INTO dbo.ResourceBookTopicTests (topic_id, topic_name, name, page_start, page_count, question_count)
      OUTPUT inserted.id
      VALUES (@topicId, @topicName, @name, @pageStart, @pageCount, @questionCount);
    `)
  return result.recordset[0].id
}

async function insertAnswerKey(pool, testId, answers) {
  const letters = answers.split('')
  const request = pool.request().input('testId', sql.UniqueIdentifier, testId)
  const values = []
  letters.forEach((label, idx) => {
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

  for (const [no, answers] of Object.entries(REAL_ANSWER_KEYS)) {
    if (answers.length !== QUESTIONS_PER_DENEME) {
      throw new Error(`Deneme ${no}: expected ${QUESTIONS_PER_DENEME} answers, got ${answers.length}`)
    }
  }

  const pool = await sql.connect(connectionString)

  try {
    const publisherId = await getPublisherId(pool)
    const resourceBookId = await getResourceBookId(pool, publisherId)
    console.log(`ResourceBook: ${BOOK_NAME} -> ${resourceBookId}`)

    const topicId = await getOrCreateTopic(pool, resourceBookId)
    console.log(`Topic: ${TOPIC_NAME} -> ${topicId}`)

    const existingTests = await pool
      .request()
      .input('topicId', sql.UniqueIdentifier, topicId)
      .query('SELECT id, name FROM dbo.ResourceBookTopicTests WHERE topic_id = @topicId;')
    const testIdByName = new Map(existingTests.recordset.map((r) => [r.name, r.id]))

    let testsCreated = 0
    let answersInserted = 0

    for (let no = 1; no <= DENEME_COUNT; no += 1) {
      const testName = `Deneme ${no}`
      let testId = testIdByName.get(testName)

      if (!testId) {
        testId = await insertTest(pool, topicId, testName, no, QUESTIONS_PER_DENEME)
        testIdByName.set(testName, testId)
        testsCreated += 1
        console.log(`Created test: ${testName}`)
      } else {
        console.log(`Skip (test already exists): ${testName}`)
      }

      const answers = REAL_ANSWER_KEYS[no]
      if (!answers) continue

      const existingAnswers = await pool
        .request()
        .input('testId', sql.UniqueIdentifier, testId)
        .query('SELECT COUNT(*) AS cnt FROM dbo.TestAnswerKeys WHERE test_id = @testId;')
      if (existingAnswers.recordset[0].cnt > 0) {
        console.log(`Skip (already has answer key): ${testName}`)
        continue
      }

      await insertAnswerKey(pool, testId, answers)
      answersInserted += 1
      console.log(`${testName}: ${QUESTIONS_PER_DENEME} answer(s) inserted`)
    }

    console.log(`Done. Yeni test: ${testsCreated}, yeni cevap anahtarı: ${answersInserted}`)
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Seed failed')
  console.error(error)
  process.exit(1)
})
