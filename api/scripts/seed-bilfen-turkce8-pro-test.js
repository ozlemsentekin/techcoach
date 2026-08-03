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
const SUBJECT_NAME = 'Türkçe'
const BOOK_NAME = '8. Sınıf Türkçe Pro & Test Soru Bankası'
const BOOK_PAGE_COUNT = 256

// Only the topic (İçerik) names — each test's page header in the book prints the KONU-level
// title directly above the test, so we use that as the topic name rather than the more granular
// İçindekiler subsection names. This keeps naming consistent with how future imports (from other
// publishers covering the same LGS Türkçe konuları) would label the same grammar topics.
const TOPICS = ['Fiilimsiler', 'Sözcükte Anlam', 'Cümle Ögeleri', 'Cümlede Anlam']

async function getOrCreatePublisher(pool) {
  const existing = await pool
    .request()
    .input('name', sql.NVarChar(150), PUBLISHER_NAME)
    .query('SELECT id FROM dbo.Publishers WHERE name = @name;')
  if (existing.recordset.length) return existing.recordset[0].id

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
  if (!result.recordset.length) throw new Error(`Subject not found: ${SUBJECT_NAME}`)
  return result.recordset[0].id
}

async function getOrCreateResourceBook(pool, publisherId, subjectId) {
  const existing = await pool
    .request()
    .input('publisherId', sql.UniqueIdentifier, publisherId)
    .input('name', sql.NVarChar(200), BOOK_NAME)
    .query('SELECT id FROM dbo.ResourceBooks WHERE publisher_id = @publisherId AND name = @name;')
  if (existing.recordset.length) return { id: existing.recordset[0].id, isNew: false }

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

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING is missing.')

  const pool = await sql.connect(connectionString)
  try {
    const publisherId = await getOrCreatePublisher(pool)
    console.log(`Publisher: ${PUBLISHER_NAME} -> ${publisherId}`)

    const subjectId = await getSubjectId(pool)
    console.log(`Subject: ${SUBJECT_NAME} -> ${subjectId}`)

    const { id: resourceBookId, isNew } = await getOrCreateResourceBook(pool, publisherId, subjectId)
    console.log(`ResourceBook: ${BOOK_NAME} -> ${resourceBookId} (${isNew ? 'created' : 'existing'})`)

    for (const topicName of TOPICS) {
      const { id: topicId, isNew: topicIsNew } = await getOrCreateTopic(pool, resourceBookId, topicName)
      console.log(`Topic: ${topicName} -> ${topicId} (${topicIsNew ? 'created' : 'existing'})`)
    }

    console.log('Done. Tests and answer keys are seeded separately.')
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Seed failed')
  console.error(error)
  process.exit(1)
})
