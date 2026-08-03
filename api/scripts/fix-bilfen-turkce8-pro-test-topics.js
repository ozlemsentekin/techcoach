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

// Corrected mapping: the running page header printed above each test (matching the İçindekiler
// subsection list under each KONU), not the broad KONU chapter title. Tests not listed here
// (1-5, 12-14, 18-19, 25-27) keep their original topic — those already used the correct
// subsection name because it happens to equal the KONU title for those specific tests.
const REASSIGNMENTS = [
  { testNames: ['Test 6', 'Test 7'], topicName: 'Sözcüğün Cümle/Metin İçinde Kazandığı Anlamlar' },
  { testNames: ['Test 8'], topicName: 'Sözcükler Arası Anlam İlişkileri' },
  { testNames: ['Test 9'], topicName: 'Söz Sanatları' },
  { testNames: ['Test 10', 'Test 11'], topicName: 'Deyimlerin ve Söz Öbeklerinin Cümleye Kattığı Anlamlar' },
  { testNames: ['Test 15'], topicName: 'Cümlenin Temel Ögeleri' },
  { testNames: ['Test 16'], topicName: 'Cümlenin Yardımcı Ögeleri' },
  { testNames: ['Test 17'], topicName: 'Cümle Vurgusu / Ara Söz' },
  { testNames: ['Test 20', 'Test 21'], topicName: 'Öznel-Nesnel İfadeler, Yakın Anlamlı Cümleler' },
  { testNames: ['Test 22'], topicName: 'Cümleler Arası Anlam İlişkileri' },
  { testNames: ['Test 23'], topicName: 'Atasözleri' },
  { testNames: ['Test 24'], topicName: 'Duygu İfade Eden Cümleler' },
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

async function reassignTest(pool, resourceBookId, testName, newTopicId, newTopicName) {
  const result = await pool
    .request()
    .input('resourceBookId', sql.UniqueIdentifier, resourceBookId)
    .input('testName', sql.NVarChar(200), testName)
    .input('newTopicId', sql.UniqueIdentifier, newTopicId)
    .input('newTopicName', sql.NVarChar(200), newTopicName).query(`
      UPDATE tt
      SET tt.topic_id = @newTopicId, tt.topic_name = @newTopicName
      OUTPUT deleted.topic_id AS old_topic_id
      FROM dbo.ResourceBookTopicTests tt
      INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
      WHERE t.resource_book_id = @resourceBookId AND tt.name = @testName;
    `)
  return result.recordset[0]?.old_topic_id || null
}

async function deleteEmptyTopics(pool, resourceBookId) {
  const result = await pool
    .request()
    .input('resourceBookId', sql.UniqueIdentifier, resourceBookId).query(`
      DELETE t
      OUTPUT deleted.name
      FROM dbo.ResourceBookTopics t
      WHERE t.resource_book_id = @resourceBookId
        AND NOT EXISTS (SELECT 1 FROM dbo.ResourceBookTopicTests tt WHERE tt.topic_id = t.id);
    `)
  return result.recordset.map((r) => r.name)
}

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING is missing.')

  const pool = await sql.connect(connectionString)
  try {
    const resourceBookId = await getResourceBookId(pool)
    console.log(`ResourceBook: ${BOOK_NAME} -> ${resourceBookId}`)

    for (const group of REASSIGNMENTS) {
      const { id: topicId, isNew } = await getOrCreateTopic(pool, resourceBookId, group.topicName)
      console.log(`Topic: ${group.topicName} -> ${topicId} (${isNew ? 'created' : 'existing'})`)

      for (const testName of group.testNames) {
        const oldTopicId = await reassignTest(pool, resourceBookId, testName, topicId, group.topicName)
        if (!oldTopicId) {
          console.log(`  ! ${testName} not found`)
        } else {
          console.log(`  Moved ${testName} -> "${group.topicName}"`)
        }
      }
    }

    // The 4 originally-created broad topics (Fiilimsiler, Sözcükte Anlam, Cümle Ögeleri,
    // Cümlede Anlam) are left in place — they still correctly hold the tests whose own page
    // header equals the KONU title (1-5, 12-14, 18-19, 25-27). Nothing to delete unless a topic
    // ended up with zero tests after reassignment.
    const removed = await deleteEmptyTopics(pool, resourceBookId)
    if (removed.length) {
      console.log(`Removed empty topics: ${removed.join(', ')}`)
    } else {
      console.log('No empty topics to remove.')
    }

    console.log('Done.')
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Fix failed')
  console.error(error)
  process.exit(1)
})
