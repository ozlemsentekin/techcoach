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

const PUBLISHER_NAME = 'Sinan Kuzucu Yayınları'
const SUBJECT_NAME = 'Matematik'
const BOOK_NAME = 'MEB 2027 LGS Böyle Sorar Matematik 8 Soru Bankası'
// Approximate: the İçindekiler only gives each test's start page, not its end page. Last-test-per-
// konu end pages (and this total) are extrapolated from the ~8 (occasionally 9) page span observed
// between consecutive tests within the same konu — see KONULAR below for per-test detail.
const BOOK_PAGE_COUNT = 275

// Transcribed from İçindekiler (start pages) and the Yanıt Anahtarı pages. Each konu maps to one
// ResourceBookTopics row (this book has no sub-topic layer under a konu — tests sit directly under
// it), so topic_name on every test is just the konu name, matching the Hız Fen Bilimleri seed
// convention. page_end for the last test in a konu is not printed in the İçindekiler; it is
// extrapolated using that konu's own test-to-test page span (8 pages for most konular, 9 for
// Kareköklü İfadeler and Veri Analizi) — flagged as approximate, not transcribed.
const KONULAR = [
  {
    name: 'Çarpanlar ve Katlar',
    tests: [
      { name: 'Test - 1', pageStart: 9, pageEnd: 16, answers: 'DABCBAABDDDBBBCBDBBD' },
      { name: 'Test - 2', pageStart: 17, pageEnd: 24, answers: 'CCBBCCAABBCADACDDAAC' },
      { name: 'Test - 3', pageStart: 25, pageEnd: 32, answers: 'CABDABCCABCBABCCDADB' }, // pageEnd approximate
    ],
  },
  {
    name: 'Üslü İfadeler',
    tests: [
      { name: 'Test - 1', pageStart: 35, pageEnd: 42, answers: 'BDADDDACBBBDCCADBBAD' },
      { name: 'Test - 2', pageStart: 43, pageEnd: 50, answers: 'AAACCBACCBBABADCACDD' },
      { name: 'Test - 3', pageStart: 51, pageEnd: 58, answers: 'CDACCBAAADCDDBCDCDDC' }, // pageEnd approximate
    ],
  },
  {
    name: 'Kareköklü İfadeler',
    tests: [
      { name: 'Test - 1', pageStart: 61, pageEnd: 69, answers: 'BAAACBCCCDBDBCBCABDD' },
      { name: 'Test - 2', pageStart: 70, pageEnd: 78, answers: 'ADBCDADCABABBABCCDDC' },
      { name: 'Test - 3', pageStart: 79, pageEnd: 87, answers: 'ABDADAAABBBACBACADBC' }, // pageEnd approximate
    ],
  },
  {
    name: 'Veri Analizi',
    tests: [
      { name: 'Test - 1', pageStart: 89, pageEnd: 97, answers: 'BCCDBDDCCBBABBCCCDBA' },
      { name: 'Test - 2', pageStart: 98, pageEnd: 106, answers: 'BBBBABBCACCBCDCDACCC' }, // pageEnd approximate
    ],
  },
  {
    name: 'Basit Olayların Olma Olasılığı',
    tests: [
      { name: 'Test - 1', pageStart: 109, pageEnd: 116, answers: 'DBBCDBCBBCCACDCCDBAC' },
      { name: 'Test - 2', pageStart: 117, pageEnd: 124, answers: 'CCCCBCBCCCBCDABCBBAA' }, // pageEnd approximate
    ],
  },
  {
    name: 'Cebirsel İfadeler ve Özdeşlikler',
    tests: [
      { name: 'Test - 1', pageStart: 127, pageEnd: 134, answers: 'ABCABDDADAADDBDCCBAB' },
      { name: 'Test - 2', pageStart: 135, pageEnd: 142, answers: 'BBBDACABDCAACBDDDCAC' }, // pageEnd approximate
    ],
  },
  {
    name: 'Doğrusal Denklemler',
    tests: [
      { name: 'Test - 1', pageStart: 145, pageEnd: 152, answers: 'DACDABDDBBDDBCADDDAC' },
      { name: 'Test - 2', pageStart: 153, pageEnd: 160, answers: 'ABBBBBCCDCCCBDCACBBB' },
      { name: 'Test - 3', pageStart: 161, pageEnd: 168, answers: 'BDBACCCACACCDDBABCCB' }, // pageEnd approximate
    ],
  },
  {
    name: 'Eşitsizlikler',
    tests: [
      { name: 'Test - 1', pageStart: 171, pageEnd: 178, answers: 'CDCDDDACDBACBCCDBBCC' },
      { name: 'Test - 2', pageStart: 179, pageEnd: 186, answers: 'DBACCAAACCCCACDBCCCA' }, // pageEnd approximate
    ],
  },
  {
    name: 'Üçgenler',
    tests: [
      { name: 'Test - 1', pageStart: 189, pageEnd: 196, answers: 'ABCCBAADCDCBBCACCAAC' },
      { name: 'Test - 2', pageStart: 197, pageEnd: 204, answers: 'DCDCCBCCBBCDACBACBCD' },
      { name: 'Test - 3', pageStart: 205, pageEnd: 212, answers: 'CCDBADCCDACBABDDCCDC' }, // pageEnd approximate
    ],
  },
  {
    name: 'Eşlik ve Benzerlik',
    tests: [
      { name: 'Test - 1', pageStart: 217, pageEnd: 224, answers: 'ADABDBDDCACBCCCDCCDC' },
      { name: 'Test - 2', pageStart: 225, pageEnd: 232, answers: 'CBBCCDBBCBCCBDDACDCC' }, // pageEnd approximate
    ],
  },
  {
    name: 'Dönüşüm Geometrisi',
    tests: [
      { name: 'Test - 1', pageStart: 235, pageEnd: 242, answers: 'BCCCACCCDBBAABCCBCCA' },
      { name: 'Test - 2', pageStart: 243, pageEnd: 250, answers: 'DBCBADBCADADADBCBDBD' }, // pageEnd approximate
    ],
  },
  {
    name: 'Geometrik Cisimler',
    tests: [
      { name: 'Test - 1', pageStart: 253, pageEnd: 260, answers: 'BACBABCBBDABDCCCCCAB' },
      { name: 'Test - 2', pageStart: 261, pageEnd: 268, answers: 'BDCBABCCBABADBDBBBBB' }, // pageEnd approximate, last test in book
    ],
  },
]

function buildTopics() {
  let totalTests = 0
  const topics = KONULAR.map((konu) => {
    const tests = konu.tests.map((test) => {
      totalTests += 1
      return { ...test, answers: test.answers.split('') }
    })
    return { name: konu.name, tests }
  })
  return { topics, totalTests }
}

async function getOrCreatePublisher(pool) {
  const existing = await pool
    .request()
    .input('name', sql.NVarChar(150), PUBLISHER_NAME)
    .query('SELECT id FROM dbo.Publishers WHERE name = @name;')

  if (existing.recordset.length) {
    return existing.recordset[0].id
  }

  const inserted = await pool
    .request()
    .input('name', sql.NVarChar(150), PUBLISHER_NAME)
    .query('INSERT INTO dbo.Publishers (name) OUTPUT inserted.id VALUES (@name);')

  return inserted.recordset[0].id
}

async function getSubjectId(pool) {
  const result = await pool
    .request()
    .input('name', sql.NVarChar(100), SUBJECT_NAME)
    .query('SELECT id FROM dbo.Subjects WHERE name = @name;')

  if (!result.recordset.length) {
    throw new Error(`Subject not found: ${SUBJECT_NAME}`)
  }

  return result.recordset[0].id
}

async function getOrCreateResourceBook(pool, publisherId, subjectId) {
  const existing = await pool
    .request()
    .input('publisherId', sql.UniqueIdentifier, publisherId)
    .input('name', sql.NVarChar(200), BOOK_NAME)
    .query('SELECT id FROM dbo.ResourceBooks WHERE publisher_id = @publisherId AND name = @name;')

  if (existing.recordset.length) {
    return { id: existing.recordset[0].id, isNew: false }
  }

  const inserted = await pool
    .request()
    .input('publisherId', sql.UniqueIdentifier, publisherId)
    .input('subjectId', sql.UniqueIdentifier, subjectId)
    .input('name', sql.NVarChar(200), BOOK_NAME)
    .input('pageCount', sql.Int, BOOK_PAGE_COUNT)
    .input('isActive', sql.Bit, true)
    .input('resourceType', sql.NVarChar(30), 'soru_bankasi')
    .input('hasAnswerKey', sql.Bit, true).query(`
      INSERT INTO dbo.ResourceBooks (publisher_id, subject_id, name, page_count, is_active, resource_type, has_answer_key)
      OUTPUT inserted.id
      VALUES (@publisherId, @subjectId, @name, @pageCount, @isActive, @resourceType, @hasAnswerKey);
    `)

  return { id: inserted.recordset[0].id, isNew: true }
}

async function insertTopic(pool, resourceBookId, name) {
  const result = await pool
    .request()
    .input('resourceBookId', sql.UniqueIdentifier, resourceBookId)
    .input('name', sql.NVarChar(200), name).query(`
      INSERT INTO dbo.ResourceBookTopics (resource_book_id, name)
      OUTPUT inserted.id
      VALUES (@resourceBookId, @name);
    `)
  return result.recordset[0].id
}

async function insertTest(pool, topicId, topicName, test) {
  const pageCount = test.pageEnd - test.pageStart + 1
  const result = await pool
    .request()
    .input('topicId', sql.UniqueIdentifier, topicId)
    .input('topicName', sql.NVarChar(200), topicName)
    .input('name', sql.NVarChar(200), test.name)
    .input('pageStart', sql.Int, test.pageStart)
    .input('pageEnd', sql.Int, test.pageEnd)
    .input('pageCount', sql.Int, pageCount)
    .input('questionCount', sql.Int, test.answers.length).query(`
      INSERT INTO dbo.ResourceBookTopicTests (topic_id, topic_name, name, page_start, page_end, page_count, question_count)
      OUTPUT inserted.id
      VALUES (@topicId, @topicName, @name, @pageStart, @pageEnd, @pageCount, @questionCount);
    `)
  return result.recordset[0].id
}

async function insertAnswerKey(pool, testId, answers) {
  if (!answers.length) return
  const values = []
  const request = pool.request().input('testId', sql.UniqueIdentifier, testId)
  answers.forEach((label, idx) => {
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
  if (!connectionString) {
    throw new Error('SQL_CONNECTION_STRING is missing.')
  }

  const { topics, totalTests } = buildTopics()
  if (totalTests !== 29) {
    throw new Error(`Expected 29 tests total, computed ${totalTests}`)
  }

  const pool = await sql.connect(connectionString)

  try {
    const publisherId = await getOrCreatePublisher(pool)
    console.log(`Publisher: ${PUBLISHER_NAME} -> ${publisherId}`)

    const subjectId = await getSubjectId(pool)
    console.log(`Subject: ${SUBJECT_NAME} -> ${subjectId}`)

    const { id: resourceBookId, isNew } = await getOrCreateResourceBook(pool, publisherId, subjectId)
    console.log(`ResourceBook: ${BOOK_NAME} -> ${resourceBookId} (${isNew ? 'created' : 'existing'})`)

    if (!isNew) {
      const existingTopics = await pool
        .request()
        .input('resourceBookId', sql.UniqueIdentifier, resourceBookId)
        .query('SELECT COUNT(*) AS cnt FROM dbo.ResourceBookTopics WHERE resource_book_id = @resourceBookId;')
      if (existingTopics.recordset[0].cnt > 0) {
        console.log('ResourceBook already has topics — skipping to avoid duplicates.')
        return
      }
    }

    let totalTestsInserted = 0
    let totalAnswers = 0

    for (const topic of topics) {
      const topicId = await insertTopic(pool, resourceBookId, topic.name)
      for (const test of topic.tests) {
        const testId = await insertTest(pool, topicId, topic.name, test)
        await insertAnswerKey(pool, testId, test.answers)
        totalTestsInserted += 1
        totalAnswers += test.answers.length
      }
      console.log(`Topic "${topic.name}": ${topic.tests.length} test(s)`)
    }

    console.log(`Done. Topics: ${topics.length}, Tests: ${totalTestsInserted}, Answer key rows: ${totalAnswers}`)
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Seed failed')
  console.error(error)
  process.exit(1)
})
