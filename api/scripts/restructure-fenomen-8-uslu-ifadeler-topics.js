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

// Active/approved "2. Fasikül - Üslü İfadeler" (Fenomen Yayınları, 8. Sınıf) resource book.
// Note: three other pending/inactive duplicates share this name — intentionally left untouched.
const RESOURCE_BOOK_ID = 'A3DA7443-327B-42DC-B689-779DB17431DB'
const NEW_TOPIC_NAME = '1. Ünite - Üslü İfadeler'

async function main() {
  loadLocalSettings()
  const connectionString = process.env.SQL_CONNECTION_STRING
  if (!connectionString) throw new Error('SQL_CONNECTION_STRING is missing.')

  const pool = await sql.connect(connectionString)
  try {
    const book = await pool
      .request()
      .input('id', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .query('SELECT id, name FROM dbo.ResourceBooks WHERE id = @id;')
    if (!book.recordset.length) throw new Error(`ResourceBook not found: ${RESOURCE_BOOK_ID}`)
    console.log(`ResourceBook: ${book.recordset[0].name} -> ${RESOURCE_BOOK_ID}`)

    const oldTopics = await pool
      .request()
      .input('resourceBookId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .query('SELECT id, name FROM dbo.ResourceBookTopics WHERE resource_book_id = @resourceBookId;')
    if (!oldTopics.recordset.length) throw new Error('No existing topics found for this resource book.')
    console.log(`Found ${oldTopics.recordset.length} existing content groups:`)
    oldTopics.recordset.forEach((t) => console.log(`  - ${t.name} (${t.id})`))

    const inserted = await pool
      .request()
      .input('resourceBookId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .input('name', sql.NVarChar(200), NEW_TOPIC_NAME).query(`
        INSERT INTO dbo.ResourceBookTopics (resource_book_id, name)
        OUTPUT inserted.id
        VALUES (@resourceBookId, @name);
      `)
    const newTopicId = inserted.recordset[0].id
    console.log(`Created new content group: ${NEW_TOPIC_NAME} -> ${newTopicId}`)

    const moved = await pool
      .request()
      .input('resourceBookId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .input('newTopicId', sql.UniqueIdentifier, newTopicId).query(`
        UPDATE tt
        SET tt.topic_id = @newTopicId
        OUTPUT deleted.id, deleted.name
        FROM dbo.ResourceBookTopicTests tt
        INNER JOIN dbo.ResourceBookTopics t ON t.id = tt.topic_id
        WHERE t.resource_book_id = @resourceBookId AND t.id <> @newTopicId;
      `)
    console.log(`Moved ${moved.recordset.length} tests to "${NEW_TOPIC_NAME}".`)

    const removed = await pool
      .request()
      .input('resourceBookId', sql.UniqueIdentifier, RESOURCE_BOOK_ID)
      .input('newTopicId', sql.UniqueIdentifier, newTopicId).query(`
        DELETE t
        OUTPUT deleted.name
        FROM dbo.ResourceBookTopics t
        WHERE t.resource_book_id = @resourceBookId
          AND t.id <> @newTopicId
          AND NOT EXISTS (SELECT 1 FROM dbo.ResourceBookTopicTests tt WHERE tt.topic_id = t.id);
      `)
    console.log(`Removed ${removed.recordset.length} old content groups: ${removed.recordset.map((r) => r.name).join(', ')}`)

    console.log('Done.')
  } finally {
    await pool.close()
  }
}

main().catch((error) => {
  console.error('Restructure failed')
  console.error(error)
  process.exit(1)
})
